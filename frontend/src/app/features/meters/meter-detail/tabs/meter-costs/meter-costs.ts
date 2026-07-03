import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeterDetailStateService } from '../../../../../core/services/meter-detail-state.service';
import { CostPreview } from '../../../cost-preview/cost-preview';

@Component({
  selector: 'app-meter-costs',
  imports: [CommonModule, CostPreview],
  templateUrl: './meter-costs.html',
  styleUrl: './meter-costs.scss',

})
export class MeterCosts {
  private readonly state = inject(MeterDetailStateService);
  meter = this.state.meter;
}
