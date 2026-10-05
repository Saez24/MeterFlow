/**
 * Turns raw OCR text of a meter's number wheels into a plausible reading.
 *
 * Mechanical counters have one wheel per digit, so OCR returns the digits with
 * gaps ("0 22 1758") and usually loses the decimal comma. Several OCR passes
 * (different thresholds) are combined, every possible comma position is tried,
 * and the previous/next reading of the meter decides which value is plausible.
 */

/** Plausibility window from the neighbouring readings of the same meter. */
export interface ReadingBounds {
  /** Previous reading; the new value must not be lower. 0/null = no previous reading. */
  min?: number | null;
  /** Next reading (when editing an older entry); the new value must not be higher. */
  max?: number | null;
  /**
   * Fixed number of decimal wheels (e.g. 3 for m³ gas/water meters). Then the
   * comma is not guessed, and every decimal is decided by its own majority vote.
   */
  decimals?: number;
}

export interface ParsedReading {
  value: number | null;
  /** Other plausible values, best first (max. 3), for a one-tap correction. */
  alternatives: number[];
}

interface Candidate {
  value: number;
  /** Decimal digits as read, e.g. "58" for 2217.58. */
  decimals: string;
  /** OCR pass the candidate came from (votes are counted per pass). */
  pass: number;
}

const MAX_DECIMALS = 3;
/** Longer digit runs are serial numbers, not readings. */
const MAX_DIGITS = 9;

/** Removes the gaps between the wheels: "0 22 1758" → "0221758" (per line). */
export function collapseDigitGaps(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/(\d)[ \t]+(?=\d)/g, '$1'))
    .join('\n');
}

function candidatesFromText(text: string, pass: number, fixed?: number): Candidate[] {
  const result: Candidate[] = [];
  for (const token of collapseDigitGaps(text).match(/\d+(?:[.,]\d+)?/g) ?? []) {
    const [intPart, decPart] = token.split(/[.,]/);
    if (decPart !== undefined) {
      // The comma was read: trust its position.
      if (intPart.length + decPart.length > MAX_DIGITS) continue;
      if (fixed !== undefined && decPart.length < fixed) continue;
      const decimals = decPart.slice(0, fixed ?? MAX_DECIMALS);
      result.push({ value: Number(`${intPart}.${decimals}`), decimals, pass });
      continue;
    }
    if (token.length > MAX_DIGITS) continue;
    // No comma: try every position (none, 1, 2, 3 decimals) — or only the known one.
    const positions = fixed !== undefined ? [fixed] : [0, 1, 2, 3];
    for (const d of positions) {
      if (d >= token.length) continue;
      const intDigits = token.slice(0, token.length - d);
      const decimals = token.slice(token.length - d);
      result.push({ value: Number(d ? `${intDigits}.${decimals}` : intDigits), decimals, pass });
    }
  }
  return result;
}

/** Upper limit when there is no next reading: generous, but excludes serial-number noise. */
function upperBound(min: number, max: number | null | undefined): number {
  if (max != null) return max;
  return min + Math.max(min * 0.5, 500);
}

/**
 * Picks the reading from one or more OCR passes.
 * With a previous reading, only values in [min, upper] count; the integer part
 * with the most passes wins, and decimals are kept only as far as most of those
 * passes agree (the last wheel is often half-turned).
 */
export function pickMeterReading(texts: string[], bounds: ReadingBounds = {}): ParsedReading {
  if (bounds.decimals !== undefined) {
    const fixed = pickWith(texts, bounds, bounds.decimals);
    // No pass kept all decimal wheels: fall back to guessing the comma.
    if (fixed.value !== null) return fixed;
  }
  return pickWith(texts, bounds, undefined);
}

function pickWith(
  texts: string[],
  bounds: ReadingBounds,
  fixed: number | undefined,
): ParsedReading {
  const all = texts.flatMap((text, pass) => candidatesFromText(text, pass, fixed));
  const min = bounds.min ?? 0;
  const hasPrevious = min > 0;

  const plausible = hasPrevious
    ? all.filter((c) => c.value >= min && c.value <= upperBound(min, bounds.max))
    : all.filter((c) => bounds.max == null || c.value <= bounds.max);
  if (plausible.length === 0) return { value: null, alternatives: [] };

  // Group by integer part, rank by number of distinct passes, then by closeness to min.
  const groups = new Map<number, Candidate[]>();
  for (const c of plausible) {
    const key = Math.trunc(c.value);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const passCount = (g: Candidate[]) => new Set(g.map((c) => c.pass)).size;
  const ranked = [...groups.entries()].sort(
    ([aInt, a], [bInt, b]) =>
      passCount(b) - passCount(a) || (hasPrevious ? aInt - min - (bInt - min) : bInt - aInt),
  );

  const [bestInt, best] = ranked[0];
  const decimals = fixed !== undefined ? votedDecimals(best, fixed) : agreedDecimals(best);
  const value = Number(`${bestInt}.${decimals || '0'}`);
  const alternatives = [
    ...new Set(
      [...best, ...ranked.slice(1).flatMap(([, g]) => g)]
        .map((c) => c.value)
        .filter((v) => v !== value),
    ),
  ].slice(0, 3);
  return { value, alternatives };
}

/** Longest decimal prefix that more than half of the passes in the group agree on. */
function agreedDecimals(group: Candidate[]): string {
  // One candidate per pass: the one with the most decimals (most information).
  const perPass = new Map<number, string>();
  for (const c of group) {
    if ((perPass.get(c.pass)?.length ?? -1) < c.decimals.length) perPass.set(c.pass, c.decimals);
  }
  const decimals = [...perPass.values()];
  let agreed = '';
  for (let k = 1; k <= MAX_DECIMALS; k++) {
    const counts = new Map<string, number>();
    for (const d of decimals)
      if (d.length >= k) counts.set(d.slice(0, k), (counts.get(d.slice(0, k)) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!top || top[1] * 2 <= decimals.length || !top[0].startsWith(agreed)) break;
    agreed = top[0];
  }
  return agreed;
}

/**
 * Fixed decimal count: each position is decided separately by the passes
 * (ties: the earlier pass). "588" + "585" → "588".
 */
function votedDecimals(group: Candidate[], length: number): string {
  const perPass = new Map<number, string>();
  for (const c of group) if (!perPass.has(c.pass)) perPass.set(c.pass, c.decimals);
  const reads = [...perPass.entries()].sort((a, b) => a[0] - b[0]).map(([, d]) => d);
  let voted = '';
  for (let i = 0; i < length; i++) {
    const counts = new Map<string, number>();
    for (const d of reads) counts.set(d[i], (counts.get(d[i]) ?? 0) + 1);
    // Map keeps insertion order, so on a tie the earlier pass wins.
    voted += [...counts.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }
  return voted;
}
