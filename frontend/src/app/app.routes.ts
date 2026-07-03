import { Routes } from '@angular/router';
import { Dashboard } from './features/dashboard/dashboard';
import { Meters } from './features/meters/meters';
import { MeterForm } from './features/meters/meter-form/meter-form';
import { MeterDetail } from './features/meters/meter-detail/meter-detail';
import { Readings } from './features/readings/readings';
import { ReadingsForm } from './features/readings/readings-form/readings-form';
import { Reports } from './features/reports/reports';
import { Settings } from './features/settings/settings';
import { authGuard } from './core/guards/auth.guard';
import { Auth } from './features/auth/auth';
import { MeterChart } from './features/meters/meter-detail/tabs/meter-chart/meter-chart';
import { MeterReadings } from './features/meters/meter-detail/tabs/meter-readings/meter-readings';
import { MeterTariffs } from './features/meters/meter-detail/tabs/meter-tariffs/meter-tariffs';
import { MeterCosts } from './features/meters/meter-detail/tabs/meter-costs/meter-costs';
import { CostPreview } from './features/cost-preview/cost-preview';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'auth', component: Auth },
  {
    path: 'meters',
    canActivate: [authGuard],
    children: [
      { path: '', component: Meters },
      { path: 'new', component: MeterForm },
      { path: ':id/edit', component: MeterForm },
      {
        path: ':id',
        component: MeterDetail,
        children: [
          { path: '', redirectTo: 'chart', pathMatch: 'full' },
          { path: 'chart', component: MeterChart },
          { path: 'readings', component: MeterReadings },
          { path: 'tariffs', component: MeterTariffs },
          { path: 'costs', component: MeterCosts },
        ],
      },
    ],
  },
  {
    path: 'readings',
    canActivate: [authGuard],
    children: [
      { path: '', component: Readings },
      { path: 'new', component: ReadingsForm },
      { path: ':id/edit', component: ReadingsForm },
    ],
  },
  { path: 'reports', component: Reports, canActivate: [authGuard] },
  { path: 'cost-preview', component: CostPreview, canActivate: [authGuard] },
  { path: 'settings', component: Settings, canActivate: [authGuard] },

  { path: '**', redirectTo: 'dashboard' },
];
