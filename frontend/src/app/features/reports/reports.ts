import {
  Component,
  inject,
  signal,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  effect,

} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Chart, registerables } from 'chart.js';
import { ThemeService } from '../../core/services/theme.service';
import { ENERGY_META, MONTH_NAMES } from '../../core/models/energy.models';
import { DashboardStateService } from '../../core/services/dashboard-state.service';
import { ReadingService } from '../../core/services/reading.service';
import { PdfExportService } from '../../core/services/pdf-export.service';

Chart.register(...registerables);

@Component({
  selector: 'app-reports',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
  ],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',

})
export class Reports implements AfterViewInit, OnDestroy {
  readonly state = inject(DashboardStateService);
  private readonly readingService = inject(ReadingService);
  private readonly themeService = inject(ThemeService);
  private readonly pdfExport = inject(PdfExportService);

  @ViewChild('costChart') costChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('consumptionChart') consumptionChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('yearChart') yearChartRef!: ElementRef<HTMLCanvasElement>;

  readonly ENERGY_META = ENERGY_META;
  readonly MONTH_NAMES = MONTH_NAMES;

  readonly selectedMeterChart = signal<string>(
    this.state.activeMeters()[0]?.id ?? ''
  );

  private costChartInstance: Chart | null = null;
  private consumptionChartInstance: Chart | null = null;
  private yearChartInstance: Chart | null = null;

  constructor() {
    effect(() => {
      this.themeService.isDark();
      this.state.selectedYear();
      this.selectedMeterChart();
      if (!this.costChartRef) return;
      this.buildAllCharts();
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.buildAllCharts(), 100);
  }

  ngOnDestroy(): void {
    this.costChartInstance?.destroy();
    this.consumptionChartInstance?.destroy();
    this.yearChartInstance?.destroy();
  }

  exportPdf(): void {
    this.pdfExport.exportYearReport(this.state.selectedYear());
  }

  private buildAllCharts(): void {
    this.buildCostChart();
    this.buildConsumptionChart();
    if (this.state.availableYears().length > 1) this.buildYearChart();
  }

  private chartDefaults() {
    const dark = this.themeService.isDark();
    return {
      gridColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      textColor: dark ? '#98989D' : '#6E6E73',
    };
  }

  private buildCostChart(): void {
    this.costChartInstance?.destroy();
    const { gridColor, textColor } = this.chartDefaults();
    const months = this.state.getMonthStats(this.state.selectedYear());
    const meters = this.state.activeMeters();

    const datasets = meters.map((meter) => ({
      label: meter.name,
      data: months.map((m) => m.byMeter[meter.id]?.cost ?? 0),
      backgroundColor: meter.color + 'CC',
      borderColor: meter.color,
      borderWidth: 1,
      borderRadius: 6,
    }));

    this.costChartInstance = new Chart(this.costChartRef.nativeElement, {
      type: 'bar',
      data: { labels: months.map((m) => m.label), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${(ctx.raw as number).toFixed(2)} €`,
            },
          },
        },
        scales: {
          x: { stacked: true, grid: { color: gridColor }, ticks: { color: textColor } },
          y: {
            stacked: true,
            grid: { color: gridColor },
            ticks: { color: textColor, callback: (v) => v + ' €' },
          },
        },
      },
    });
  }

  private buildConsumptionChart(): void {
    this.consumptionChartInstance?.destroy();
    const { gridColor, textColor } = this.chartDefaults();
    const meterId = this.selectedMeterChart();
    const meter = this.state.activeMeters().find((m) => m.id === meterId);
    if (!meter) return;

    const months = this.state.getMonthStats(this.state.selectedYear());
    const isGas = meter.type === 'gas';

    const data = months.map((m) => {
      if (isGas) {
        // kWh aus den Readings summieren statt m³
        const year = this.state.selectedYear();
        return this.readingService
          .getReadingsForMeter(meterId)
          .filter((r) => {
            const d = new Date(r.date);
            return d.getFullYear() === year && d.getMonth() + 1 === m.month;
          })
          .reduce((sum, r) => sum + (r.kwh ?? 0), 0);
      }
      return m.byMeter[meterId]?.consumption ?? 0;
    });

    const unit = isGas ? 'kWh' : ENERGY_META[meter.type].unit;

    this.consumptionChartInstance = new Chart(this.consumptionChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: months.map((m) => m.label),
        datasets: [{
          label: meter.name,
          data,
          backgroundColor: meter.color + 'AA',
          borderColor: meter.color,
          borderWidth: 2,
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => ` ${(ctx.raw as number).toFixed(2)} ${unit}` },
          },
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor } },
          y: {
            grid: { color: gridColor },
            ticks: { color: textColor, callback: (v) => v + ' ' + unit },
          },
        },
      },
    });
  }

  private buildYearChart(): void {
    this.yearChartInstance?.destroy();
    if (!this.yearChartRef) return;
    const { gridColor, textColor } = this.chartDefaults();
    const years = this.state.availableYears();
    const data = years.map((y) => this.state.getYearTotalCost(y));

    // CSS-Variable zur Laufzeit auflösen
    const blueColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--apple-blue')
      .trim();

    this.yearChartInstance = new Chart(this.yearChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: years.map(String),
        datasets: [{
          label: 'Gesamtkosten',
          data,
          backgroundColor: years.map((y) =>
            y === this.state.selectedYear()
              ? blueColor
              : blueColor + '66' // 40% Transparenz als Hex
          ),
          borderColor: blueColor,
          borderWidth: 2,
          borderRadius: 10,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` ${(ctx.raw as number).toFixed(2)} €` } },
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, callback: (v) => v + ' €' } },
        },
      },
    });
  }
}