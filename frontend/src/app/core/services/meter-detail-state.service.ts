import { Injectable, inject, signal, computed } from '@angular/core';
import { MeterService } from './meter.service';
import { ReadingService } from './reading.service';
import { TariffService } from './tariff.service';
import { MeterConfig } from '../models/energy.models';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';

@Injectable()
export class MeterDetailStateService {
  private readonly meterService = inject(MeterService);
  private readonly readingService = inject(ReadingService);
  private readonly tariffService = inject(TariffService);
  private readonly route = inject(ActivatedRoute);

  private readonly meterId = toSignal(
    this.route.params.pipe(map(params => params['id'])),
    { initialValue: this.route.snapshot.paramMap.get('id') ?? '' }
  );

  readonly meter = computed(() => this.meterService.getMeter(this.meterId()));

  readonly readings = computed(() => {
    return this.readingService.getReadingsForMeter(this.meterId())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  readonly latestReading = computed(() => this.readings()[0] ?? null);

  readonly activeTariff = computed(() => {
    const m = this.meter();
    if (!m) return null;
    return this.tariffService.getActiveTariffForDate(m, new Date());
  });
}
