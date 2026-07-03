import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ReadingService } from '../../../../../core/services/reading.service';
import { MeterDetailStateService } from '../../../../../core/services/meter-detail-state.service';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import { SupabaseService } from '../../../../../core/services/supabase.service';

@Component({
  selector: 'app-meter-readings',
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatSnackBarModule, MatDialogModule],
  providers: [DatePipe],
  templateUrl: './meter-readings.html',
  styleUrl: './meter-readings.scss',

})
export class MeterReadings {
  private readonly readingService = inject(ReadingService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly datePipe = inject(DatePipe);
  private readonly state = inject(MeterDetailStateService);
  private readonly supabaseService = inject(SupabaseService);

  meter = this.state.meter;
  readings = this.state.readings;
  activePhoto = signal<string | null>(null);      // storage-Pfad oder URL (für Close-Check)
  activePhotoUrl = signal<string | null>(null);   // aufgelöste URL für <img [src]>
  isPhotoLoading = signal(false);

  /** Dynamischer Alt-Text für das Foto-Modal – enthält Zählername + Datum der aktiven Ablesung */
  readonly photoAltText = computed(() => {
    const photo = this.activePhoto();
    if (!photo) return '';
    const reading = this.readings().find(r => r.photo === photo);
    const meter = this.meter();
    if (!reading || !meter) return $localize`:@@meterReadings.photo.alt:Zählerfoto`;
    const dateStr = this.datePipe.transform(reading.date, 'dd.MM.yyyy') ?? '';
    return $localize`:@@meterReadings.photo.altDynamic:${meter.name}:meterName: – Ablesung vom ${dateStr}:date:`;
  });

  async showPhoto(photo: string): Promise<void> {
    this.activePhoto.set(photo);
    if (photo.startsWith('http')) {
      this.activePhotoUrl.set(photo);
    } else {
      this.isPhotoLoading.set(true);
      try {
        const url = await this.supabaseService.getSignedPhotoUrl(photo);
        this.activePhotoUrl.set(url);
      } catch {
        this.activePhotoUrl.set(null);
      } finally {
        this.isPhotoLoading.set(false);
      }
    }
  }

  closePhoto(): void {
    this.activePhoto.set(null);
    this.activePhotoUrl.set(null);
  }

  async deleteReading(id: string): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: $localize`:@@meterReadings.delete.title:Ablesung löschen`,
          message: $localize`:@@meterReadings.delete.message:Ablesung wirklich löschen?`,
          confirmLabel: $localize`:@@meterReadings.delete.confirm:Löschen`,
        },
      }).afterClosed()
    );
    if (!confirmed) return;
    const photoPath = this.readings().find(r => r.id === id)?.photo;
    this.readingService.deleteReading(id);
    // Foto aus Storage löschen (nur bei Pfaden, nicht bei alten absoluten URLs)
    if (photoPath && !photoPath.startsWith('http')) {
      try { await this.supabaseService.deletePhoto(photoPath); } catch { /* ignorieren */ }
    }
    this.snackBar.open($localize`:@@meterReadings.deleted:Ablesung gelöscht`, 'OK', { duration: 2000 });
  }
}
