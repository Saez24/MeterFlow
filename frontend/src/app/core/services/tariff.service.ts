import { Injectable, inject } from '@angular/core';
import { MeterConfig, TariffPeriod } from '../models/energy.models';
import { MeterService } from './meter.service';

@Injectable({ providedIn: 'root' })
export class TariffService {
  private readonly meterService = inject(MeterService);

  getTariff(meterId: string, tariffId: string): TariffPeriod | null {
    const meter = this.meterService.getMeter(meterId);
    if (!meter || !meter.tariffHistory) return null;
    return meter.tariffHistory.find((t) => t.id === tariffId) ?? null;
  }

  getActiveTariff(meter: MeterConfig): TariffPeriod | null {
    return this.getActiveTariffForDate(meter, new Date());
  }

  async addTariff(meterId: string, period: Omit<TariffPeriod, 'id'>): Promise<void> {
    const meter = this.meterService.getMeter(meterId);
    if (!meter) return;

    const newValidFrom = new Date(period.validFrom);
    let history = [...(meter.tariffHistory ?? [])];

    // Finde den aktuellsten Tarif, der vor dem neuen Tarif liegt
    const sortedHistory = history.sort(
      (a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime(),
    );

    const previousTariff = sortedHistory.find(
      (p) => new Date(p.validFrom) < newValidFrom && !p.validTo,
    );

    if (previousTariff) {
      const validTo = new Date(newValidFrom);
      validTo.setDate(validTo.getDate() - 1);
      const updatedPreviousTariff = { ...previousTariff, validTo };

      // Ersetze den alten Tarif durch den aktualisierten im Array
      history = history.map((p) => (p.id === previousTariff.id ? updatedPreviousTariff : p));
    }

    const newPeriod: TariffPeriod = {
      ...period,
      id: crypto.randomUUID(),
      validFrom: newValidFrom,
    };

    await this.meterService.updateMeter(meterId, {
      tariffHistory: [...history, newPeriod],
    });
  }

  async updateTariff(meterId: string, tariffId: string, changes: Partial<TariffPeriod>): Promise<void> {
    const meter = this.meterService.getMeter(meterId);
    if (!meter || !meter.tariffHistory) return;

    const history = meter.tariffHistory.map((t) => (t.id === tariffId ? { ...t, ...changes } : t));

    await this.meterService.updateMeter(meterId, { tariffHistory: history });
  }

  async deleteTariffPeriod(meterId: string, periodId: string): Promise<void> {
    const meter = this.meterService.getMeter(meterId);
    if (!meter) return;
    await this.meterService.updateMeter(meterId, {
      tariffHistory: (meter.tariffHistory ?? []).filter((p) => p.id !== periodId),
    });
  }

  getActiveTariffForDate(meter: MeterConfig, date: Date): TariffPeriod | null {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const history = (meter.tariffHistory ?? [])
      .filter((p) => {
        const validFrom = new Date(p.validFrom);
        validFrom.setHours(0, 0, 0, 0);
        if (validFrom > d) return false;
        if (p.validTo) {
          const validTo = new Date(p.validTo);
          validTo.setHours(0, 0, 0, 0);
          if (validTo < d) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());

    return history.length > 0 ? history[0] : null;
  }
}
