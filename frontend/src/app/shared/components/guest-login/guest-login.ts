import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../core/services/api.service';
import { MeterService } from '../../../core/services/meter.service';
import { ReadingService } from '../../../core/services/reading.service';

/** "Als Gast testen" on the login page (demo, branch `supabase`). */
@Component({
  selector: 'app-guest-login',
  imports: [MatIconModule],
  templateUrl: './guest-login.html',
  styleUrl: './guest-login.scss',
})
export class GuestLogin {
  private readonly api = inject(ApiService);
  private readonly meterService = inject(MeterService);
  private readonly readingService = inject(ReadingService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal('');

  async start(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const { error } = await this.api.signInAsGuest();
      if (error) {
        this.error.set(
          $localize`:@@guestLogin.error:Der Gastzugang ist gerade nicht verfügbar. Bitte versuche es später erneut.`,
        );
        return;
      }
      // The services loaded right after sign-in, before the demo data existed.
      await Promise.all([this.meterService.loadMeters(), this.readingService.loadReadings()]);
      await this.router.navigate(['/']);
    } finally {
      this.loading.set(false);
    }
  }
}
