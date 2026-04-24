import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { map } from 'rxjs/operators';
import { AuthStore } from './domains/auth/data/auth.store';

interface NavLink {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly breakpointObserver = inject(BreakpointObserver);
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly isHandset = toSignal(
    this.breakpointObserver.observe(Breakpoints.Handset).pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  readonly sidenavOpen = signal(false);

  readonly navLinks: NavLink[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/sessions', label: 'Sessions', icon: 'fitness_center' },
    { path: '/exercises', label: 'Exercises', icon: 'sports_gymnastics' },
    { path: '/catalogs', label: 'Catalogs', icon: 'menu_book' },
    { path: '/profile', label: 'Profile', icon: 'person' },
  ];

  toggleSidenav(): void {
    this.sidenavOpen.update((v) => !v);
  }

  closeSidenav(): void {
    this.sidenavOpen.set(false);
  }

  logout(): void {
    this.authStore.logout();
    this.router.navigate(['/auth/login']);
  }
}
