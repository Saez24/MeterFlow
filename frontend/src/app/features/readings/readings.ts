import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { ENERGY_META, ReadingRow } from '../../core/models/energy.models';
import { MeterService } from '../../core/services/meter.service';
import { ReadingService } from '../../core/services/reading.service';
import { ReadingsList } from '../../shared/components/readings-list/readings-list';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog';


@Component({
  selector: 'app-readings',
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatSnackBarModule,
    FormsModule,
    ReadingsList
  ],
  templateUrl: './readings.html',
  styleUrl: './readings.scss',

})
export class Readings {
  private readonly meterService = inject(MeterService);
  readonly readingService = inject(ReadingService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly meters = this.meterService.meters;
  readonly filterMeterId = signal<string>('');

  readonly filteredReadings = computed((): ReadingRow[] => {
    const all = [...this.readingService.readings()].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const filter = this.filterMeterId();
    const filtered = filter ? all.filter((r) => r.meterId === filter) : all;

    return filtered.map((reading) => ({
      reading,
      gardenWaterCost: this.readingService.getGardenWaterCost(reading),
    }));
  });

  getMeter(id: string) {
    return this.meterService.getMeter(id);
  }

  getMeta(type: string) {
    return ENERGY_META[type as keyof typeof ENERGY_META];
  }

  deleteReading(id: string): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        backdropClass: 'blur-backdrop',
        data: {
          title: $localize`:@@readings.delete.title:Ablesung löschen`,
          message: $localize`:@@readings.delete.message:Ablesung wirklich löschen?`,
          confirmLabel: $localize`:@@readings.delete.confirm:Löschen`,
        },
      })
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (!confirmed) return;
        this.readingService.deleteReading(id);
        this.snackBar.open($localize`:@@readings.deleted:Ablesung gelöscht`, 'OK', { duration: 3000 });
      });
  }
}