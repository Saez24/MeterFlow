import { GAS_DEFAULTS } from '../constants/gas.constants';
import {
  AdvancePaymentYear,
  BudgetConfig,
  EnergyType,
  MaterialIcon,
} from '../models/energy.models';

/**
 * Demo data for guest accounts (branch `supabase`). Produces a payload in the
 * export format that ApiService.importData accepts. Deterministic apart from
 * the ids (fresh per call — primary keys are global, guests must not collide)
 * and relative to `today`, so every guest sees two years of recent history.
 *
 * Derived values (consumption, kWh, cost, …) use the exact formulas and
 * operation order of ReadingService.recalculateAllReadingsForMeter, so the app
 * shows correct numbers right away (verified in demo-data.spec.ts).
 */

export interface DemoTariff {
  id: string;
  validFrom: string;
  validTo?: string;
  pricePerUnit: number;
  baseCharge: number;
  wastewaterPrice?: number;
  emissionPrice?: number;
  basePricePerKw?: number;
}

export interface DemoMeter {
  id: string;
  name: string;
  type: EnergyType;
  unit: string;
  icon: MaterialIcon;
  color: string;
  active: boolean;
  calorificValue?: number;
  zNumber?: number;
  connectedLoadKw?: number;
  linkedWaterMeterId?: string;
  meterNumber?: string;
  provider?: string;
  tariffHistory: DemoTariff[];
  budget?: BudgetConfig;
  advancePayments: AdvancePaymentYear[];
}

export interface DemoReading {
  id: string;
  meterId: string;
  date: string; // YYYY-MM-DD
  value: number;
  note?: string;
  consumption: number;
  kwh?: number;
  cost: number;
  wastewaterCost?: number;
  totalCost: number;
}

export interface DemoData {
  meters: DemoMeter[];
  readings: DemoReading[];
}

const HISTORY_MONTHS = 24;

/** Seasonal factor: 1 in January, -1 in July. */
const season = (month: number): number => Math.cos((2 * Math.PI * month) / 12);
const round = (v: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
const utc = (year: number, month: number, day: number): Date =>
  new Date(Date.UTC(year, month, day));

interface MeterSpec {
  meter: DemoMeter;
  start: number;
  digits: number;
  /** Consumption for a calendar month (0 = January). */
  monthly: (month: number) => number;
}

export function buildDemoData(today: Date): DemoData {
  const year = today.getFullYear();
  const month = today.getMonth();
  // Monthly readings on the 1st, from 24 months ago up to the current month.
  const dates = Array.from({ length: HISTORY_MONTHS + 1 }, (_, i) =>
    utc(year, month - HISTORY_MONTHS + i, 1),
  );
  // Tariff change on the 15th (never on a reading date) about a year ago.
  const firstTariffFrom = isoDate(utc(year, month - HISTORY_MONTHS - 1, 15));
  const tariffChange = utc(year, month - 12, 15);
  const tariffChangeFrom = isoDate(tariffChange);
  const firstTariffTo = isoDate(utc(year, month - 12, 14));

  const tariffs = (
    older: Omit<DemoTariff, 'id' | 'validFrom' | 'validTo'>,
    newer: Omit<DemoTariff, 'id' | 'validFrom' | 'validTo'>,
  ): DemoTariff[] => [
    { id: crypto.randomUUID(), validFrom: firstTariffFrom, validTo: firstTariffTo, ...older },
    { id: crypto.randomUUID(), validFrom: tariffChangeFrom, ...newer },
  ];

  const monthlyPayments = (amount: number) =>
    Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount }));

  const waterId = crypto.randomUUID();

  const specs: MeterSpec[] = [
    {
      meter: {
        id: crypto.randomUUID(),
        name: 'Strom Haushalt',
        type: EnergyType.Electricity,
        unit: 'kWh',
        icon: 'bolt',
        color: '#F59E0B',
        active: true,
        meterNumber: '1ESY1160012345',
        provider: 'Stadtwerke Demo',
        tariffHistory: tariffs(
          { pricePerUnit: 0.36, baseCharge: 12.5 },
          { pricePerUnit: 0.32, baseCharge: 13.9 },
        ),
        budget: { monthlyLimit: 100, alertAt: 80 },
        advancePayments: [
          { year, estimatedConsumption: 3000, interval: 1, payments: monthlyPayments(85) },
        ],
      },
      start: 12_000,
      digits: 1,
      monthly: (m) => 250 + 50 * season(m),
    },
    {
      meter: {
        id: crypto.randomUUID(),
        name: 'Gas Heizung',
        type: EnergyType.Gas,
        unit: 'm³',
        icon: 'local_fire_department',
        color: '#3B82F6',
        active: true,
        calorificValue: 10.3,
        zNumber: 0.95,
        provider: 'Stadtwerke Demo',
        tariffHistory: tariffs(
          { pricePerUnit: 0.12, baseCharge: 15 },
          { pricePerUnit: 0.1, baseCharge: 15 },
        ),
        advancePayments: [
          { year, estimatedConsumption: 1200, interval: 1, payments: monthlyPayments(110) },
        ],
      },
      start: 4_300,
      digits: 1,
      monthly: (m) => 100 + 80 * season(m),
    },
    {
      meter: {
        id: waterId,
        name: 'Wasser',
        type: EnergyType.Water,
        unit: 'm³',
        icon: 'water_drop',
        color: '#06B6D4',
        active: true,
        provider: 'Wasserwerk Demo',
        tariffHistory: tariffs(
          { pricePerUnit: 2.1, baseCharge: 5, wastewaterPrice: 2.6 },
          { pricePerUnit: 2.3, baseCharge: 5, wastewaterPrice: 2.8 },
        ),
        advancePayments: [
          {
            year,
            estimatedConsumption: 110,
            estimatedGardenConsumption: 15,
            interval: 3,
            payments: [2, 5, 8, 11].map((m) => ({ month: m, amount: 90 })),
          },
        ],
      },
      start: 610,
      digits: 2,
      monthly: (m) => 9 - 2 * season(m),
    },
    {
      meter: {
        id: crypto.randomUUID(),
        name: 'Gartenwasser',
        type: EnergyType.GardenWater,
        unit: 'm³',
        icon: 'yard',
        color: '#10B981',
        active: true,
        linkedWaterMeterId: waterId,
        tariffHistory: [],
        advancePayments: [],
      },
      start: 35,
      digits: 2,
      monthly: (m) => Math.max(0, -5 * season(m)),
    },
    {
      meter: {
        id: crypto.randomUUID(),
        name: 'Fernwärme',
        type: EnergyType.Fernwärme,
        unit: 'MWh',
        icon: 'local_fire_department',
        color: '#EAB308',
        active: true,
        connectedLoadKw: 12,
        provider: 'Fernwärme Demo',
        tariffHistory: tariffs(
          { pricePerUnit: 95, baseCharge: 0, emissionPrice: 8, basePricePerKw: 30 },
          { pricePerUnit: 105, baseCharge: 0, emissionPrice: 9, basePricePerKw: 32 },
        ),
        advancePayments: [
          { year, estimatedConsumption: 10.8, interval: 1, payments: monthlyPayments(120) },
        ],
      },
      start: 120,
      digits: 3,
      monthly: (m) => 0.9 + 0.7 * season(m),
    },
  ];

  // Raw readings per meter (value chain), then derived values.
  const raw = new Map<string, DemoReading[]>();
  for (const spec of specs) {
    let value = spec.start;
    raw.set(
      spec.meter.id,
      dates.map((date, i) => {
        if (i > 0) {
          // Consumption of the month that ended on this reading date.
          value = round(
            value + spec.monthly(date.getUTCMonth() === 0 ? 11 : date.getUTCMonth() - 1),
            spec.digits,
          );
        }
        return {
          id: crypto.randomUUID(),
          meterId: spec.meter.id,
          date: isoDate(date),
          value,
          consumption: 0,
          cost: 0,
          totalCost: 0,
        };
      }),
    );
  }

  const readings: DemoReading[] = [];
  for (const { meter } of specs) {
    const list = raw.get(meter.id)!;
    for (let i = 0; i < list.length; i++) {
      const current = list[i];
      const prev = i > 0 ? list[i - 1] : null;
      readings.push({ ...current, ...computeReading(meter, current, prev, specs, raw) });
    }
  }
  readings[readings.length - 1].note = 'Demo: zuletzt abgelesen';

  return { meters: specs.map((s) => s.meter), readings };
}

/** Same formulas and operation order as ReadingService.recalculateAllReadingsForMeter. */
function computeReading(
  meter: DemoMeter,
  current: DemoReading,
  prev: DemoReading | null,
  specs: MeterSpec[],
  raw: Map<string, DemoReading[]>,
): Pick<DemoReading, 'consumption' | 'kwh' | 'cost' | 'wastewaterCost' | 'totalCost'> {
  const consumption = prev ? current.value - prev.value : 0;
  let kwh: number | undefined;
  let cost = 0;
  let wastewaterCost: number | undefined;

  const tariff = activeTariff(meter, current.date);
  if (tariff) {
    if (meter.type === EnergyType.Gas) {
      const calorificValue = meter.calorificValue ?? GAS_DEFAULTS.CALORIFIC_VALUE;
      const zNumber = meter.zNumber ?? GAS_DEFAULTS.Z_NUMBER;
      kwh = consumption * calorificValue * zNumber;
      cost = kwh * tariff.pricePerUnit;
    } else if (meter.type === EnergyType.Water) {
      cost = consumption * tariff.pricePerUnit;
      const gardenM3 = prev ? gardenConsumption(meter.id, prev.date, current.date, specs, raw) : 0;
      const wc = Math.max(0, consumption - gardenM3) * (tariff.wastewaterPrice ?? 0);
      wastewaterCost = wc > 0 ? wc : undefined;
    } else if (meter.type === EnergyType.Fernwärme) {
      const days = prev
        ? (new Date(current.date).getTime() - new Date(prev.date).getTime()) / 86_400_000
        : 0;
      const connectedKw = Math.max(0, meter.connectedLoadKw ?? 10);
      const annualFixed = connectedKw * (tariff.basePricePerKw ?? 0);
      const pricePerMWh = tariff.pricePerUnit + (tariff.emissionPrice ?? 0);
      cost = (annualFixed / 365) * days + consumption * pricePerMWh;
    } else {
      cost = consumption * tariff.pricePerUnit;
    }
  }

  return { consumption, kwh, cost, wastewaterCost, totalCost: cost + (wastewaterCost ?? 0) };
}

function activeTariff(meter: DemoMeter, date: string): DemoTariff | null {
  const candidates = meter.tariffHistory
    .filter((t) => t.validFrom <= date && (!t.validTo || t.validTo >= date))
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  return candidates[0] ?? null;
}

/** Same as ReadingService.getGardenWaterConsumptionForPeriod. */
function gardenConsumption(
  mainMeterId: string,
  from: string,
  to: string,
  specs: MeterSpec[],
  raw: Map<string, DemoReading[]>,
): number {
  let total = 0;
  for (const { meter } of specs) {
    if (meter.type !== EnergyType.GardenWater || meter.linkedWaterMeterId !== mainMeterId) continue;
    const list = (raw.get(meter.id) ?? []).filter((r) => r.date >= from && r.date <= to);
    for (let i = 0; i < list.length - 1; i++) {
      total += list[i + 1].value - list[i].value;
    }
  }
  return total;
}
