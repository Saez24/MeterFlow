import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
  const api = inject(ApiService);
  const router = inject(Router);

  // Session vom Backend prüfen, dann entscheiden.
  return from(api.getSession()).pipe(
    map((user) => (user ? true : router.createUrlTree(['/auth']))),
  );
};
