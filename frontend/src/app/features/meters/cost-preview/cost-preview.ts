import { Component, computed, input, signal } from '@angular/core';
import { MeterConfig } from '../../../core/models/energy.models';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cost-preview',
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './cost-preview.html',
  styleUrl: './cost-preview.scss',

})
export class CostPreview {
  meter = input.required<MeterConfig>();

  estimatedConsumption = signal<number | null>(null);
  monthlyPayment = signal<number | null>(null);
  paymentCount = signal<number | null>(null);

  result = signal<any | null>(null);

  calculatePreview(): void {
    const consumption = this.estimatedConsumption();
    const monthlyPay = this.monthlyPayment();
    const payCount = this.paymentCount();
    const meter = this.meter();

    if (!consumption || !monthlyPay || !payCount) {
      this.result.set({ error: 'Bitte alle Felder ausfüllen.' });
      return;
    }

    if (!meter.tariffHistory || meter.tariffHistory.length === 0) {
      this.result.set({ error: 'Für diesen Zähler sind keine Tarife hinterlegt.' });
      return;
    }

    const year = new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    const sortedTariffs = [...meter.tariffHistory].sort(
      (a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime()
    );

    const calculationPeriods = [];
    let lastDate = yearStart;

    for (let i = 0; i < sortedTariffs.length; i++) {
      const tariff = sortedTariffs[i];
      const validFrom = new Date(tariff.validFrom);

      if (validFrom > yearEnd) continue;

      const startDate = validFrom > lastDate ? validFrom : lastDate;

      let endDate: Date;
      if (i + 1 < sortedTariffs.length) {
        const nextValidFrom = new Date(sortedTariffs[i + 1].validFrom);
        endDate = new Date(nextValidFrom.getTime() - 1);
        if (endDate > yearEnd) endDate = yearEnd;
      } else {
        endDate = yearEnd;
      }

      if (startDate > endDate) continue;

      const days = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24) + 1;
      const periodConsumption = (consumption / 365) * days;

      let periodBaseCharge: number;
      let consumptionCost: number;

      if (meter.type === 'fernwarme') {
        const connectedKw = Math.max(0, meter.connectedLoadKw ?? 10);
        const annualFixed = connectedKw * (tariff.basePricePerKw ?? 0);
        periodBaseCharge = (annualFixed / 365) * days;
        consumptionCost = periodConsumption * (tariff.pricePerUnit + (tariff.emissionPrice ?? 0));
      } else {
        const baseChargePerDay = (tariff.baseCharge * 12) / 365;
        periodBaseCharge = baseChargePerDay * days;
        consumptionCost = periodConsumption * tariff.pricePerUnit;
      }

      const totalCost = periodBaseCharge + consumptionCost;

      calculationPeriods.push({
        name: `Tarif vom ${validFrom.toLocaleDateString()}`,
        startDate: startDate,
        endDate: endDate,
        days: days,
        consumption: periodConsumption,
        pricePerUnit: tariff.pricePerUnit,
        baseCharge: periodBaseCharge,
        cost: totalCost
      });

      lastDate = new Date(endDate.getTime() + (1000 * 3600 * 24));
      if (lastDate > yearEnd) break;
    }

    const totalCost = calculationPeriods.reduce((sum, p) => sum + p.cost, 0);
    const totalPayment = monthlyPay * payCount;
    const balance = totalPayment - totalCost;

    this.result.set({
      totalCost: totalCost,
      totalPayment: totalPayment,
      balance: balance,
      periods: calculationPeriods,
    });
  }
}
