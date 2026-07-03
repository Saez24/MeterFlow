import { Component, effect, inject, signal, ViewChild, ElementRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Chart } from 'chart.js';
import { ThemeService } from '../../../../../core/services/theme.service';
import { MeterDetailStateService } from '../../../../../core/services/meter-detail-state.service';
import { MeterConfig } from '../../../../../core/models/energy.models';

@Component({
  selector: 'app-meter-chart',
  imports: [CommonModule, MatIconModule],
  templateUrl: './meter-chart.html',
  styleUrl: './meter-chart.scss',

})
export class MeterChart {
  private readonly state = inject(MeterDetailStateService);
  private readonly themeService = inject(ThemeService);

  @ViewChild('detailChart') detailChartRef!: ElementRef<HTMLCanvasElement>;

  meter = this.state.meter;

  readonly availableYears = computed(() => {
    const allReadings = this.state.readings();
    const years = new Set(allReadings.map(r => new Date(r.date).getFullYear()));
    return [...years]
      .filter(year => {
        const yearReadings = allReadings.filter(r => new Date(r.date).getFullYear() === year);
        const hasPrev = allReadings.some(r => new Date(r.date).getFullYear() < year);
        return yearReadings.length >= 2 || (yearReadings.length === 1 && hasPrev);
      })
      .sort((a, b) => b - a);
  });

  readonly selectedYear = signal<number>(this.availableYears()[0] ?? new Date().getFullYear());

  readonly readings = computed(() => {
    const allReadings = this.state.readings();
    const year = this.selectedYear();
    const yearReadings = allReadings
      .filter(r => new Date(r.date).getFullYear() === year)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (yearReadings.length < 2) {
      const prevYearLast = allReadings
        .filter(r => new Date(r.date).getFullYear() < year)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (prevYearLast) return [...yearReadings, prevYearLast];
    }
    return yearReadings;
  });

  readonly chartMode = signal<'consumption' | 'cost' | 'kwh'>('consumption');
  private chartInstance: Chart | null = null;

  constructor() {
    effect(() => {
      this.chartMode();
      this.selectedYear();
      this.readings();
      if (this.detailChartRef) {
        setTimeout(() => this.buildChart(), 50);
      }
    });
  }

  ngAfterViewInit(): void {
    this.waitForCanvas();
  }

  private waitForCanvas(): void {
    const observer = new MutationObserver(() => {
      if (this.detailChartRef?.nativeElement) {
        observer.disconnect();
        this.buildChart();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      if (this.detailChartRef?.nativeElement) this.buildChart();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.chartInstance?.destroy();
  }

  private buildChart(): void {
    if (!this.detailChartRef || this.readings().length < 2) return;
    this.chartInstance?.destroy();
    const meter = this.meter();
    if (!meter) return;
    const dark = this.themeService.isDark();
    const gridColor = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
    const textColor = dark ? '#98989D' : '#6E6E73';
    const rs = [...this.readings()].reverse();
    const labels = rs.map((r) =>
      new Date(r.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
    );
    let data: number[], unit: string, label: string;
    if (this.chartMode() === 'kwh') {
      data = rs.map((r) => r.kwh ?? 0);
      unit = 'kWh';
      label = 'Kilowattstunden';
    } else if (this.chartMode() === 'cost') {
      data = rs.map((r) => r.totalCost ?? r.cost ?? 0);
      unit = '€';
      label = 'Kosten';
    } else {
      data = rs.map((r) => r.consumption ?? 0);
      unit = meter.unit;
      label = 'Verbrauch';
    }
    this.chartInstance = new Chart(this.detailChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label,
            data,
            backgroundColor: meter.color + 'AA',
            borderColor: meter.color,
            borderWidth: 2,
            borderRadius: 7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` ${(ctx.raw as number).toFixed(2)} ${unit}` } },
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
}
