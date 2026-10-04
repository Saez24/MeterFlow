import { describe, expect, it } from 'vitest';
import { normalizeTrackedUrl } from './page-view-tracker';

describe('normalizeTrackedUrl', () => {
  it('replaces UUID segments with :id', () => {
    expect(normalizeTrackedUrl('/meters/3f2a9c4e-1b2d-4e5f-8a9b-0c1d2e3f4a5b/chart')).toBe(
      '/meters/:id/chart',
    );
  });

  it('replaces numeric segments with :id', () => {
    expect(normalizeTrackedUrl('/readings/42/edit')).toBe('/readings/:id/edit');
  });

  it('drops query string and hash', () => {
    expect(normalizeTrackedUrl('/reports?year=2026#top')).toBe('/reports');
  });

  it('keeps routes without IDs unchanged', () => {
    expect(normalizeTrackedUrl('/meters/new')).toBe('/meters/new');
    expect(normalizeTrackedUrl('/')).toBe('/');
  });
});
