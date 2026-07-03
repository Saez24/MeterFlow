import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import { LOCALE_ID, isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';

registerLocaleData(localeDe);
registerLocaleData(localeEn);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideAnimationsAsync(),
    provideHttpClient(withFetch()),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    {
      provide: LOCALE_ID,
      useValue: 'de',
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
