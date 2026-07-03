import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { DashboardStateService } from '../../core/services/dashboard-state.service';
import { TariffService } from '../../core/services/tariff.service';
import { MONTH_NAMES } from '../../core/models/energy.models';

@Component({
    selector: 'app-cost-preview',
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatFormFieldModule,
        MatCardModule,
        MatTableModule,
    ],
    templateUrl: './cost-preview.html',
    styleUrl: './cost-preview.scss',
})
export class CostPreview {
    readonly state = inject(DashboardStateService);
    readonly tariffService = inject(TariffService);

    readonly selectedYear = signal(
        this.state.availableYears()[0] ?? new Date().getFullYear()
    );

    readonly yearStats = computed(() =>
        this.state.statsService.getYearStats(this.selectedYear())
    );

    readonly costPreview = computed(() => {
        const year = this.selectedYear();
        const stats = this.yearStats();
        const meters = this.state.activeMeters();

        // Monate mit Daten im aktuellen Jahr
        const currentMonthsWithData = stats.months.filter(m => Object.keys(m.byMeter).length > 0);

        // Daten vom Vorjahr holen
        const prevYear = year - 1;
        const prevStats = this.state.statsService.getYearStats(prevYear);
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

            const activeTariff = this.state.getActiveTariff(meter);
            const connectedKw = meter.type === 'fernwarme' ? Math.max(0, meter.connectedLoadKw ?? 10) : 0;

            // Durchschnittliche monatliche Kosten für diesen Zähler
            const avgMonthlyVariable = allMeterMonths.reduce((sum, m) => sum + (m.byMeter[meter.id]?.cost ?? 0), 0) / allMeterMonths.length;

            // Prognostizierte Kosten für 12 Monate
            const projectedVariableCost = avgMonthlyVariable * 12;

            // Grundgebühren für 12 Monate
            const baseChargeYearly = meter.type === 'garden_water' && meter.linkedWaterMeterId
                ? 0
                : meter.type === 'fernwarme'
                    ? connectedKw * (activeTariff?.basePricePerKw ?? 0)
                    : (activeTariff?.baseCharge ?? 0) * 12;

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
            monthsData: currentMonthsWithData.map(m => ({
                month: m.month,
                monthName: MONTH_NAMES[m.month - 1],
                variableCost: m.totalCost,
                baseCharges: meters.reduce((sum, meter) => {
                    if (meter.type === 'garden_water' && meter.linkedWaterMeterId) return sum;
                    const tariff = this.tariffService.getActiveTariffForDate(
                        meter,
                        new Date(year, m.month - 1),
                    );
                    if (meter.type === 'fernwarme') {
                        const kw = Math.max(0, meter.connectedLoadKw ?? 10);
                        return sum + (kw * (tariff?.basePricePerKw ?? 0)) / 12;
                    }
                    return sum + (tariff?.baseCharge ?? 0);
                }, 0),
                totalCost: m.totalCost + meters.reduce((sum, meter) => {
                    if (meter.type === 'garden_water' && meter.linkedWaterMeterId) return sum;
                    const tariff = this.tariffService.getActiveTariffForDate(
                        meter,
                        new Date(year, m.month - 1),
                    );
                    if (meter.type === 'fernwarme') {
                        const kw = Math.max(0, meter.connectedLoadKw ?? 10);
                        return sum + (kw * (tariff?.basePricePerKw ?? 0)) / 12;
                    }
                    return sum + (tariff?.baseCharge ?? 0);
                }, 0),
            })),
        };
    });

    readonly displayedColumns = ['month', 'variableCost', 'baseCharges', 'totalCost'];
}