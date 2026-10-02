import { AdvancePayment, AdvancePaymentYear, MeterConfig } from '../models/energy.models';

const DAY_MS = 1000 * 3600 * 24;

export interface CostPreviewPeriod {
  name: string;
  startDate: Date;
  endDate: Date;
  days: number;
  consumption: number;
  pricePerUnit: number;
  baseCharge: number;
  cost: number;
}

export interface CostPreviewResult {
  totalCost: number;
  totalPayment: number;
  balance: number; // > 0 Erstattung, < 0 Nachzahlung
  periods: CostPreviewPeriod[];
}

/** Summe der Abschläge; leere Beträge zählen als 0 €. */
export function sumAdvancePayments(payments: readonly AdvancePayment[]): number {
  return payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
}

/** Gespeicherter Abschlags-Eintrag eines Zählers für ein Kalenderjahr. */
export function advancePaymentsForYear(
  meter: MeterConfig,
  year: number,
): AdvancePaymentYear | null {
  return meter.advancePayments?.find((e) => e.year === year) ?? null;
}

/** Ein mit dem Hauptwasserzähler verknüpfter Gartenwasserzähler wird dort abgerechnet. */
export function isLinkedGardenWater(meter: MeterConfig): boolean {
  return meter.type === 'garden_water' && !!meter.linkedWaterMeterId;
}

/**
 * Prognostiziert die Jahreskosten eines Zählers aus dem geschätzten
 * Jahresverbrauch und den Tarifen des Jahres und stellt sie den Abschlägen
 * gegenüber. Liefert null, wenn im Jahr kein Tarif gilt.
 */
export function calculateCostPreview(
  meter: MeterConfig,
  entry: AdvancePaymentYear,
): CostPreviewResult | null {
  const { year, estimatedConsumption: consumption } = entry;
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const daysInYear = Math.round((yearEnd.getTime() - yearStart.getTime()) / DAY_MS) + 1;

  const sortedTariffs = [...(meter.tariffHistory ?? [])].sort(
    (a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime(),
  );

  const periods: CostPreviewPeriod[] = [];
  let lastDate = yearStart;

  for (let i = 0; i < sortedTariffs.length; i++) {
    const tariff = sortedTariffs[i];
    const validFrom = new Date(tariff.validFrom);
    validFrom.setHours(0, 0, 0, 0);

    if (validFrom > yearEnd) continue;

    const startDate = validFrom > lastDate ? validFrom : lastDate;

    let endDate = yearEnd;
    if (i + 1 < sortedTariffs.length) {
      const nextValidFrom = new Date(sortedTariffs[i + 1].validFrom);
      nextValidFrom.setHours(0, 0, 0, 0);
      const dayBefore = new Date(nextValidFrom);
      dayBefore.setDate(dayBefore.getDate() - 1);
      if (dayBefore < endDate) endDate = dayBefore;
    }

    if (startDate > endDate) continue;

    const days = Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
    const periodConsumption = (consumption / daysInYear) * days;

    let baseCharge: number;
    let consumptionCost: number;

    if (meter.type === 'fernwarme') {
      const connectedKw = Math.max(0, meter.connectedLoadKw ?? 10);
      const annualFixed = connectedKw * (tariff.basePricePerKw ?? 0);
      baseCharge = (annualFixed / daysInYear) * days;
      consumptionCost = periodConsumption * (tariff.pricePerUnit + (tariff.emissionPrice ?? 0));
    } else {
      baseCharge = ((tariff.baseCharge * 12) / daysInYear) * days;
      consumptionCost = periodConsumption * tariff.pricePerUnit;
    }

    periods.push({
      name: `Tarif vom ${validFrom.toLocaleDateString('de-DE')}`,
      startDate,
      endDate,
      days,
      consumption: periodConsumption,
      pricePerUnit: tariff.pricePerUnit,
      baseCharge,
      cost: baseCharge + consumptionCost,
    });

    lastDate = new Date(endDate);
    lastDate.setDate(lastDate.getDate() + 1);
    if (lastDate > yearEnd) break;
  }

  if (periods.length === 0) return null;

  const totalCost = periods.reduce((sum, p) => sum + p.cost, 0);
  const totalPayment = sumAdvancePayments(entry.payments);

  return { totalCost, totalPayment, balance: totalPayment - totalCost, periods };
}

export interface CostForecastSummary {
  totalCost: number;
  totalPayment: number;
  balance: number; // > 0 Erstattung, < 0 Nachzahlung
  metersIncluded: number;
  metersTotal: number;
}

/**
 * Addiert die Kostenvorschauen aller Zähler mit gepflegten Abschlägen für ein
 * Jahr. Verknüpfte Gartenwasserzähler laufen über den Hauptwasserzähler und
 * zählen nicht mit. Liefert null, wenn kein Zähler eine Vorschau hat.
 */
export function sumCostForecast(
  meters: readonly MeterConfig[],
  year: number,
): CostForecastSummary | null {
  const relevant = meters.filter((m) => !isLinkedGardenWater(m));

  let totalCost = 0;
  let totalPayment = 0;
  let metersIncluded = 0;
  for (const meter of relevant) {
    const entry = advancePaymentsForYear(meter, year);
    const result = entry ? calculateCostPreview(meter, entry) : null;
    if (!result) continue;
    totalCost += result.totalCost;
    totalPayment += result.totalPayment;
    metersIncluded++;
  }

  if (metersIncluded === 0) return null;
  return {
    totalCost,
    totalPayment,
    balance: totalPayment - totalCost,
    metersIncluded,
    metersTotal: relevant.length,
  };
}
