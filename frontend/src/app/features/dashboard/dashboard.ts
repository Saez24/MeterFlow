import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatRippleModule } from '@angular/material/core';
import { DashboardStateService } from '../../core/services/dashboard-state.service';
import { ReadingsList } from '../../shared/components/readings-list/readings-list';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatRippleModule,
    ReadingsList
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',

})
export class Dashboard {
  readonly state = inject(DashboardStateService);

  readonly MONTH_SHORT = [
    'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
  ];

  monthShort(month: number): string {
    return this.MONTH_SHORT[month - 1] ?? '';
  }
}