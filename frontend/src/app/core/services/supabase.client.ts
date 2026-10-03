import { InjectionToken } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * The Supabase client used by ApiService. An injection token (instead of a
 * module-level `createClient`) so specs can provide a fake client.
 */
export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('SUPABASE_CLIENT', {
  providedIn: 'root',
  factory: () => createClient(environment.supabaseUrl, environment.supabaseKey),
});
