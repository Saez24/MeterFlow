import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, from, switchMap, take, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

// Serialize concurrent refreshes: the first 401 triggers a single refresh, other
// 401s wait for it before retrying (avoids a refresh stampede).
let isRefreshing = false;
const refreshDone$ = new BehaviorSubject<boolean>(false);

const AUTH_PATHS = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/logout'];

/**
 * Sends the auth cookies with every request (`withCredentials`) and, on a 401,
 * transparently refreshes the access token once and retries the request.
 * Cookie-based JWT auth (contract §2) — no tokens in JS/localStorage.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authReq = req.clone({ withCredentials: true });

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      const isAuthEndpoint = AUTH_PATHS.some((path) => req.url.includes(path));
      if (err.status !== 401 || isAuthEndpoint) {
        return throwError(() => err);
      }

      if (isRefreshing) {
        return refreshDone$.pipe(
          filter((done) => done),
          take(1),
          switchMap(() => next(authReq)),
        );
      }

      isRefreshing = true;
      refreshDone$.next(false);

      return from(
        fetch(`${environment.apiUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        }),
      ).pipe(
        switchMap((res) => {
          isRefreshing = false;
          refreshDone$.next(true);
          if (res.ok) return next(authReq);
          router.navigate(['/auth']);
          return throwError(() => err);
        }),
        catchError(() => {
          isRefreshing = false;
          refreshDone$.next(true);
          router.navigate(['/auth']);
          return throwError(() => err);
        }),
      );
    }),
  );
};
