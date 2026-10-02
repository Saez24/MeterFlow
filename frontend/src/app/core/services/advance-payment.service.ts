import { Service, inject } from '@angular/core';
import { AdvancePaymentYear } from '../models/energy.models';
import { MeterService } from './meter.service';

@Service()
export class AdvancePaymentService {
  private readonly meterService = inject(MeterService);

  /** Speichert die Abschläge eines Jahres (ersetzt einen vorhandenen Eintrag). */
  async saveYear(meterId: string, entry: AdvancePaymentYear): Promise<void> {
    const meter = this.meterService.getMeter(meterId);
    if (!meter) return;

    const others = (meter.advancePayments ?? []).filter((e) => e.year !== entry.year);
    const payments = [...entry.payments].sort((a, b) => a.month - b.month);

    await this.meterService.updateMeter(meterId, {
      advancePayments: [...others, { ...entry, payments }].sort((a, b) => a.year - b.year),
    });
  }
}
