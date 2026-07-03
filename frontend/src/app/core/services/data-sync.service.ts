import { Injectable, inject } from '@angular/core';
import { MeterService } from './meter.service';
import { ReadingService } from './reading.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class DataSyncService {
  private readonly meterService = inject(MeterService);
  private readonly readingService = inject(ReadingService);
  private readonly supabase = inject(SupabaseService);

  exportData(): string {
    return JSON.stringify(
      {
        meters: this.meterService.meters(),
        readings: this.readingService.readings(),
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  async importData(json: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error('Ungültiges JSON-Format');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Ungültige Datenstruktur');
    }
    const data = parsed as Record<string, unknown>;
    if (Array.isArray(data['meters'])) {
      for (const m of data['meters']) {
        await this.supabase.addMeter(m as never);
      }
    }
    if (Array.isArray(data['readings'])) {
      for (const r of data['readings'] as Record<string, unknown>[]) {
        const reading = r as Omit<Parameters<typeof this.supabase.addReading>[0], 'date'> & { date: unknown };
        await this.supabase.addReading({ ...reading, date: new Date(reading.date as string) });
      }
    }
    // Reload all data after import
    await Promise.all([
      this.meterService.loadMeters(),
      this.readingService.loadReadings()
    ]);
  }
}
