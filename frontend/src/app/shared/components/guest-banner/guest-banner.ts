import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../core/services/api.service';

/** Notice shown while a demo guest is signed in (branch `supabase`). */
@Component({
  selector: 'app-guest-banner',
  imports: [MatIconModule],
  templateUrl: './guest-banner.html',
  styleUrl: './guest-banner.scss',
})
export class GuestBanner {
  private readonly router = inject(Router);
  protected readonly api = inject(ApiService);

  async createAccount(): Promise<void> {
    await this.api.signOut();
    await this.router.navigate(['/auth']);
  }
}
