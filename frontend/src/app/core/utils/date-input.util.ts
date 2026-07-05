/**
 * Helpers to bridge native `<input type="date">` (which speaks a
 * `yyyy-MM-dd` string in local time) and the app's `Date`-based model.
 */

/** Format a `Date` as the local `yyyy-MM-dd` string a date input expects. */
export const toDateInputValue = (d: Date): string => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

/** Parse a `yyyy-MM-dd` string as a local-midnight `Date`. */
export const parseDateInput = (value: string): Date => new Date(`${value}T00:00:00`);
