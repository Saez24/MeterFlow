import { Component, input, output, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ENERGY_META, ReadingRow } from '../../../core/models/energy.models';
import { MeterService } from '../../../core/services/meter.service';

@Component({
  selector: 'app-readings-list',
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './readings-list.html',
  styleUrl: './readings-list.scss',

})
export class ReadingsList {
  private readonly meterService = inject(MeterService);

  readonly rows = input<ReadingRow[]>([]);
  readonly showActions = input<boolean>(false);
  readonly deleteReading = output<string>();

  getMeter(id: string) {
    return this.meterService.getMeter(id);
  }

  getMeta(type: string) {
    return ENERGY_META[type as keyof typeof ENERGY_META];
  }

  onDelete(id: string): void {
    this.deleteReading.emit(id);
  }
}