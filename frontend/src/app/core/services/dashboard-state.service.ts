import { Injectable, inject, signal, computed } from '@angular/core';
import { StatsService } from './stats.service';
import {
  ENERGY_META,
  MeterConfig,
  ReadingRow,
  TariffPeriod,
} from '../models/energy.models';
import { MeterService } from './meter.service';
import { ReadingService } from './reading.service';
import { TariffService } from './tariff.service';

@Injectable({ providedIn: 'root' })
export class DashboardStateService {
  private readonly meterService = inject(MeterService);
  private readonly readingService = inject(ReadingService);
  private readonly tariffService = inject(TariffService);
  readonly statsService = inject(StatsService);

  // ============ GEMEINSAMER STATE ============
  readonly availableYears = this.statsService.availableYears;
  readonly activeMeters = this.meterService.activeMeters;
  readonly waterBills = this.statsService.waterBillStats;

  readonly selectedYear = signal(
    this.availableYears()[0] ?? new Date().getFullYear()
  );

  readonly yearStats = computed(() =>
    this.statsService.getYearStats(this.selectedYear())
  );

  readonly activeCount = computed(() => this.activeMeters().length);

  readonly recentReadings = computed((): ReadingRow[] =>
    [...this.readingService.readings()]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8)
      .map((reading) => ({
        reading,
        gardenWaterCost: this.readingService.getGardenWaterCost(reading),
      }))
  );

  readonly waterBillsForYear = computed(() =>
    this.waterBills().filter((b) => b.year === this.selectedYear())
  );

  readonly waterTotals = computed(() => {
    const bills = this.waterBillsForYear();
    return {
      totalM3: bills.reduce((s, b) => s + b.totalConsumption, 0),
      gardenM3: bills.reduce((s, b) => s + b.gardenConsumption, 0),
      billableM3: bills.reduce((s, b) => s + b.billableWastewater, 0),
      freshCost: bills.reduce((s, b) => s + b.freshwaterCost, 0),
      wasteCost: bills.reduce((s, b) => s + b.wastewaterCost, 0),
      baseCharge: bills.reduce((s, b) => s + b.baseCharge, 0),
      total: bills.reduce((s, b) => s + b.totalCost, 0),
    };
  });

  readonly totalYearCostWithBase = computed(() => {
    const stats = this.yearStats();
    const meters = this.activeMeters();

    // Monate mit Daten pro Zähler summieren
    const baseTotal = meters.reduce((sum, meter) => {
      // Gekoppelte Gartenwasserzähler haben keine Grundgebühr
      if (meter.type === 'garden_water' && meter.linkedWaterMeterId) {
        return sum;
      }

      const monthsWithData = stats.months.filter(
        (m) => m.byMeter[meter.id] !== undefined,
      );

      const totalBaseChargeForMeter = monthsWithData.reduce((monthlySum, month) => {
        const tariff = this.tariffService.getActiveTariffForDate(
          meter,
          new Date(stats.year, month.month - 1),
        );
        return monthlySum + (tariff?.baseCharge ?? 0);
      }, 0);

      return sum + totalBaseChargeForMeter;
    }, 0);

    return stats.totalCost + baseTotal;
  });

  readonly totalYearCo2Kg = computed(() => {
    const year = this.selectedYear();
    return this.activeMeters().reduce((sum, meter) => {
      const summary = this.statsService.getMeterSummary(meter.id, year);
      return sum + (summary?.co2Kg ?? 0);
    }, 0);
  });

  readonly yearOverYearDiff = computed(() => {
    const currentYear = this.selectedYear();
    const prevYear = currentYear - 1;

    // Letzter Monat mit tatsächlichen Ablesedaten im aktuellen Jahr bestimmen
    const currentStats = this.yearStats();
    const currentMonthsWithData = currentStats.months.filter(
      (m) => Object.keys(m.byMeter).length > 0,
    );
    if (currentMonthsWithData.length === 0) return null;
    const maxMonth = Math.max(...currentMonthsWithData.map((m) => m.month));

    // Kosten aktuelles Jahr bis maxMonth (totalYearCostWithBase liefert exakt das)
    const currentCost = this.totalYearCostWithBase();

    // Vorjahres-Stats: nur Monate 1..maxMonth mit Ablesedaten berücksichtigen
    const prevStats = this.statsService.getYearStats(prevYear);
    const prevMonthsUpTo = prevStats.months.filter(
      (m) => m.month <= maxMonth && Object.keys(m.byMeter).length > 0,
    );
    if (prevMonthsUpTo.length === 0) return null;

    // Variable Kosten Vorjahr (nur die gefilterten Monate)
    const prevVariableCost = prevMonthsUpTo.reduce((sum, m) => sum + m.totalCost, 0);

    // Grundgebühren Vorjahr für dieselben Monate
    const meters = this.activeMeters();
    const prevBaseTotal = meters.reduce((sum, meter) => {
      if (meter.type === 'garden_water' && meter.linkedWaterMeterId) return sum;
      const monthsWithMeterData = prevMonthsUpTo.filter(
        (m) => m.byMeter[meter.id] !== undefined,
      );
      const baseForMeter = monthsWithMeterData.reduce((ms, month) => {
        const tariff = this.tariffService.getActiveTariffForDate(
          meter,
          new Date(prevStats.year, month.month - 1),
        );
        return ms + (tariff?.baseCharge ?? 0);
      }, 0);
      return sum + baseForMeter;
    }, 0);

    const prevCost = prevVariableCost + prevBaseTotal;
    if (prevCost === 0) return null;

    const percent = ((currentCost - prevCost) / prevCost) * 100;
    return { percent, prevYear, upToMonth: maxMonth };
  });

  // ============ HILFSMETHODEN ============
  getYearTotalCost(year: number): number {
    const stats = this.statsService.getYearStats(year);
    const meters = this.activeMeters();

    // Monate mit Daten pro Zähler summieren
    const baseTotal = meters.reduce((sum, meter) => {
      // Gekoppelte Gartenwasserzähler haben keine Grundgebühr
      if (meter.type === 'garden_water' && meter.linkedWaterMeterId) {
        return sum;
      }

      const monthsWithData = stats.months.filter(
        (m) => m.byMeter[meter.id] !== undefined,
      );

      const totalBaseChargeForMeter = monthsWithData.reduce((monthlySum, month) => {
        const tariff = this.tariffService.getActiveTariffForDate(
          meter,
          new Date(stats.year, month.month - 1),
        );
        return monthlySum + (tariff?.baseCharge ?? 0);
      }, 0);

      return sum + totalBaseChargeForMeter;
    }, 0);

    return stats.totalCost + baseTotal;
  }

  readonly costPreview = computed(() => {
    const year = this.selectedYear();
    const stats = this.yearStats();
    const meters = this.activeMeters();

    // Monate mit Daten im aktuellen Jahr
    const currentMonthsWithData = stats.months.filter(m => Object.keys(m.byMeter).length > 0);

    // Daten vom Vorjahr holen
    const prevYear = year - 1;
    const prevStats = this.statsService.getYearStats(prevYear);
    const prevMonthsWithData = prevStats.months.filter(m => Object.keys(m.byMeter).length > 0);

    // Kombinierte Monate für Durchschnittsberechnung
    const allMonthsData = [...prevMonthsWithData, ...currentMonthsWithData];

    if (allMonthsData.length === 0) return null;

    // Pro Zähler berechnen (nur Zähler, die nicht verknüpfte Gartenwasserzähler sind)
    const relevantMeters = meters.filter(meter => !(meter.type === 'garden_water' && meter.linkedWaterMeterId));
    const meterPreviews = relevantMeters.map(meter => {
      // Monate mit Daten für diesen Zähler
      const currentMeterMonths = currentMonthsWithData.filter(m => m.byMeter[meter.id]);
      const prevMeterMonths = prevMonthsWithData.filter(m => m.byMeter[meter.id]);
      const allMeterMonths = [...prevMeterMonths, ...currentMeterMonths];

      if (allMeterMonths.length === 0) {
        return {
          meter,
          avgMonthlyVariable: 0,
          projectedVariableCost: 0,
          baseChargeYearly: 0,
          projectedTotal: 0,
          monthsUsed: 0,
          currentMonthsUsed: 0,
          prevMonthsUsed: 0,
        };
      }

      // Durchschnittliche variable Kosten pro Monat für diesen Zähler
      const avgMonthlyVariable = allMeterMonths.reduce((sum, m) => sum + (m.byMeter[meter.id]?.cost ?? 0), 0) / allMeterMonths.length;

      // Prognostizierte variable Kosten für 12 Monate
      const projectedVariableCost = avgMonthlyVariable * 12;

      // Grundgebühren für 12 Monate (nur wenn nicht Gartenwasser)
      const baseChargeYearly = (meter.type === 'garden_water' && meter.linkedWaterMeterId) ? 0 :
        (this.tariffService.getActiveTariffForDate(meter, new Date(year, 0, 1))?.baseCharge ?? 0) * 12;

      // Gesamtprognose für diesen Zähler
      const projectedTotal = projectedVariableCost + baseChargeYearly;

      return {
        meter,
        avgMonthlyVariable,
        projectedVariableCost,
        baseChargeYearly,
        projectedTotal,
        monthsUsed: allMeterMonths.length,
        currentMonthsUsed: currentMeterMonths.length,
        prevMonthsUsed: prevMeterMonths.length,
      };
    });

    // Gesamtsummen
    const totalProjectedCost = meterPreviews.reduce((sum, mp) => sum + mp.projectedTotal, 0);
    const totalAvgMonthlyVariable = meterPreviews.reduce((sum, mp) => sum + mp.avgMonthlyVariable, 0);
    const totalBaseCharge = meterPreviews.reduce((sum, mp) => sum + mp.baseChargeYearly, 0);

    return {
      projectedCost: totalProjectedCost,
      avgMonthlyVariable: totalAvgMonthlyVariable,
      totalBaseCharge,
      monthsUsed: allMonthsData.length,
      currentMonthsUsed: currentMonthsWithData.length,
      prevMonthsUsed: prevMonthsWithData.length,
      meterPreviews,
    };
  });

  readonly budgetAlerts = this.statsService.budgetAlerts;

  getActiveTariff(meter: MeterConfig): TariffPeriod | null {
    if (meter.type === 'garden_water' && meter.linkedWaterMeterId) {
      return null;
    }
    return this.tariffService.getActiveTariffForDate(meter, new Date());
  }

  getMeta(type: string) {
    return ENERGY_META[type as keyof typeof ENERGY_META];
  }

  getMeterById(id: string) {
    return this.meterService.getMeter(id);
  }

  latestReading(meterId: string) {
    return this.readingService.latestReadings().get(meterId);
  }

  getMonthStats(year: number) {
    return this.statsService.getMonthStats(year);
  }
}