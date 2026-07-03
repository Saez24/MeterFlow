/**
 * Local inline-SVG icon registry (no Material icon font, no CDN — project
 * constraint). Each entry is the `d` attribute of a single `<path>` on a
 * 24×24 viewBox, stroke-based (currentColor). Add icons here as needed.
 */
export const ICON_PATHS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M20 6 9 17l-5-5',
  close: 'M18 6 6 18M6 6l12 12',
  trash: 'M3 6h18M8 6V4h8v2m-1 0v14H9V6m-3 0 1 14h10l1-14',
  edit: 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-down': 'M6 9l6 6 6-6',
  search: 'M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.42-1.42M4.92 19.08l1.42-1.42m0-11.32L4.92 4.92m14.16 14.16-1.42-1.42M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z',
  bolt: 'M13 2 3 14h7l-1 8 10-12h-7l1-8Z',
  flame: 'M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-3-2 1-4 3-4 6a7 7 0 0 0 14 0c0-5-7-11-7-11Z',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.4l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 5.6h.09A1.65 1.65 0 0 0 11 4V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20.4 9H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',
} as const;

export type IconName = keyof typeof ICON_PATHS;
