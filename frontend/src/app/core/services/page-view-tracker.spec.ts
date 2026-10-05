import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { UmamiPageViewPayload } from 'ngx-umami';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageViewTracker, normalizeTrackedUrl } from './page-view-tracker';

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

@Component({ template: '' })
class Blank {}

describe('PageViewTracker', () => {
  afterEach(() => {
    delete window.umami;
  });

  it('reports the current route, not the stale URL from the Umami payload', async () => {
    // Umami 3 with auto-tracking off keeps `url` at the URL the app was opened with.
    const stalePayload: UmamiPageViewPayload = {
      url: 'https://meterflow.example/dashboard',
      referrer: 'https://meterflow.example/meters/3f2a9c4e-1b2d-4e5f-8a9b-0c1d2e3f4a5b/chart',
      hostname: 'meterflow.example',
    };
    const sent: UmamiPageViewPayload[] = [];
    const track = vi.fn((callback: (p: UmamiPageViewPayload) => UmamiPageViewPayload) => {
      sent.push(callback(stalePayload));
    });
    window.umami = { track, identify: vi.fn() } as unknown as NonNullable<typeof window.umami>;

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: '**', component: Blank }]),
      ],
    });
    TestBed.inject(PageViewTracker).init();

    await TestBed.inject(Router).navigateByUrl(
      '/meters/3f2a9c4e-1b2d-4e5f-8a9b-0c1d2e3f4a5b/chart',
    );
    await TestBed.inject(Router).navigateByUrl('/readings/42/edit?from=list');

    expect(sent.map((p) => p.url)).toEqual(['/meters/:id/chart', '/readings/:id/edit']);
    expect(sent[0].hostname).toBe('meterflow.example');
    expect(sent[0].referrer).toBe('https://meterflow.example/meters/:id/chart');
  });
});
