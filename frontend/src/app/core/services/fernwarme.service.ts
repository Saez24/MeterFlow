import { Injectable, inject } from '@angular/core';
import { MeterService } from './meter.service';
import { MeterConfig, TariffPeriod, EnergyType, MeterReading } from '../models/energy.models';

export interface FernwarmeKosten {
  baseCost: number;
  baseCharge: number;
  totalCost: number;
  consumptionInKwh: number;
  consumptionPercentage: number;
  co2Cost: number;
  basePriceTotal: number;
}

export interface FernwarmeResult {
  meterId: string;
  totalConsumption: number;
  totalCost: number;
  baseCharge: number;
  totalCostWithFees: number;
  breakdown: Array<{
    readingId: string;
    date: string;
    consumption: number;
    baseCost: number;
    baseCharge: number;
    totalCost: number;
    co2Cost: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class FernwarmeService {
  private readonly meterService = inject(MeterService);

  /**
   * Berechnet Fernwärme-Kosten mit Anschlussleistung
   * Formel: (Verbrauch in MWh * (Wärmeverbrauchspreis + CO2-Preis)) + Anschlusspreis pro kW
   */
  calculateFerneWarmekosten(
    meterConfig: MeterConfig<EnergyType.Fernwärme>,
    consumption: number, // in MWh
    basePricePerKw: number, // €/kW/Jahr
    emissionPrice: number, // €/MWh
    warmWaterPrice: number, // €/MWh
  ): FernwarmeKosten {
    const { connectedLoadKw } = meterConfig;
    const powerKw = connectedLoadKw ?? 10; // Default 10 kW wenn nicht definiert
    const consumptionInKwh = consumption * 1000; // von MWh zu kWh
    const powerUsagePercentage = powerKw > 0 ? (consumptionInKwh / (powerKw * 24)) * 100 : 0;
    const pricePerMWh = warmWaterPrice + emissionPrice;

    // Kostenberechnung
    const baseCost = consumption * pricePerMWh; // Verbrauchspreis
    const baseCharge = basePricePerKw * powerKw; // Anschlusspreis pro Jahr (in €)
    const co2Cost = consumption * emissionPrice;
    const totalCost = baseCost + baseCharge;

    return {
      baseCost,
      baseCharge,
      totalCost,
      consumptionInKwh,
      consumptionPercentage: Math.ceil(powerUsagePercentage * 100) / 100,
      co2Cost,
      basePriceTotal: baseCharge,
    };
  }

  /**
   * Berechnet Fernwärme-Kosten für eine Ablesung mit Tarif-Perioden
   */
  calculateFerneWarmekostenWithTariff(
    meterConfig: MeterConfig<EnergyType.Fernwärme>,
    readings: Array<{ reading: MeterReading; tariff: TariffPeriod | null }>,
  ): FernwarmeResult {
    const meter = this.meterService.getMeter(meterConfig.id);

    // Fallback für Tests ohne Meter im Service
    if (!meter) {
      return {
        meterId: meterConfig.id,
        totalConsumption: 0,
        totalCost: 0,
        baseCharge: 0,
        totalCostWithFees: 0,
        breakdown: [],
      };
    }

    const breakdown: Array<{
      readingId: string;
      date: string;
      consumption: number;
      baseCost: number;
      baseCharge: number;
      totalCost: number;
      co2Cost: number;
    }> = [];
    let totalConsumption = 0;
    let totalCost = 0;
    let totalBaseCharge = 0;

    for (const item of readings) {
      const { reading } = item;

      const tariff = item.tariff ?? this.getActiveTariffForDate(meter, reading.date);

      if (!tariff) continue;

      const period = this.calculateFerneWarmekosten(
        meterConfig,
        reading.consumption ?? 0,
        tariff.basePricePerKw ?? 0,
        tariff.emissionPrice ?? 0,
        tariff.pricePerUnit ?? 0, // pricePerUnit = warmWaterPrice
      );

      breakdown.push({
        readingId: reading.id,
        date: reading.date.toISOString().split('T')[0],
        consumption: reading.consumption ?? 0,
        baseCost: period.baseCost,
        baseCharge: period.basePriceTotal,
        totalCost: period.totalCost,
        co2Cost: period.co2Cost,
      });

      totalConsumption += (reading.consumption ?? 0);
      totalCost += period.totalCost;
      totalBaseCharge += period.basePriceTotal;
    }

    return {
      meterId: meterConfig.id,
      totalConsumption,
      totalCost,
      baseCharge: totalBaseCharge,
      totalCostWithFees: totalCost,
      breakdown,
    };
  }

  /**
   * Gibt den aktiven Tarif für ein Datum zurück
   */
  private getActiveTariffForDate(meter: MeterConfig, date: Date): TariffPeriod | null {
    const history = (meter.tariffHistory ?? [])
      .filter((p) => {
        const validFrom = new Date(p.validFrom);
        if (validFrom > date) return false;
        if (p.validTo) {
          const validTo = new Date(p.validTo);
          if (validTo < date) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());

    return history.length > 0 ? history[0] : null;
  }
}