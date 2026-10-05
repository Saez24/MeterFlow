import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ENERGY_META, MeterReading } from '../../../core/models/energy.models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MeterService } from '../../../core/services/meter.service';
import { ReadingService } from '../../../core/services/reading.service';
import { TariffService } from '../../../core/services/tariff.service';
import { ApiService } from '../../../core/services/api.service';
import { GAS_DEFAULTS } from '../../../core/constants/gas.constants';
import { OcrService, OcrResult } from '../../../core/services/ocr.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { maxDecimalPlaces } from '../../../core/validators/decimal-places.validator';
import { toDateInputValue, parseDateInput } from '../../../core/utils/date-input.util';

@Component({
  selector: 'app-readings-form',
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './readings-form.html',
  styleUrl: './readings-form.scss',
})
export class ReadingsForm {
  private readonly meterService = inject(MeterService);
  public readonly readingService = inject(ReadingService);
  private readonly tariffService = inject(TariffService);
  private readonly apiService = inject(ApiService);
  private readonly ocrService = inject(OcrService);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);
  readonly isSaving = signal(false);

  // ── Foto-State ──────────────────────────────────────────────────────
  private readonly existingPhotoPath = signal<string | null>(null);
  readonly existingPhotoSignedUrl = signal<string | null>(null);
  readonly existingPhotoRemoved = signal(false);
  readonly selectedPhotoFile = signal<File | null>(null);
  readonly photoPreviewUrl = signal<string | null>(null);
  readonly photoConverting = signal(false);
  readonly isUploading = signal(false);

  // ── OCR-State ────────────────────────────────────────────────────────
  readonly ocrRunning = signal(false);
  readonly ocrResult = signal<OcrResult | null>(null);

  readonly hasExistingPhoto = computed(
    () => !!this.existingPhotoPath() && !this.existingPhotoRemoved(),
  );

  readonly activeMeters = this.meterService.activeMeters;

  private readonly readingId = this.route.snapshot.paramMap.get('id');
  readonly isEditMode = !!this.readingId;
  private readonly originalReading = this.isEditMode
    ? this.readingService.getReading(this.readingId!)
    : null;

  form = this.fb.group({
    meterId: ['', Validators.required],
    value: [null as number | null, [Validators.required, Validators.min(0), maxDecimalPlaces(3)]],
    date: [toDateInputValue(new Date()), Validators.required],
    note: [''],
  });

  private readonly formSignal = signal(this.form.getRawValue());

  private readonly numericFormValue = computed(() => {
    const rawValue = this.formSignal().value;
    if (rawValue === null || rawValue === undefined) return null;
    const valueStr = String(rawValue).trim();
    if (valueStr === '') return null;
    const numericValue = Number(valueStr.replace(',', '.'));
    return isNaN(numericValue) ? null : numericValue;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.formSignal.set(this.form.getRawValue());
    });

    if (this.isEditMode && this.originalReading) {
      this.form.patchValue({
        ...this.originalReading,
        date: toDateInputValue(new Date(this.originalReading.date)),
      });
      this.formSignal.set(this.form.getRawValue());
      this.form.controls.meterId.disable();
      if (this.originalReading.photo) {
        this.existingPhotoPath.set(this.originalReading.photo);
        const isStoragePath = !this.originalReading.photo.startsWith('http');
        if (isStoragePath) {
          this.apiService
            .getSignedPhotoUrl(this.originalReading.photo)
            .then((url) => this.existingPhotoSignedUrl.set(url))
            .catch(() => {});
        } else {
          this.existingPhotoSignedUrl.set(this.originalReading.photo);
        }
      }
    } else {
      const meterId = this.route.snapshot.queryParamMap.get('meterId');
      if (meterId) {
        this.form.patchValue({ meterId });
        this.formSignal.set(this.form.getRawValue());
      } else if (this.activeMeters().length === 1) {
        this.form.patchValue({ meterId: this.activeMeters()[0].id });
        this.formSignal.set(this.form.getRawValue());
      }
    }
  }

  readonly isSaveDisabled = computed(() => {
    const value = this.numericFormValue();
    const max = this.maxValue();
    return (
      this.form.invalid || !this.selectedMeter() || (max !== null && value !== null && value > max)
    );
  });

  readonly selectedMeter = computed(() => {
    const id = this.formSignal().meterId;
    return id ? this.meterService.getMeter(id) : null;
  });

  readonly lastReading = computed(() => {
    const meter = this.selectedMeter();
    if (!meter) return null;
    const readings = this.readingService.getReadingsForMeter(meter.id);
    return readings[0] ?? null;
  });

  readonly consumptionPreview = computed(() => {
    const meter = this.selectedMeter();
    const value = this.numericFormValue();
    const date = this.formSignal().date;
    const last = this.lastReading();

    if (!meter || value === null || !date) return null;

    const tariff = this.tariffService.getActiveTariffForDate(meter, parseDateInput(date));
    if (!tariff) return { consumption: 0, kwh: 0, cost: 0 };

    const consumption = last ? value - last.value : 0;
    if (consumption < 0) return null;

    let kwh: number | undefined;
    let cost: number;

    if (meter.type === 'gas') {
      const calorificValue =
        tariff.calorificValue ?? meter.calorificValue ?? GAS_DEFAULTS.CALORIFIC_VALUE;
      const zNumber = tariff.zNumber ?? meter.zNumber ?? GAS_DEFAULTS.Z_NUMBER;
      kwh = consumption * calorificValue * zNumber;
      cost = kwh * tariff.pricePerUnit;
    } else {
      cost = consumption * tariff.pricePerUnit;
    }
    return { consumption, kwh, cost };
  });

  // Findet den zeitlich vorherigen Eintrag basierend auf dem gewählten Datum
  readonly previousReading = computed(() => {
    const meter = this.selectedMeter();
    const selectedDate = this.formSignal().date;
    if (!meter || !selectedDate) return null;

    const readings = this.readingService.getReadingsForMeter(meter.id);
    const selected = new Date(selectedDate).getTime();

    const before = readings
      .filter((r) => {
        // Im Edit-Modus den eigenen Eintrag ausschließen
        if (this.isEditMode && r.id === this.originalReading?.id) return false;
        return new Date(r.date).getTime() < selected;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return before[0] ?? null;
  });

  readonly nextReading = computed(() => {
    const meter = this.selectedMeter();
    const selectedDate = this.formSignal().date;
    if (!meter || !selectedDate) return null;

    const readings = this.readingService.getReadingsForMeter(meter.id);
    const selected = new Date(selectedDate).getTime();

    const after = readings
      .filter((r) => {
        // Im Edit-Modus den eigenen Eintrag ausschließen
        if (this.isEditMode && r.id === this.originalReading?.id) return false;
        return new Date(r.date).getTime() > selected;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return after[0] ?? null;
  });

  readonly minValue = computed(() => {
    return this.previousReading()?.value ?? 0;
  });

  readonly maxValue = computed(() => {
    return this.nextReading()?.value ?? null;
  });

  selectMeter(id: string): void {
    this.form.patchValue({ meterId: id });
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    // Client-side guard (the `accept` attribute is only a hint). The server
    // enforces type/size independently (security-standards §3).
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const maxBytes = 10 * 1024 * 1024;
    if ((file.type && !allowed.includes(file.type)) || file.size > maxBytes) {
      input.value = '';
      this.snackBar.open(
        $localize`:@@readingsForm.photo.invalidFile:Bild muss JPG/PNG/WebP/HEIC und ≤ 10 MB sein.`,
        'OK',
        { duration: 5000 },
      );
      return;
    }
    // HEIC → JPEG right away: preview, OCR and later display then work in every
    // browser (only Safari renders HEIC), and the stored photo is a JPEG.
    let photo = file;
    this.photoConverting.set(true);
    try {
      photo = await this.ocrService.toJpegIfHeic(file);
    } catch (e) {
      console.error('HEIC conversion failed:', e);
      input.value = '';
      this.snackBar.open(
        $localize`:@@readingsForm.photo.heicError:HEIC-Foto konnte nicht umgewandelt werden – bitte als JPG auswählen.`,
        'OK',
        { duration: 6000 },
      );
      return;
    } finally {
      this.photoConverting.set(false);
    }

    const prev = this.photoPreviewUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.selectedPhotoFile.set(photo);
    this.photoPreviewUrl.set(URL.createObjectURL(photo));
    // Reset previous OCR result when a new photo is selected
    this.ocrResult.set(null);
  }

  clearPhoto(): void {
    const prev = this.photoPreviewUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.selectedPhotoFile.set(null);
    this.photoPreviewUrl.set(null);
    this.ocrResult.set(null);
  }

  removeExistingPhoto(): void {
    this.existingPhotoRemoved.set(true);
  }

  async runOcr(): Promise<void> {
    const file = this.selectedPhotoFile();
    if (!file || this.ocrRunning()) return;

    this.ocrRunning.set(true);
    this.ocrResult.set(null);
    try {
      const result = await this.ocrService.recognizeMeterValue(file);
      this.ocrResult.set(result);
    } catch (e) {
      console.error('OCR failed:', e);
      this.snackBar.open(
        $localize`:@@readingsForm.ocr.error:Texterkennung fehlgeschlagen – bitte Wert manuell eingeben`,
        'OK',
        { duration: 5000 },
      );
    } finally {
      this.ocrRunning.set(false);
    }
  }

  applyOcrValue(): void {
    const result = this.ocrResult();
    if (result?.value == null) return;
    this.form.patchValue({ value: result.value });
    this.formSignal.set(this.form.getRawValue());
    this.ocrResult.set(null);
  }

  dismissOcr(): void {
    this.ocrResult.set(null);
  }

  getMeta(type: string) {
    return ENERGY_META[type as keyof typeof ENERGY_META];
  }

  getValueError(): string {
    const control = this.form.get('value');
    const value = this.numericFormValue();
    if (control?.hasError('required')) return 'Bitte Zählerstand eingeben';
    if (control?.hasError('min'))
      return `Wert muss mindestens ${this.minValue()} sein (vorherige Ablesung)`;
    if (this.maxValue() !== null && value !== null && value > this.maxValue()!)
      return `Wert darf maximal ${this.maxValue()} sein (nächste Ablesung)`;
    if (control?.hasError('maxDecimalPlaces')) return 'Maximal 3 Nachkommastellen erlaubt';
    return '';
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.isSaving.set(true);

    const rawValue = this.form.getRawValue();
    const numericValue = this.numericFormValue();

    if (numericValue === null) {
      this.snackBar.open(
        $localize`:@@readingsForm.invalidValue:Ungültiger Wert für Zählerstand.`,
        'OK',
        {
          duration: 5000,
          panelClass: 'error-snackbar',
        },
      );
      return;
    }

    try {
      // ── Reading speichern, dann Foto ──────────────────────────
      // Der REST-Foto-Endpunkt setzt `reading.photo` serverseitig und braucht
      // die Reading-ID, daher: erst Reading speichern, dann Foto hochladen bzw.
      // entfernen.
      let readingId: string;
      if (this.isEditMode && this.originalReading) {
        const changes: Partial<MeterReading> = {
          value: numericValue,
          date: parseDateInput(rawValue.date!),
          note: rawValue.note ?? undefined,
        };
        await this.readingService.updateReading(this.originalReading.id, changes);
        readingId = this.originalReading.id;
      } else {
        const saved = await this.readingService.addReading({
          meterId: rawValue.meterId!,
          value: numericValue,
          date: parseDateInput(rawValue.date!),
          note: rawValue.note ?? undefined,
        });
        readingId = saved.id;
      }

      let photoError: string | null = null;
      if (this.selectedPhotoFile()) {
        this.isUploading.set(true);
        try {
          await this.apiService.uploadPhoto(this.selectedPhotoFile()!, readingId);
        } catch (e) {
          console.error('Photo upload failed:', e);
          photoError = errorMessage(e);
        } finally {
          this.isUploading.set(false);
        }
      } else if (this.existingPhotoRemoved()) {
        try {
          await this.apiService.removePhoto(readingId);
        } catch (e) {
          console.error('Photo removal failed:', e);
        }
      }

      if (photoError) {
        // The reading itself is saved — say that the photo is not, instead of
        // silently reporting success. No retry here: saving again would create
        // a duplicate reading.
        this.snackBar.open(
          $localize`:@@readingsForm.photo.uploadError:Ablesung gespeichert, Foto aber nicht: ${photoError}:reason:`,
          'OK',
          { duration: 8000, panelClass: 'error-snackbar' },
        );
      } else {
        this.snackBar.open($localize`:@@readingsForm.saved:Ablesung gespeichert`, 'OK', {
          duration: 3000,
        });
      }
      this.readingService.goBack();
    } catch (error) {
      console.error('Error saving reading:', error);
      this.snackBar.open(
        $localize`:@@readingsForm.saveError:Fehler beim Speichern der Ablesung`,
        'OK',
        {
          duration: 5000,
          panelClass: 'error-snackbar',
        },
      );
    } finally {
      this.isSaving.set(false);
    }
  }
}

/** Readable reason from Supabase/JS errors for user-facing messages. */
function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) return String(e.message);
  return String(e);
}
