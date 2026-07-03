import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // Erst Session von Supabase laden, dann entscheiden
  return from(supabase.getSession()).pipe(
    map(user => user ? true : router.createUrlTree(['/auth']))
  )
};