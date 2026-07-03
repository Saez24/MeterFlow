import { Component, inject, input, computed, signal, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MeterConfig, TariffPeriod } from '../../../core/models/energy.models';

@Component({
  selector: 'app-tariff-history',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './tariff-history.html',
  styleUrl: './tariff-history.scss',

})
export class TariffHistory {
  private readonly snackBar = inject(MatSnackBar);

  readonly meter = input.required<MeterConfig>();
  readonly addTariff = output<void>();
  readonly editTariff = output<string>();
  readonly deleteTariff = output<TariffPeriod>();

  readonly isGas = computed(() => this.meter().type === 'gas');
  readonly isWater = computed(() => ['water', 'garden_water'].includes(this.meter().type));
  readonly isLinkedGardenWater = computed(
    () => this.meter().type === 'garden_water' && !!this.meter().linkedWaterMeterId,
  );
  readonly isDistrictHeating = computed(() => this.meter().type === 'fernwarme');

  readonly sortedHistory = computed(() =>
    [...(this.meter().tariffHistory ?? [])].sort(
      (a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime(),
    ),
  );

  readonly currentTariff = computed(() => {
    const h = this.sortedHistory();
    return h.length > 0 ? h[0] : null;
  });

  getPriceDiff(index: number): { pct: number; prev: number; curr: number } | null {
    const history = this.sortedHistory();
    if (index >= history.length - 1) return null; // Can't compare the oldest entry

    const curr = history[index];
    const prev = history[index + 1];

    const prevPrice = prev.pricePerUnit;
    if (prevPrice === 0) return null;

    const pct = ((curr.pricePerUnit - prevPrice) / prevPrice) * 100;
    return { pct, prev: prevPrice, curr: curr.pricePerUnit };
  }

  getFernwaermeAnnualBaseCharge(period: TariffPeriod): number {
    const connectedKw = Math.max(0, this.meter().connectedLoadKw ?? 10);
    return connectedKw * (period.basePricePerKw ?? 0);
  }

  getFernwaermeMonthlyBaseCharge(period: TariffPeriod): number {
    return this.getFernwaermeAnnualBaseCharge(period) / 12;
  }

  delete(period: TariffPeriod): void {
    this.deleteTariff.emit(period);
  }
}
