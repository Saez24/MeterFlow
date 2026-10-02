import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MeterDetailStateService } from '../../../../../core/services/meter-detail-state.service';
import { CostPreview } from '../../../cost-preview/cost-preview';
import { isLinkedGardenWater } from '../../../../../core/utils/cost-preview.calc';

@Component({
  selector: 'app-meter-costs',
  imports: [CommonModule, MatIconModule, CostPreview],
  templateUrl: './meter-costs.html',
  styleUrl: './meter-costs.scss',
})
export class MeterCosts {
  private readonly state = inject(MeterDetailStateService);
  meter = this.state.meter;
  readonly isLinkedGardenWater = isLinkedGardenWater;
}
