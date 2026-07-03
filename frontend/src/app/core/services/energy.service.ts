import { Injectable, signal, effect, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { MeterService } from './meter.service';
import { ReadingService } from './reading.service';

@Injectable({ providedIn: 'root' })
export class EnergyService {
  private readonly supabase = inject(SupabaseService);
  private readonly meterService = inject(MeterService);
  private readonly readingService = inject(ReadingService);

  readonly loading = signal(true);

  constructor() {
    effect(() => {
      if (this.supabase.currentUser()) {
        this.loadAll();
      } else {
        this.meterService.meters.set([]);
        this.readingService.readings.set([]);
        this.loading.set(false);
      }
    });

    effect(() => {
        this.loading.set(this.meterService.loading() || this.readingService.loading());
    })
  }

  private async loadAll(): Promise<void> {
    this.loading.set(true);
    await Promise.all([
        this.meterService.loadMeters(),
        this.readingService.loadReadings()
    ]);
    this.loading.set(false);
  }
}
