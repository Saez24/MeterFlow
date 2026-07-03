import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ENERGY_META, MeterConfig } from '../../../core/models/energy.models';
import { MeterDetailStateService } from '../../../core/services/meter-detail-state.service';

@Component({
  selector: 'app-meter-detail',
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './meter-detail.html',
  styleUrl: './meter-detail.scss',

  providers: [MeterDetailStateService],
})
export class MeterDetail {
  private readonly state = inject(MeterDetailStateService);

  readonly meter = this.state.meter;
  readonly latestReading = this.state.latestReading;
  readonly activeTariff = this.state.activeTariff;
  readonly lastConsumption = computed(() => this.latestReading()?.consumption ?? null);

  getMeta(type: string) {
    return ENERGY_META[type as keyof typeof ENERGY_META];
  }

  getLatestTariffDate(meter: MeterConfig): Date | null {
    const h = meter.tariffHistory ?? [];
    if (!h.length) return null;
    return new Date(Math.max(...h.map((p) => new Date(p.validFrom).getTime())));
  }
}
