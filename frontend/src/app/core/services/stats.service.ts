import { Injectable, computed, inject } from '@angular/core';
import {
  CO2_FACTORS,
  ENERGY_META,
  MonthStats,
  YearStats,
  MONTH_NAMES,
  WaterBill,
  BudgetAlert,
  MeterConfig,
} from '../models/energy.models';
import { MeterService } from './meter.service';
import { ReadingService } from './reading.service';
import { GAS_DEFAULTS } from '../constants/gas.constants';
import { TariffService } from './tariff.service';

export interface MeterSummary {
  consumption: number;
  cost: number;
  unit: string;
  consumptionKwh?: number;
  co2Kg: number;
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly meterService = inject(MeterService);
  private readonly readingService = inject(ReadingService);
  private readonly tariffService = inject(TariffService);

  readonly dashboardStats = computed(() => {
    const stats: Record<
      string,
      { consumption: number; cost: number; unit: string; trend: number }
    > = {};
    for (const meter of this.meterService.activeMeters()) {
      const readings = this.readingService.readingsByMeter().get(meter.id) ?? [];
      const recent = readings.slice(0, 2);
      let consumption = 0,
        cost = 0,
        trend = 0;
      if (recent.length >= 2) {
        consumption = recent[0].consumption ?? 0;
        cost = recent[0].totalCost ?? 0;
        if (readings.length >= 4) {
          const prevConsumption = readings[2].consumption ?? 0;
          trend = prevConsumption > 0 ? ((consumption - prevConsumption) / prevConsumption) * 100 : 0;
        }
      }
      stats[meter.id] = { consumption, cost, unit: ENERGY_META[meter.type].unit, trend };
    }
    return stats;
  });

  readonly budgetAlerts = computed((): BudgetAlert[] => {
    const alerts: BudgetAlert[] = [];
    const now = new Date();
    const thisMonth = now.getMonth() + 1;
    const thisYear = now.getFullYear();

    for (const meter of this.meterService.activeMeters()) {
      if (!meter.budget) continue;
      const { budget } = meter;
      const yearStats = this.getYearStats(thisYear);
      const monthStats = yearStats.months.find((m) => m.month === thisMonth);
      const ms = monthStats?.byMeter[meter.id];
      const ys = yearStats.byMeter[meter.id];

      if (budget.monthlyLimit && ms) {
        const pct = (ms.cost / budget.monthlyLimit) * 100;
        if (pct >= budget.alertAt) {
          alerts.push({
            meterId: meter.id,
            meterName: meter.name,
            type: 'monthly_cost',
            current: ms.cost,
            limit: budget.monthlyLimit,
            percent: pct,
            unit: '€',
            color: meter.color,
            critical: pct >= 100,
          });
        }
      }
      if (budget.yearlyLimit && ys) {
        const pct = (ys.cost / budget.yearlyLimit) * 100;
        if (pct >= budget.alertAt) {
          alerts.push({
            meterId: meter.id,
            meterName: meter.name,
            type: 'yearly_cost',
            current: ys.cost,
            limit: budget.yearlyLimit,
            percent: pct,
            unit: '€',
            color: meter.color,
            critical: pct >= 100,
          });
        }
      }
      if (budget.consumptionLimit && ms) {
        const pct = (ms.consumption / budget.consumptionLimit) * 100;
        if (pct >= budget.alertAt) {
          alerts.push({
            meterId: meter.id,
            meterName: meter.name,
            type: 'consumption',
            current: ms.consumption,
            limit: budget.consumptionLimit,
            percent: pct,
            unit: ENERGY_META[meter.type].unit,
            color: meter.color,
            critical: pct >= 100,
          });
        }
      }
    }
    return alerts.sort((a, b) => b.percent - a.percent);
  });

  readonly waterBillStats = computed(() => {
    const result: WaterBill[] = [];
    const waterMeters = this.meterService.activeMeters().filter((m) => m.type === 'water');

    for (const mainMeter of waterMeters) {
      const gardenMeters = this.meterService.activeMeters().filter(
        (m) => m.type === 'garden_water' && m.linkedWaterMeterId === mainMeter.id,
      );

      const mainReadings = this.readingService.readingsByMeter().get(mainMeter.id) ?? [];
      if (mainReadings.length < 2) continue;

      for (let i = 0; i < mainReadings.length - 1; i++) {
        const r = mainReadings[i];
        const prev = mainReadings[i + 1];
        const d = new Date(r.date);
        const consumption = r.value - prev.value;
        if (consumption <= 0) continue;

        let gardenConsumption = 0;
        for (const gm of gardenMeters) {
          const gReadings = this.readingService.readingsByMeter().get(gm.id) ?? [];
          for (let j = 0; j < gReadings.length - 1; j++) {
            const gr = gReadings[j];
            const gprev = gReadings[j + 1];
            const gDate = new Date(gr.date);
            if (gDate.getMonth() === d.getMonth() && gDate.getFullYear() === d.getFullYear()) {
              gardenConsumption += gr.value - gprev.value;
            }
          }
        }

        const tariff = this.tariffService.getActiveTariffForDate(mainMeter, r.date);
        const billableWastewater = Math.max(0, consumption - gardenConsumption);
        const freshwaterCost = consumption * (tariff ? tariff.pricePerUnit : 0);
        const wastewaterCost = billableWastewater * (tariff ? tariff.wastewaterPrice ?? 0 : 0);
        const baseCharge = tariff?.baseCharge ?? 0;
        const totalCost = freshwaterCost + wastewaterCost + baseCharge;

        result.push({
          meterId: mainMeter.id,
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          totalConsumption: consumption,
          gardenConsumption,
          billableWastewater,
          freshwaterCost,
          wastewaterCost,
          baseCharge,
          totalCost,
        });
      }
    }
    return result;
  });

  readonly availableYears = computed(() => {
    const years = new Set<number>();
    for (const r of this.readingService.readings()) years.add(new Date(r.date).getFullYear());
    return [...years].sort((a, b) => b - a);
  });

  getMonthStats(year: number): MonthStats[] {
    const result: MonthStats[] = [];
    for (let month = 1; month <= 12; month++) {
      const stats: MonthStats = {
        year,
        month,
        label: `${MONTH_NAMES[month - 1]} ${String(year).slice(2)}`,
        byMeter: {},
        totalCost: 0,
      };

      for (const meter of this.meterService.activeMeters()) {
        const allReadings = (this.readingService.readingsByMeter().get(meter.id) ?? [])
          .slice()
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const monthReadings = allReadings.filter((r) => {
          const d = new Date(r.date);
          return d.getFullYear() === year && d.getMonth() + 1 === month;
        });

        if (monthReadings.length >= 1) {
          const monthConsumption = monthReadings.reduce((sum, reading) => {
            const index = allReadings.findIndex((r) => r.id === reading.id);
            const prev = index > 0 ? allReadings[index - 1] : undefined;
            const consumption =
              reading.consumption ?? (prev ? reading.value - prev.value : 0);
            return sum + consumption;
          }, 0);

          const monthCost = monthReadings.reduce((sum, reading) => {
            const index = allReadings.findIndex((r) => r.id === reading.id);
            const prev = index > 0 ? allReadings[index - 1] : undefined;
            const consumption =
              reading.consumption ?? (prev ? reading.value - prev.value : 0);
            const cost = reading.totalCost ?? this.calcCost(meter, consumption, reading.date);
            return sum + cost;
          }, 0);

          stats.byMeter[meter.id] = {
            consumption: monthConsumption,
            cost: monthCost,
            unit: ENERGY_META[meter.type].unit,
          };
          stats.totalCost += monthCost;
        }
      }
      result.push(stats);
    }
    return result;
  }

  getYearStats(year: number): YearStats {
    const months = this.getMonthStats(year);
    const byMeter: Record<string, { consumption: number; cost: number }> = {};
    let totalCost = 0;

    for (const m of months) {
      for (const [meterId, s] of Object.entries(m.byMeter)) {
        if (!byMeter[meterId]) byMeter[meterId] = { consumption: 0, cost: 0 };
        byMeter[meterId].consumption += s.consumption;
        byMeter[meterId].cost += s.cost;
        totalCost += s.cost;
      }
    }

    return { year, totalCost, byMeter, months };
  }

  getMeterSummary(meterId: string, year: number): MeterSummary | null {
    const yearStats = this.getYearStats(year);
    const meterStats = yearStats.byMeter[meterId];

    if (!meterStats) return null;

    const meter = this.meterService.getMeter(meterId);
    if (!meter) return null;

    const monthsWithData = yearStats.months.filter(
      (m) => m.byMeter[meterId] !== undefined
    );

    const baseChargeCost = monthsWithData.reduce((sum, month) => {
      const tariff = this.tariffService.getActiveTariffForDate(
        meter,
        new Date(year, month.month - 1),
      );
      return sum + (tariff ? tariff.baseCharge : 0);
    }, 0);

    const totalCost = meterStats.cost + baseChargeCost;
    const unit = ENERGY_META[meter.type].unit;

    let consumptionKwh: number | undefined;
    if (meter.type === 'gas') {
      consumptionKwh = this.readingService
        .getReadingsForMeter(meterId)
        .filter((r) => new Date(r.date).getFullYear() === year)
        .reduce((sum, reading) => sum + (reading.kwh ?? 0), 0);
    }

    // CO₂ berechnen auf Basis der nativen Verbrauchseinheit (m³ für Gas, kWh für Strom, etc.)
    const co2Kg = meterStats.consumption * CO2_FACTORS[meter.type];

    return {
      consumption: meterStats.consumption,
      cost: totalCost,
      unit,
      consumptionKwh,
      co2Kg,
    };
  }

  private calcCost(meter: MeterConfig, consumption: number, date: Date): number {
    const tariff = this.tariffService.getActiveTariffForDate(meter, date);
    if (!tariff) return 0;

    if (meter.type === 'gas') {
      const calorificValue = tariff.calorificValue ?? meter.calorificValue ?? GAS_DEFAULTS.CALORIFIC_VALUE;
      const zNumber = tariff.zNumber ?? meter.zNumber ?? GAS_DEFAULTS.Z_NUMBER;
      const kwh = consumption * calorificValue * zNumber;
      return kwh * tariff.pricePerUnit;
    }
    if (meter.type === 'fernwarme') {
      return consumption * (tariff.pricePerUnit + (tariff.emissionPrice ?? 0));
    }
    return consumption * tariff.pricePerUnit;
  }
}