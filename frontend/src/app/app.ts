import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterOutlet, NavigationEnd } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from './core/services/theme.service';
import { SupabaseService } from './core/services/supabase.service';
import { NotificationService } from './core/services/notification.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',

})
export class App {
  protected readonly title = signal('MeterFlow');
  readonly themeService = inject(ThemeService);
  readonly supabaseService = inject(SupabaseService);
  readonly sidebarCollapsed = signal(false);

  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  constructor() {
    // Monatliche Ableseerinnerung prüfen
    this.notificationService.checkAndShowReminder();
  }

  readonly isAuthPage = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects.startsWith('/auth'))
    ),
    { initialValue: this.router.url.startsWith('/auth') }
  );

  readonly navItems: NavItem[] = [
    { path: '/', icon: 'dashboard', label: $localize`:@@nav.dashboard:Dashboard` },
    { path: '/meters', icon: 'speed', label: $localize`:@@nav.meters:Zähler` },
    { path: '/readings', icon: 'history', label: $localize`:@@nav.readings:Ablesungen` },
    { path: '/reports', icon: 'bar_chart', label: $localize`:@@nav.reports:Auswertungen` },
    { path: '/cost-preview', icon: 'timeline', label: $localize`:@@nav.costPreview:Kostenvorschau` },
    { path: '/settings', icon: 'settings', label: $localize`:@@nav.settings:Einstellungen` },
  ];

  readonly toggleBtnLeft = computed(() =>
    this.sidebarCollapsed() ? '62px' : '228px'
  );

  readonly connectionColor = computed(() => {
    switch (this.supabaseService.connectionStatus()) {
      case 'connected': return 'var(--apple-blue)';
      case 'error': return '#EF4444';
      case 'checking': return '#F59E0B';
    }
  });

  readonly connectionTooltip = computed(() => {
    switch (this.supabaseService.connectionStatus()) {
      case 'connected': return $localize`:@@connection.connected:Verbunden`;
      case 'error': return $localize`:@@connection.error:Keine Verbindung`;
      case 'checking': return $localize`:@@connection.checking:Verbinde...`;
    }
  });

  async logout(): Promise<void> {
    await this.supabaseService.signOut();
    this.router.navigate(['/auth']);
  }
}