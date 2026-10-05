import { describe, expect, it } from 'vitest';
import { collapseDigitGaps, pickMeterReading } from './meter-reading-parser';

// OCR output of a real gas meter (Honeywell BK-G4M, reading 02217,589 m³):
// cropped to the number wheels, four threshold passes.
const CROPPED_PASSES = ['22175', '0 22 1758', '02217588', '02217585'];

// Same meter, whole photo without crop: wheels barely readable, but
// "EN 1359:2017", serial and type numbers are.
const WHOLE_PHOTO = '2023 5\n6 25 4250 6310\n6470180443 13592017 1\n0 2 2 2\n002542506310 1 0,01';

describe('collapseDigitGaps', () => {
  it('joins digits that are separated by wheel gaps', () => {
    expect(collapseDigitGaps('0 22 1758')).toBe('0221758');
  });

  it('keeps lines apart', () => {
    expect(collapseDigitGaps('12 34\n56')).toBe('1234\n56');
  });
});

describe('pickMeterReading', () => {
  it('reads the cropped wheels using the previous reading', () => {
    const result = pickMeterReading(CROPPED_PASSES, { min: 2190.4 });
    expect(result.value).toBe(2217.58);
  });

  it('keeps only the decimals most passes agree on (last wheel is half-turned)', () => {
    const result = pickMeterReading(['02217588', '02217585'], { min: 2190.4 });
    expect(result.value).toBe(2217.58);
  });

  it('offers the other plausible values as alternatives', () => {
    const result = pickMeterReading(CROPPED_PASSES, { min: 2190.4 });
    expect(result.alternatives.length).toBeGreaterThan(0);
    expect(result.alternatives).not.toContain(2217.58);
    for (const v of result.alternatives) expect(v).toBeGreaterThanOrEqual(2190.4);
  });

  it('rejects serial or standard numbers from an uncropped photo', () => {
    const result = pickMeterReading([WHOLE_PHOTO], { min: 2190.4 });
    expect(result.value).not.toBe(13592017);
    expect(result.value).not.toBe(4250);
  });

  it('respects the next reading as upper limit', () => {
    const result = pickMeterReading(['02217585'], { min: 2100, max: 2200 });
    expect(result.value).toBeNull();
  });

  it('uses a recognised comma when there is no previous reading', () => {
    const result = pickMeterReading(['02217,58']);
    expect(result.value).toBe(2217.58);
  });

  it('returns null when nothing was read', () => {
    expect(pickMeterReading(['', '  '], { min: 100 })).toEqual({ value: null, alternatives: [] });
  });
});
