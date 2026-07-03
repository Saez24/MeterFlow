import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal, computed, provideZonelessChangeDetection } from '@angular/core';
import { StatsService } from './stats.service';
import { MeterService } from './meter.service';
import { ReadingService } from './reading.service';
import { TariffService } from './tariff.service';
import { MeterConfig, MeterReading, EnergyType, TariffPeriod } from '../models/energy.models';

// ── Shared reactive state (reset in beforeEach) ──────────────────────────────
const metersSignal = signal<MeterConfig[]>([]);
const readingsSignal = signal<MeterReading[]>([]);

const mockMeterService = {
  meters: metersSignal,
  loading: signal(false),
  activeMeters: computed(() => metersSignal().filter((m) => m.active)),
  getMeter: (id: string) => metersSignal().find((m) => m.id === id),
};

const mockReadingService = {
  readings: readingsSignal,
  loading: signal(false),
  readingsByMeter: computed(() => {
    const map = new Map<string, MeterReading[]>();
    for (const r of readingsSignal()) {
      const list = map.get(r.meterId) ?? [];
      list.push(r);
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      map.set(r.meterId, list);
    }
    return map;
  }),
  getReadingsForMeter: (meterId: string) => readingsSignal().filter((r) => r.meterId === meterId),
};

const mockTariffService = {
  getActiveTariffForDate: (meter: MeterConfig, date: Date): TariffPeriod | null => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const sorted = (meter.tariffHistory ?? [])
      .filter((p) => {
        const from = new Date(p.validFrom);
        from.setHours(0, 0, 0, 0);
        if (from > d) return false;
        if (p.validTo) {
          const to = new Date(p.validTo);
          to.setHours(0, 0, 0, 0);
          if (to < d) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());
    return sorted[0] ?? null;
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const ELEC_METER: MeterConfig = {
  id: 'meter-1',
  name: 'Strom',
  type: 'electricity' as EnergyType,
  unit: 'kWh',
  icon: 'bolt',
  color: '#FFD600',
  active: true,
  createdAt: new Date('2024-01-01'),
};

function makeReading(
  id: string,
  meterId: string,
  date: string,
  value: number,
  extras: Partial<MeterReading> = {},
): MeterReading {
  return { id, meterId, date: new Date(date), value, ...extras };
}

function padMonth(m: number): string {
  return String(m).padStart(2, '0');
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('StatsService', () => {
  let service: StatsService;

  beforeEach(() => {
    metersSignal.set([]);
    readingsSignal.set([]);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        StatsService,
        { provide: MeterService, useValue: mockMeterService },
        { provide: ReadingService, useValue: mockReadingService },
        { provide: TariffService, useValue: mockTariffService },
      ],
    });
    service = TestBed.inject(StatsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── getMonthStats ───────────────────────────────────────────────────────────
  describe('getMonthStats', () => {
    it('always returns exactly 12 month entries', () => {
      metersSignal.set([ELEC_METER]);
      expect(service.getMonthStats(2024)).toHaveLength(12);
    });

    it('returns empty byMeter and zero totalCost when no readings', () => {
      metersSignal.set([ELEC_METER]);
      const stats = service.getMonthStats(2024);
      for (const s of stats) {
        expect(s.byMeter).toEqual({});
        expect(s.totalCost).toBe(0);
      }
    });

    it('uses pre-computed consumption and totalCost from a reading', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([
        makeReading('r1', 'meter-1', '2024-03-15', 1000, { consumption: 100, totalCost: 30 }),
      ]);
      const march = service.getMonthStats(2024).find((s) => s.month === 3)!;
      expect(march.byMeter['meter-1']).toEqual({ consumption: 100, cost: 30, unit: 'kWh' });
      expect(march.totalCost).toBe(30);
    });

    it('calculates cost via tariff when totalCost is absent', () => {
      const meterWithTariff: MeterConfig = {
        ...ELEC_METER,
        tariffHistory: [
          { id: 't1', validFrom: new Date('2024-01-01'), pricePerUnit: 0.3, baseCharge: 0 },
        ],
      };
      metersSignal.set([meterWithTariff]);
      // Two readings in the same month → consumption = 1000 - 900 = 100
      readingsSignal.set([
        makeReading('r2', 'meter-1', '2024-03-31', 1000),
        makeReading('r1', 'meter-1', '2024-03-01', 900),
      ]);
      const march = service.getMonthStats(2024).find((s) => s.month === 3)!;
      expect(march.byMeter['meter-1'].consumption).toBe(100);
      expect(march.byMeter['meter-1'].cost).toBeCloseTo(30);
    });

    it('ignores readings from other months', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([
        makeReading('r1', 'meter-1', '2024-05-10', 500, { consumption: 200, totalCost: 60 }),
      ]);
      const march = service.getMonthStats(2024).find((s) => s.month === 3)!;
      const may = service.getMonthStats(2024).find((s) => s.month === 5)!;
      expect(march.byMeter['meter-1']).toBeUndefined();
      expect(may.byMeter['meter-1']).toBeDefined();
    });

    it('ignores readings from other years', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([
        makeReading('r1', 'meter-1', '2023-06-10', 500, { consumption: 100, totalCost: 30 }),
      ]);
      const stats = service.getMonthStats(2024);
      expect(stats.every((s) => Object.keys(s.byMeter).length === 0)).toBe(true);
    });

    it('accumulates cost from multiple meters', () => {
      const waterMeter: MeterConfig = {
        ...ELEC_METER,
        id: 'meter-2',
        name: 'Wasser',
        type: 'water' as EnergyType,
        unit: 'm³',
        icon: 'water_drop',
      };
      metersSignal.set([ELEC_METER, waterMeter]);
      readingsSignal.set([
        makeReading('r1', 'meter-1', '2024-06-15', 1000, { consumption: 100, totalCost: 30 }),
        makeReading('r2', 'meter-2', '2024-06-15', 50, { consumption: 10, totalCost: 20 }),
      ]);
      const june = service.getMonthStats(2024).find((s) => s.month === 6)!;
      expect(june.totalCost).toBeCloseTo(50);
    });
  });

  // ── getYearStats ────────────────────────────────────────────────────────────
  describe('getYearStats', () => {
    it('aggregates consumption and cost across all months', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([
        makeReading('r1', 'meter-1', '2024-01-15', 100, { consumption: 50, totalCost: 15 }),
        makeReading('r2', 'meter-1', '2024-06-15', 300, { consumption: 75, totalCost: 22.5 }),
      ]);
      const year = service.getYearStats(2024);
      expect(year.byMeter['meter-1'].consumption).toBe(125);
      expect(year.byMeter['meter-1'].cost).toBeCloseTo(37.5);
      expect(year.totalCost).toBeCloseTo(37.5);
    });

    it('returns empty byMeter and zero totalCost when there are no readings', () => {
      metersSignal.set([ELEC_METER]);
      const year = service.getYearStats(2024);
      expect(year.byMeter).toEqual({});
      expect(year.totalCost).toBe(0);
    });

    it('includes reference to the 12 MonthStats entries', () => {
      const year = service.getYearStats(2024);
      expect(year.months).toHaveLength(12);
      expect(year.year).toBe(2024);
    });
  });

  // ── dashboardStats ──────────────────────────────────────────────────────────
  describe('dashboardStats', () => {
    it('returns empty object when no active meters', () => {
      metersSignal.set([]);
      expect(service.dashboardStats()).toEqual({});
    });

    it('reads consumption and cost from the latest reading', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([
        makeReading('r2', 'meter-1', '2024-06-15', 1000, { consumption: 120, totalCost: 36 }),
        makeReading('r1', 'meter-1', '2024-05-15', 880, { consumption: 100, totalCost: 30 }),
      ]);
      const stats = service.dashboardStats();
      expect(stats['meter-1'].consumption).toBe(120);
      expect(stats['meter-1'].cost).toBe(36);
      expect(stats['meter-1'].unit).toBe('kWh');
    });

    it('calculates trend when at least 4 readings are available', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([
        makeReading('r4', 'meter-1', '2024-06-15', 1300, { consumption: 200, totalCost: 60 }),
        makeReading('r3', 'meter-1', '2024-05-15', 1100, { consumption: 100, totalCost: 30 }),
        makeReading('r2', 'meter-1', '2024-04-15', 1000, { consumption: 100, totalCost: 30 }),
        makeReading('r1', 'meter-1', '2024-03-15', 900, { consumption: 100, totalCost: 30 }),
      ]);
      // trend = ((200 - 100) / 100) * 100 = +100 %
      expect(service.dashboardStats()['meter-1'].trend).toBeCloseTo(100);
    });

    it('returns zero trend when fewer than 4 readings', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([
        makeReading('r2', 'meter-1', '2024-06-15', 1000, { consumption: 120, totalCost: 36 }),
        makeReading('r1', 'meter-1', '2024-05-15', 880, { consumption: 100, totalCost: 30 }),
      ]);
      expect(service.dashboardStats()['meter-1'].trend).toBe(0);
    });
  });

  // ── budgetAlerts ────────────────────────────────────────────────────────────
  describe('budgetAlerts', () => {
    const Y = new Date().getFullYear();
    const M = padMonth(new Date().getMonth() + 1);

    it('returns empty array when no meters have a budget', () => {
      metersSignal.set([ELEC_METER]);
      expect(service.budgetAlerts()).toEqual([]);
    });

    it('generates monthly_cost alert when threshold is exceeded', () => {
      const meter: MeterConfig = {
        ...ELEC_METER,
        budget: { monthlyLimit: 100, alertAt: 80 },
      };
      metersSignal.set([meter]);
      // 95 € of 100 € = 95 %
      readingsSignal.set([makeReading('r1', 'meter-1', `${Y}-${M}-15`, 200, { consumption: 100, totalCost: 95 })]);
      const alerts = service.budgetAlerts();
      const alert = alerts.find((a) => a.type === 'monthly_cost');
      expect(alert).toBeDefined();
      expect(alert!.percent).toBeCloseTo(95);
      expect(alert!.critical).toBe(false);
    });

    it('marks alert as critical when usage is at or above 100 %', () => {
      const meter: MeterConfig = {
        ...ELEC_METER,
        budget: { monthlyLimit: 50, alertAt: 80 },
      };
      metersSignal.set([meter]);
      // 60 € of 50 € = 120 %
      readingsSignal.set([makeReading('r1', 'meter-1', `${Y}-${M}-10`, 200, { consumption: 100, totalCost: 60 })]);
      const alert = service.budgetAlerts().find((a) => a.type === 'monthly_cost');
      expect(alert!.critical).toBe(true);
    });

    it('does not generate an alert below the alertAt threshold', () => {
      const meter: MeterConfig = {
        ...ELEC_METER,
        budget: { monthlyLimit: 200, alertAt: 80 },
      };
      metersSignal.set([meter]);
      // 50 € of 200 € = 25 % → below threshold
      readingsSignal.set([makeReading('r1', 'meter-1', `${Y}-${M}-10`, 200, { consumption: 100, totalCost: 50 })]);
      expect(service.budgetAlerts()).toEqual([]);
    });

    it('sorts alerts by percent descending', () => {
      const meterA: MeterConfig = { ...ELEC_METER, id: 'a', budget: { monthlyLimit: 100, alertAt: 50 } };
      const meterB: MeterConfig = { ...ELEC_METER, id: 'b', budget: { monthlyLimit: 100, alertAt: 50 } };
      metersSignal.set([meterA, meterB]);
      readingsSignal.set([
        makeReading('r1', 'a', `${Y}-${M}-10`, 100, { consumption: 60, totalCost: 60 }),  // 60 %
        makeReading('r2', 'b', `${Y}-${M}-10`, 100, { consumption: 90, totalCost: 90 }),  // 90 %
      ]);
      const alerts = service.budgetAlerts();
      expect(alerts[0].percent).toBeGreaterThan(alerts[1].percent);
    });
  });
});
