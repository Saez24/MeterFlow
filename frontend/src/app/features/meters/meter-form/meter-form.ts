import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormGroup,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, startWith } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ENERGY_META, EnergyType, MeterConfig } from '../../../core/models/energy.models';
import { MeterService } from '../../../core/services/meter.service';
import { GAS_DEFAULTS } from '../../../core/constants/gas.constants';

@Component({
  selector: 'app-meter-form',
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './meter-form.html',
  styleUrls: ['./meter-form.scss'],

})
export class MeterForm {
  private readonly meterService = inject(MeterService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  readonly isEdit = signal(false);
  private editId = signal<string | null>(null);

  readonly energyTypes = Object.entries(ENERGY_META).map(([value, meta]) => ({
    value: value as EnergyType,
    ...meta,
  }));

  // ✅ Formular mit korrekten Types und undefined statt null
  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    type: [EnergyType.Electricity, Validators.required], // ✅ Enum-Wert statt String-Literal
    provider: [''],
    meterNumber: [''],
    linkedWaterMeterId: [''],
    calorificValue: [undefined as number | undefined],
    zNumber: [undefined as number | undefined],
    connectedLoadKw: [undefined as number | undefined],
    notes: [''],
    active: [true],
  });

  readonly typeValue = toSignal(
    this.form
      .get('type')!
      .valueChanges.pipe(startWith(this.form.get('type')!.value)) as Observable<EnergyType>, // ✅ Expliziter Cast
    { requireSync: true }, // ✅ Kein initialValue nötig, Wert kommt synchron
  );

  // ✅ Computed Signals
  readonly isGas = computed(() => this.typeValue() === EnergyType.Gas);
  readonly isWater = computed(() =>
    [EnergyType.Water, EnergyType.GardenWater].includes(this.typeValue()),
  );
  readonly isHeatingOil = computed(() => this.typeValue() === EnergyType.HeatingOil);
  readonly isFernwarme = computed(() => this.typeValue() === EnergyType.Fernwärme);
  readonly isElectricity = computed(() => this.typeValue() === EnergyType.Electricity);
  readonly isGardenWater = computed(() => this.typeValue() === EnergyType.GardenWater);
  readonly isSolar = computed(() => this.typeValue() === EnergyType.Solar);

  readonly currentUnit = computed(() => {
    return ENERGY_META[this.typeValue()].unit;
  });

  readonly waterMeters = computed(() =>
    this.meterService.meters().filter((m: MeterConfig) => m.type === EnergyType.Water && m.active),
  );

  // Gas-Vorschau
  readonly gasPreview = computed(() => {
    const cv = this.form.get('calorificValue')?.value ?? GAS_DEFAULTS.CALORIFIC_VALUE;
    const z = this.form.get('zNumber')?.value ?? GAS_DEFAULTS.Z_NUMBER;
    return 100 * cv * z;
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit.set(true);
      this.editId.set(id);
      const meter = this.meterService.getMeter(id);
      if (meter) {
        this.form.patchValue({
          ...meter,
          calorificValue: meter.calorificValue ?? undefined,
          zNumber: meter.zNumber ?? undefined,
        });
      }
    }
  }

  selectType(type: EnergyType): void {
    this.form.patchValue({
      type,
      calorificValue: type === 'gas' ? GAS_DEFAULTS.CALORIFIC_VALUE : undefined,
      zNumber: type === 'gas' ? GAS_DEFAULTS.Z_NUMBER : undefined,
      linkedWaterMeterId: '',
    });
  }

  save(): void {
    if (this.form.invalid) {
      console.warn(
        '⚠️ Formular invalid:',
        Object.keys(this.form.controls)
          .filter((key) => this.form.get(key)?.invalid)
          .map((key) => ({ key, errors: this.form.get(key)?.errors })),
      );
      return;
    }

    const value = this.form.getRawValue() as MeterConfig;

    // 🔐 Type-Guard: Sicherstellen, dass type definiert und gültig ist
    if (!value.type || !Object.values(EnergyType).includes(value.type)) {
      this.snackBar.open($localize`:@@meterForm.invalidType:Ungültiger Zählertyp`, 'OK', { duration: 3000 });
      return;
    }

    const type = value.type; // ✅ Jetzt weiß TypeScript: type ist EnergyType
    const meta = ENERGY_META[type];

    // ✅ Nur definierte Werte für optionale Felder verwenden
    const meterData: Omit<MeterConfig, 'id' | 'createdAt'> = {
      name: value.name,
      type, // ✅ Garantiert EnergyType
      unit: meta.unit as any,
      icon: meta.icon,
      color: meta.color,
      active: value.active ?? true,
      // Optionale Felder nur hinzufügen, wenn sie einen Wert haben
      ...(value.linkedWaterMeterId && { linkedWaterMeterId: value.linkedWaterMeterId }),
      ...(value.calorificValue != null && { calorificValue: value.calorificValue }),
      ...(value.zNumber != null && { zNumber: value.zNumber }),
      ...(value.connectedLoadKw != null && { connectedLoadKw: value.connectedLoadKw }),
      ...(value.meterNumber && { meterNumber: value.meterNumber }),
      ...(value.provider && { provider: value.provider }),
      ...(value.notes && { notes: value.notes }),
    };

    if (this.isEdit() && this.editId()) {
      this.meterService.updateMeter(this.editId()!, meterData);
      this.snackBar.open($localize`:@@meterForm.saved:Zähler gespeichert`, 'OK', { duration: 3000 });
    } else {
      this.meterService.addMeter(meterData);
      this.snackBar.open($localize`:@@meterForm.created:Zähler angelegt`, 'OK', { duration: 3000 });
    }

    this.goBack();
  }

  goBack(): void {
    this.router.navigate(['/meters']);
  }
}
