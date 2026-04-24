import { inject, computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { AuthService, User } from './auth.service';

const TOKEN_KEY = 'auth_token';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed((store) => ({
    isAuthenticated: computed(() => !!store.user()),
  })),

  withMethods((store, authService = inject(AuthService)) => ({
    async login(email: string, password: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const { accessToken } = await firstValueFrom(authService.login(email, password));
        localStorage.setItem(TOKEN_KEY, accessToken);
        patchState(store, { token: accessToken });

        const user = await firstValueFrom(authService.me());
        patchState(store, { user, loading: false });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Login failed. Please try again.';
        patchState(store, { loading: false, error: message });
      }
    },

    logout(): void {
      localStorage.removeItem(TOKEN_KEY);
      patchState(store, { user: null, token: null, error: null, loading: false });
    },

    async restoreSession(): Promise<void> {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;

      patchState(store, { token, loading: true });
      try {
        const user = await firstValueFrom(authService.me());
        patchState(store, { user, loading: false });
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        patchState(store, { token: null, loading: false });
      }
    },
  })),

  withHooks({
    onInit(store) {
      store.restoreSession();
    },
  }),
);
