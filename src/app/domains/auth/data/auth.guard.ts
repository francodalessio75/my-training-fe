import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthStore } from './auth.store';

export const authGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return toObservable(authStore.loading).pipe(
    filter((loading) => !loading),
    take(1),
    map(() => authStore.isAuthenticated() || router.createUrlTree(['/auth/login'])),
  );
};
