import { describe, it, expect } from 'vitest';
import { AdvancePaymentYear, EnergyType, MeterConfig, TariffPeriod } from '../models/energy.models';
import {
  calculateCostPreview,
  isLinkedGardenWater,
  sumAdvancePayments,
  sumCostForecast,
} from './cost-preview.calc';

function tariff(validFrom: string, pricePerUnit: number, baseCharge: number): TariffPeriod {
  return { id: validFrom, validFrom: new Date(`${validFrom}T00:00:00`), pricePerUnit, baseCharge };
}

function meter(overrides: Partial<MeterConfig> = {}): MeterConfig {
  return {
    id: 'meter-1',
    name: 'Strom',
    type: EnergyType.Electricity,
    unit: 'kWh',
    icon: 'bolt',
    color: '#FFD600',
    active: true,
    createdAt: new Date('2024-01-01'),
    tariffHistory: [tariff('2025-01-01', 0.3, 10)],
    ...overrides,
  };
}

function entry(year: number, consumption: number, amounts: (number | null)[]): AdvancePaymentYear {
  return {
    year,
    estimatedConsumption: consumption,
    payments: amounts.map((amount, i) => ({ month: i + 1, amount })),
  };
}

describe('sumAdvancePayments', () => {
  it('treats empty amounts as 0 €', () => {
    expect(
      sumAdvancePayments([
        { month: 1, amount: 100 },
        { month: 2, amount: null },
        { month: 3, amount: 50.5 },
      ]),
    ).toBe(150.5);
  });
});

describe('calculateCostPreview', () => {
  it('computes a full year with one tariff', () => {
    // 3650 kWh × 0,30 € + 12 × 10 € = 1095 + 120
    const res = calculateCostPreview(meter(), entry(2026, 3650, Array(12).fill(100)))!;

    expect(res.periods).toHaveLength(1);
    expect(res.periods[0].days).toBe(365);
    expect(res.totalCost).toBeCloseTo(1215, 6);
    expect(res.totalPayment).toBe(1200);
    expect(res.balance).toBeCloseTo(-15, 6);
  });

  it('splits the year at a tariff change', () => {
    const m = meter({
      tariffHistory: [tariff('2025-01-01', 0.3, 10), tariff('2026-07-01', 0.4, 12)],
    });

    const res = calculateCostPreview(m, entry(2026, 3650, [1500]))!;

    expect(res.periods.map((p) => p.days)).toEqual([181, 184]);
    expect(res.periods[0].consumption + res.periods[1].consumption).toBeCloseTo(3650, 6);
    const expected = 1810 * 0.3 + (120 / 365) * 181 + 1840 * 0.4 + (144 / 365) * 184;
    expect(res.totalCost).toBeCloseTo(expected, 6);
    expect(res.balance).toBeGreaterThan(0);
  });

  it('uses connected load and emission price for district heating', () => {
    const m = meter({
      type: EnergyType.Fernwärme,
      unit: 'MWh',
      connectedLoadKw: 15,
      tariffHistory: [{ ...tariff('2025-01-01', 100, 0), basePricePerKw: 20, emissionPrice: 10 }],
    });

    const res = calculateCostPreview(m, entry(2026, 10, [0]))!;

    // 15 kW × 20 € + 10 MWh × (100 + 10) €
    expect(res.totalCost).toBeCloseTo(300 + 1100, 6);
  });

  it('returns null when no tariff applies in the year', () => {
    const m = meter({ tariffHistory: [tariff('2030-01-01', 0.3, 10)] });
    expect(calculateCostPreview(m, entry(2026, 1000, [100]))).toBeNull();
    expect(calculateCostPreview(meter({ tariffHistory: [] }), entry(2026, 1000, [100]))).toBeNull();
  });
});

describe('sumCostForecast', () => {
  const linkedGarden = meter({
    id: 'garden',
    type: EnergyType.GardenWater,
    unit: 'm³',
    linkedWaterMeterId: 'water',
    advancePayments: [entry(2026, 100, [500])],
  });

  it('adds up all meters with payments for the year', () => {
    const a = meter({ id: 'a', advancePayments: [entry(2026, 3650, Array(12).fill(100))] });
    const b = meter({ id: 'b', advancePayments: [entry(2026, 365, Array(12).fill(20))] });
    const none = meter({ id: 'c' });

    const res = sumCostForecast([a, b, none], 2026)!;

    // a: 1215 €, b: 365 × 0,30 + 120 = 229,50 €
    expect(res.totalCost).toBeCloseTo(1444.5, 6);
    expect(res.totalPayment).toBe(1440);
    expect(res.balance).toBeCloseTo(-4.5, 6);
    expect(res.metersIncluded).toBe(2);
    expect(res.metersTotal).toBe(3);
  });

  it('ignores garden water linked to a main water meter', () => {
    expect(isLinkedGardenWater(linkedGarden)).toBe(true);
    expect(sumCostForecast([linkedGarden], 2026)).toBeNull();

    const a = meter({ id: 'a', advancePayments: [entry(2026, 3650, Array(12).fill(100))] });
    expect(sumCostForecast([a, linkedGarden], 2026)!.metersTotal).toBe(1);
  });

  it('returns null when no meter has payments for the year', () => {
    const a = meter({ advancePayments: [entry(2025, 1000, [100])] });
    expect(sumCostForecast([a], 2026)).toBeNull();
  });
});
