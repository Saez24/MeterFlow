import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MeterService } from './meter.service';
import { StatsService } from './stats.service';
import { CO2_FACTORS, ENERGY_META } from '../models/energy.models';

@Injectable({ providedIn: 'root' })
export class PdfExportService {
    private readonly meterService = inject(MeterService);
    private readonly statsService = inject(StatsService);

    exportYearReport(year: number): void {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const meters = this.meterService.activeMeters();
        const pageW = doc.internal.pageSize.getWidth();

        // ── Header ────────────────────────────────────────────────────────────────
        doc.setFillColor(0, 122, 255); // Apple Blue
        doc.rect(0, 0, pageW, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('MeterFlow', 14, 13);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text($localize`:@@pdf.subtitle:Jahresabrechnung ${year}:year:`, 14, 21);

        const generatedOn = new Date().toLocaleDateString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        });
        doc.text($localize`:@@pdf.generatedOn:Erstellt am ${generatedOn}:date:`, pageW - 14, 21, { align: 'right' });

        // ── Gesamt-KPI ────────────────────────────────────────────────────────────
        let y = 38;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text($localize`:@@pdf.overview:Übersicht ${year}:year:`, 14, y);
        y += 8;

        let totalCost = 0;
        let totalCo2 = 0;
        for (const meter of meters) {
            const summary = this.statsService.getMeterSummary(meter.id, year);
            if (summary) {
                totalCost += summary.cost;
                totalCo2 += summary.co2Kg;
            }
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(
            $localize`:@@pdf.totalCostLabel:Gesamtkosten: ` +
            new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalCost),
            14, y,
        );
        y += 6;
        const co2Display = totalCo2 >= 1000
            ? `${(totalCo2 / 1000).toFixed(2).replace('.', ',')} t CO₂`
            : `${totalCo2.toFixed(1).replace('.', ',')} kg CO₂`;
        doc.text($localize`:@@pdf.totalCo2Label:Gesamtemissionen: ` + co2Display, 14, y);
        y += 10;

        // ── Tabelle je Zähler ─────────────────────────────────────────────────────
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text($localize`:@@pdf.meterTable:Zähler-Übersicht`, 14, y);
        y += 4;

        const tableHead = [
            [
                $localize`:@@pdf.col.meter:Zähler`,
                $localize`:@@pdf.col.type:Typ`,
                $localize`:@@pdf.col.consumption:Verbrauch`,
                $localize`:@@pdf.col.unit:Einheit`,
                $localize`:@@pdf.col.cost:Kosten (€)`,
                $localize`:@@pdf.col.co2:CO₂ (kg)`,
            ],
        ];

        const tableRows = meters
            .map((meter) => {
                const summary = this.statsService.getMeterSummary(meter.id, year);
                if (!summary) return null;
                const meta = ENERGY_META[meter.type];
                return [
                    meter.name,
                    meta.label,
                    summary.consumption.toFixed(2).replace('.', ','),
                    summary.unit,
                    new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(summary.cost),
                    summary.co2Kg.toFixed(1).replace('.', ','),
                ];
            })
            .filter((r): r is string[] => r !== null);

        autoTable(doc, {
            startY: y,
            head: tableHead,
            body: tableRows,
            theme: 'striped',
            headStyles: { fillColor: [0, 122, 255], textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 9 },
            alternateRowStyles: { fillColor: [245, 245, 247] },
            margin: { left: 14, right: 14 },
        });

        // ── Monatsdetails je Zähler ───────────────────────────────────────────────
        const yearStats = this.statsService.getYearStats(year);

        for (const meter of meters) {
            const monthRows = yearStats.months
                .filter((m) => m.byMeter[meter.id])
                .map((m) => {
                    const ms = m.byMeter[meter.id];
                    const co2 = ms.consumption * CO2_FACTORS[meter.type];
                    return [
                        m.label,
                        ms.consumption.toFixed(2).replace('.', ','),
                        ms.unit,
                        new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(ms.cost),
                        co2.toFixed(1).replace('.', ','),
                    ];
                });

            if (monthRows.length === 0) continue;

            const meta = ENERGY_META[meter.type];
            // @ts-ignore jspdf-autotable erweitert doc zur Laufzeit um lastAutoTable
            const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 200;

            autoTable(doc, {
                startY: finalY + 10,
                head: [
                    [
                        { content: `${meter.name} (${meta.label})`, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [240, 240, 245] } },
                    ],
                    [
                        $localize`:@@pdf.col.month:Monat`,
                        $localize`:@@pdf.col.consumption:Verbrauch`,
                        $localize`:@@pdf.col.unit:Einheit`,
                        $localize`:@@pdf.col.cost:Kosten (€)`,
                        $localize`:@@pdf.col.co2:CO₂ (kg)`,
                    ],
                ],
                body: monthRows,
                theme: 'striped',
                headStyles: { fillColor: [220, 220, 230], textColor: 50, fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                alternateRowStyles: { fillColor: [250, 250, 252] },
                margin: { left: 14, right: 14 },
            });
        }

        // ── Footer (jede Seite) ───────────────────────────────────────────────────
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(160, 160, 160);
            doc.text(
                `MeterFlow · ${year} · ${i}/${pageCount}`,
                pageW / 2, doc.internal.pageSize.getHeight() - 8,
                { align: 'center' },
            );
        }

        doc.save(`MeterFlow-${year}.pdf`);
    }
}
