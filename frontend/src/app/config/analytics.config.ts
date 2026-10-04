import type { UmamiConfig } from 'ngx-umami';

/**
 * Self-hosted Umami — cookieless, no banner. Website ID is public, not a secret.
 * autoTrack is off: PageViewTracker sends page views with IDs stripped from the URL.
 */
export const umamiConfig: UmamiConfig = {
  websiteId: '195bed45-30ad-4aa4-9ad1-49216952b222',
  src: 'https://stats.your-developer.de/script.js',
  domains: ['meterflow.your-developer.de'],
  autoTrack: false,
};
