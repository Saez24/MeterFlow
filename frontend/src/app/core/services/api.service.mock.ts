import { computed, signal } from '@angular/core';
import { ApiService } from './api.service';

/**
 * Minimal ApiService stub for component "should create" specs — no HTTP.
 * Provide via `{ provide: ApiService, useValue: apiServiceMock() }`.
 */
export function apiServiceMock(): ApiService {
  return {
    currentUser: signal(null),
    isGuest: computed(() => false),
    connectionStatus: signal('connected'),
    sessionReady: Promise.resolve(),
    getSession: async () => null,
    signIn: async () => ({ error: null }),
    signUp: async () => ({ error: null }),
    signInAsGuest: async () => ({ error: null }),
    signOut: async () => {},
    getMeters: async () => [],
    addMeter: async (m: unknown) => m,
    updateMeter: async () => {},
    deleteMeter: async () => {},
    getReadings: async () => [],
    addReading: async (r: unknown) => r,
    updateReading: async () => {},
    deleteReading: async () => {},
    recalculateReadings: async () => [],
    importData: async () => ({
      metersAdded: 0,
      metersSkipped: 0,
      readingsAdded: 0,
      readingsSkipped: 0,
    }),
    uploadPhoto: async () => '',
    getSignedPhotoUrl: async (p: string) => p,
    deletePhoto: async () => {},
    removePhoto: async () => {},
    getCo2Factors: async () => ({ data: [], error: null }),
    upsertCo2Factor: async () => {},
    deleteCo2Factor: async () => {},
    clearAllUserData: async () => {},
    checkConnection: async () => {},
  } as unknown as ApiService;
}
