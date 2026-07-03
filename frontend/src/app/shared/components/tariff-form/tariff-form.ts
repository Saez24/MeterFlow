import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormGroup,
} from '@angular/forms';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TariffPeriod, MeterConfig } from '../../../core/models/energy.models';
import { TariffService } from '../../../core/services/tariff.service';
import { MeterService } from '../../../core/services/meter.service';
import { ReadingService } from '../../../core/services/reading.service';

export interface TariffFormData {
  meter: MeterConfig;
  tariffId?: string; // For edit mode
}

@Component({
  selector: 'app-tariff-form',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatSnackBarModule,
    MatDividerModule,
  ],
  templateUrl: './tariff-form.html',
  styleUrls: ['./tariff-form.scss'],

})
export class TariffFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tariffService = inject(TariffService);
  private readonly meterService = inject(MeterService);
  private readonly readingService = inject(ReadingService);
  private readonly snackBar = inject(MatSnackBar);
  public readonly dialogRef = inject(MatDialogRef<TariffFormComponent>);
  public readonly data: TariffFormData = inject(MAT_DIALOG_DATA);

  readonly meter = signal(this.data.meter);
  readonly isEdit = computed(() => !!this.data.tariffId);
  private originalTariff = this.isEdit() ? this.tariffService.getTariff(this.meter().id, this.data.tariffId!) : null;

  form: FormGroup = this.fb.group({
    pricePerUnit: [0, [Validators.required, Validators.min(0)]],
    baseCharge: [0, [Validators.required, Validators.min(0)]],
    validFrom: [new Date(), Validators.required],
    emissionPrice: [undefined as number | undefined],
    basePricePerKw: [undefined as number | undefined],
    connectedLoadKw: [this.data.meter.connectedLoadKw ?? undefined as number | undefined, [Validators.min(0)]],
    wastewaterPrice: [undefined as number | undefined],
    calorificValue: [undefined as number | undefined],
    zNumber: [undefined as number | undefined],
    note: [''],
  });

  readonly isGas = computed(() => this.meter().type === 'gas');
  readonly isWater = computed(() => this.meter().type === 'water');
  readonly isLinkedGardenWater = computed(() => this.meter().type === 'garden_water' && !!this.meter().linkedWaterMeterId);
  readonly isDistrictHeating = computed(() => this.meter().type === 'fernwarme');
  readonly isElectricity = computed(() => this.meter().type === 'electricity');
  readonly isSolar = computed(() => this.meter().type === 'solar');

  constructor() {
    if (this.isLinkedGardenWater() || this.isDistrictHeating()) {
      this.form.controls['baseCharge'].disable();
      this.form.patchValue({ baseCharge: 0 });
    }

    if (this.isEdit() && this.originalTariff) {
      this.form.patchValue(this.originalTariff);
    } else {
      // Set defaults for new tariffs
      const lastTariff = this.tariffService.getActiveTariff(this.meter());
      if (this.isGas()) {
        this.form.patchValue({
          calorificValue: this.meter().calorificValue,
          zNumber: this.meter().zNumber,
        });
      }
      if (this.isDistrictHeating()) {
        this.form.patchValue({
          emissionPrice: lastTariff?.emissionPrice ?? 0,
          basePricePerKw: lastTariff?.basePricePerKw ?? 0,
          connectedLoadKw: this.meter().connectedLoadKw ?? 10,
        });
      }
      if (this.isWater()) {
        this.form.patchValue({
          wastewaterPrice: lastTariff?.wastewaterPrice ?? 0,
        });
      }
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    const formValue = this.form.getRawValue();
    const tariffData: Partial<TariffPeriod> = {
      pricePerUnit: formValue.pricePerUnit,
      baseCharge: (this.isLinkedGardenWater() || this.isDistrictHeating()) ? 0 : formValue.baseCharge,
      validFrom: formValue.validFrom,
      note: formValue.note,
    };

    if (this.isGas()) {
      tariffData.calorificValue = formValue.calorificValue;
      tariffData.zNumber = formValue.zNumber;
    }
    if (this.isWater()) {
      tariffData.wastewaterPrice = formValue.wastewaterPrice;
    }

    if (this.isDistrictHeating()) {
      tariffData.emissionPrice = formValue.emissionPrice;
      tariffData.basePricePerKw = formValue.basePricePerKw;
      if (formValue.connectedLoadKw != null) {
        await this.meterService.updateMeter(this.meter().id, {
          connectedLoadKw: formValue.connectedLoadKw,
        });
      }
    }

    if (this.isEdit()) {
      await this.tariffService.updateTariff(this.meter().id, this.data.tariffId!, tariffData);
      this.snackBar.open($localize`:@@tariffForm.updated:Tarif aktualisiert`, 'OK', { duration: 3000 });
    } else {
      await this.tariffService.addTariff(this.meter().id, tariffData as Omit<TariffPeriod, 'id'>);
      this.snackBar.open($localize`:@@tariffForm.added:Neuer Tarif hinzugefügt`, 'OK', { duration: 3000 });
    }

    await this.readingService.recalculateAllReadingsForMeter(this.meter().id);

    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
