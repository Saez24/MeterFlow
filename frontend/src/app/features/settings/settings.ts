import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ThemeService } from '../../core/services/theme.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Router } from '@angular/router';
import { MeterService } from '../../core/services/meter.service';
import { ReadingService } from '../../core/services/reading.service';
import { DataSyncService } from '../../core/services/data-sync.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog';
import { CsvImportDialogComponent } from '../../shared/components/csv-import-dialog/csv-import-dialog';
import { NotificationService } from '../../core/services/notification.service';
import { PwaInstallService } from '../../core/services/pwa-install.service';
import { Co2FactorService, CO2_SUPPORTED_TYPES } from '../../core/services/co2-factor.service';
import { EnergyType, ENERGY_META } from '../../core/models/energy.models';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatCardModule,
    MatSnackBarModule, MatDialogModule, MatSlideToggleModule, MatFormFieldModule, MatInputModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',

})
export class Settings {
  private readonly themeService = inject(ThemeService);
  private readonly meterService = inject(MeterService);
  private readonly readingService = inject(ReadingService);
  private readonly dataSyncService = inject(DataSyncService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly supabase = inject(SupabaseService);
  private readonly dialog = inject(MatDialog);

  readonly notificationService = inject(NotificationService);
  readonly pwaInstall = inject(PwaInstallService);
  readonly co2FactorService = inject(Co2FactorService);
  readonly themeMode = this.themeService.mode;

  // CO₂-Faktoren bearbeiten
  readonly editingType = signal<EnergyType | null>(null);
  editFactor: number | null = null;
  editSource = '';
  editSourceUrl = '';
  readonly supportedTypes = CO2_SUPPORTED_TYPES;

  energyLabel(type: EnergyType): string {
    return ENERGY_META[type]?.label ?? type;
  }

  startEdit(type: EnergyType, entry: ReturnType<Co2FactorService['getEntryForType']>): void {
    this.editingType.set(type);
    this.editFactor = entry.factor;
    this.editSource = entry.source;
    this.editSourceUrl = entry.sourceUrl ?? '';
  }

  cancelEdit(): void {
    this.editingType.set(null);
  }

  async saveEdit(type: EnergyType, unit: string): Promise<void> {
    if (this.editFactor === null) return;
    const today = new Date().toISOString().slice(0, 10);
    await this.co2FactorService.upsert({
      energy_type: type,
      factor_kg_per_unit: this.editFactor,
      unit,
      source: this.editSource,
      source_url: this.editSourceUrl || null,
      valid_from: today,
    });
    this.snackBar.open($localize`:@@settings.co2Factors.saved:CO₂-Faktor gespeichert`, 'OK', { duration: 3000 });
    this.editingType.set(null);
  }

  async resetToDefault(type: EnergyType): Promise<void> {
    const rows = this.co2FactorService.factors.value() ?? [];
    const row = rows.find(r => r.energy_type === type);
    if (row) {
      await this.co2FactorService.remove(row.id);
      this.snackBar.open($localize`:@@settings.co2Factors.reset.done:Standardwert wiederhergestellt`, 'OK', { duration: 3000 });
    }
    this.editingType.set(null);
  }

  openCsvImport(): void {
    this.dialog.open(CsvImportDialogComponent, { width: '640px', maxWidth: '95vw' });
  }

  async installPwa(): Promise<void> {
    const outcome = await this.pwaInstall.promptInstall();
    if (outcome === 'accepted') {
      this.snackBar.open($localize`:@@settings.pwa.installed:App wurde installiert`, 'OK', { duration: 3000 });
    }
  }

  meterCount() {
    return this.meterService.meters().length;
  }
  readingCount() {
    return this.readingService.readings().length;
  }

  setTheme(mode: 'light' | 'dark' | 'system'): void {
    this.themeService.setMode(mode);
  }

  exportData(): void {
    const json = this.dataSyncService.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meterflow-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.snackBar.open($localize`:@@settings.exported:Daten exportiert`, 'OK', { duration: 3000 });
  }

  importData(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        this.dataSyncService.importData(e.target?.result as string);
        this.snackBar.open($localize`:@@settings.imported:Daten importiert`, 'OK', { duration: 3000 });
      } catch {
        this.snackBar.open($localize`:@@settings.importError:Fehler beim Import`, 'OK', { duration: 3000 });
      }
    };
    reader.readAsText(file);
  }

  clearAll(): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: $localize`:@@settings.deleteAll.title:Alle Daten löschen`,
          message: $localize`:@@settings.deleteAll.message:Alle Daten wirklich löschen? Diese Aktion kann nicht rükgängig gemacht werden!`,
          confirmLabel: $localize`:@@settings.deleteAll.confirm:Alles löschen`,
        },
      })
      .afterClosed()
      .subscribe(async (confirmed: boolean) => {
        if (!confirmed) return;
        try {
          await this.supabase.clearAllUserData();
          window.location.reload();
        } catch {
          this.snackBar.open(
            $localize`:@@settings.deleteAll.error:Fehler beim Löschen der Daten`,
            'OK',
            { duration: 4000 },
          );
        }
      });
  }

  async sendTestNotification(): Promise<void> {
    await this.notificationService.showTestNotification();
  }

  async logout(): Promise<void> {
    await this.supabase.signOut();
    this.router.navigate(['/auth']);
  }
}
