// src/app/features/meters/meters.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { firstValueFrom } from 'rxjs';
import {
  ENERGY_META,
  MeterConfig,
  TariffPeriod,
} from '../../core/models/energy.models';
import { MeterService } from '../../core/services/meter.service';
import { ReadingService } from '../../core/services/reading.service';
import { TariffService } from '../../core/services/tariff.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-meters',
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule,
    MatSlideToggleModule,
    MatDividerModule,
  ],
  templateUrl: './meters.html',
  styleUrl: './meters.scss',

})
export class Meters {
  private readonly router = inject(Router);
  private readonly meterService = inject(MeterService);
  private readonly readingService = inject(ReadingService);
  private readonly tariffService = inject(TariffService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly meters = this.meterService.meters;

  getMeta(type: string) {
    return ENERGY_META[type as keyof typeof ENERGY_META];
  }

  readingCount(meterId: string): number {
    return this.readingService.getReadingsForMeter(meterId).length;
  }

  latestReading(meterId: string) {
    return this.readingService.latestReadings().get(meterId);
  }

  getActiveTariff(meter: MeterConfig): TariffPeriod | null {
    return this.tariffService.getActiveTariffForDate(meter, new Date());
  }

  navigateToMeter(meterId: string): void {
    this.router.navigate(['/meters', meterId]);
  }

  toggleActive(meter: MeterConfig): void {
    this.meterService.updateMeter(meter.id, { active: !meter.active });
  }

  async deleteMeter(meter: MeterConfig): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: $localize`:@@meters.delete.title:Zähler löschen`,
            message: $localize`:@@meters.delete.message:Zähler "${meter.name}" wirklich löschen? Alle Ablesungen werden ebenfalls gelöscht.`,
            confirmLabel: $localize`:@@meters.delete.confirm:Löschen`,
          },
        })
        .afterClosed(),
    );
    if (!confirmed) return;
    await this.meterService.deleteMeter(meter.id);
    await this.readingService.deleteReadingsForMeter(meter.id);
    this.snackBar.open($localize`:@@meters.deleted:Zähler gelöscht`, 'OK', { duration: 3000 });
  }
}