import { Injectable, inject } from '@angular/core';
import { MeterService } from './meter.service';
import { ReadingService } from './reading.service';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class DataSyncService {
  private readonly meterService = inject(MeterService);
  private readonly readingService = inject(ReadingService);
  private readonly api = inject(ApiService);

  exportData(): string {
    return JSON.stringify(
      {
        meters: this.meterService.meters(),
        readings: this.readingService.readings(),
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
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
    const meters = Array.isArray(data['meters']) ? data['meters'] : [];
    const readings = Array.isArray(data['readings']) ? data['readings'] : [];

    // Route through the bulk import endpoint: it preserves ids and resolves
    // linked-meter / reading references atomically (looping addMeter would
    // reassign ids and break linkedWaterMeterId — the cause of the 400).
    await this.api.importData({ meters, readings });

    // Reload all data after import.
    await Promise.all([this.meterService.loadMeters(), this.readingService.loadReadings()]);
  }
}
