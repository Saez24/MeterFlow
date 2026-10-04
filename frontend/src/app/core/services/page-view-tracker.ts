import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { umamiConfig } from '../../config/analytics.config';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMERIC_SEGMENT = /\/\d+(?=\/|$)/g;

/**
 * Replaces record IDs in a route with `:id` and drops query/hash, so Umami only
 * sees route templates (`/meters/:id/chart`) — never IDs linkable to an account.
 */
export function normalizeTrackedUrl(url: string): string {
  const path = url.split(/[?#]/, 1)[0] || '/';
  return path.replace(UUID, ':id').replace(NUMERIC_SEGMENT, '/:id');
}

/**
 * Sends one Umami page view per router navigation with a normalized URL.
 * Umami's auto-tracking is off (see analytics.config.ts) because it would send
 * the raw URL including IDs.
 */
@Injectable({ providedIn: 'root' })
export class PageViewTracker {
  private readonly router = inject(Router);

  init(): void {
    if (typeof window === 'undefined') return;
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.whenTrackerReady(() => this.trackCurrentPage()));
  }

  private trackCurrentPage(): void {
    // Callback form: Umami passes its default payload (website, hostname, screen,
    // language, title …) and sends what we return. The object form would drop those.
    window.umami?.track((props) => ({ ...props, url: normalizeTrackedUrl(props.url ?? '/') }));
  }

  private whenTrackerReady(run: () => void): void {
    if (window.umami) {
      run();
      return;
    }
    // ngx-umami injects the script at bootstrap; wait for it on the first navigation.
    const script = document.querySelector(`script[data-website-id="${umamiConfig.websiteId}"]`);
    script?.addEventListener('load', run, { once: true });
  }
}
