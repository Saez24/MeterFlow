import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormField, applyEach, form, min, required, validate } from '@angular/forms/signals';
import { MatIconModule } from '@angular/material/icon';
import {
  AdvancePayment,
  AdvancePaymentYear,
  MONTH_NAMES_FULL,
  MeterConfig,
  PaymentInterval,
} from '../../../core/models/energy.models';
import { AdvancePaymentService } from '../../../core/services/advance-payment.service';
import { MeterService } from '../../../core/services/meter.service';
import {
  advancePaymentsForYear,
  calculateCostPreview,
} from '../../../core/utils/cost-preview.calc';

const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const INTERVAL_OPTIONS: readonly { value: PaymentInterval; label: string }[] = [
  { value: 1, label: 'Monatlich' },
  { value: 3, label: 'Vierteljährlich' },
];

interface AdvancePaymentFormModel {
  estimatedConsumption: number | null;
  estimatedGardenConsumption: number | null;
  interval: PaymentInterval;
  payments: AdvancePayment[];
}

function toFormModel(saved: AdvancePaymentYear | null): AdvancePaymentFormModel {
  return {
    estimatedConsumption: saved?.estimatedConsumption ?? null,
    estimatedGardenConsumption: saved?.estimatedGardenConsumption ?? null,
    interval: saved?.interval ?? 1,
    payments: saved
      ? saved.payments.map((p) => ({ ...p }))
      : ALL_MONTHS.map((month) => ({ month, amount: null })),
  };
}

/** Höchstzahl an Abschlägen ab `start` im Rhythmus `interval` bis Dezember. */
function maxPayments(start: number, interval: PaymentInterval): number {
  return Math.floor((12 - start) / interval) + 1;
}

/**
 * `count` Abschläge ab `start` im Abstand von `interval` Monaten (gekappt
 * auf Dezember). Beträge bleiben in ihrer Reihenfolge erhalten.
 */
function scheduleRows(
  start: number,
  interval: PaymentInterval,
  count: number,
  previous: readonly AdvancePayment[],
): AdvancePayment[] {
  const length = Math.max(1, Math.min(count, maxPayments(start, interval)));
  return Array.from({ length }, (_, i) => ({
    month: start + i * interval,
    amount: previous[i]?.amount ?? null,
  }));
}

function sameRows(a: readonly AdvancePayment[], b: readonly AdvancePayment[]): boolean {
  return (
    a.length === b.length &&
    a.every((p, i) => p.month === b[i].month && (p.amount ?? null) === (b[i].amount ?? null))
  );
}

@Component({
  selector: 'app-cost-preview',
  imports: [CommonModule, FormField, MatIconModule],
  templateUrl: './cost-preview.html',
  styleUrl: './cost-preview.scss',
})
export class CostPreview {
  private readonly advancePaymentService = inject(AdvancePaymentService);
  private readonly meterService = inject(MeterService);

  readonly meter = input.required<MeterConfig>();

  readonly monthNames = MONTH_NAMES_FULL;
  readonly startOptions = ALL_MONTHS;
  readonly intervalOptions = INTERVAL_OPTIONS;

  readonly selectedYear = signal(new Date().getFullYear());

  readonly yearOptions = computed(() => {
    const current = new Date().getFullYear();
    const saved = (this.meter().advancePayments ?? []).map((e) => e.year);
    return [...new Set([current - 1, current, current + 1, ...saved])].sort((a, b) => a - b);
  });

  /** Wasserzähler mit verknüpftem Gartenwasser: Gartenwasser wird vom Abwasser abgezogen. */
  readonly hasLinkedGardenWater = computed(() => {
    const id = this.meter().id;
    return (
      this.meter().type === 'water' &&
      this.meterService
        .meters()
        .some((m) => m.type === 'garden_water' && m.linkedWaterMeterId === id)
    );
  });

  /** Gespeicherter Stand für das gewählte Jahr — Basis der Vorschau. */
  readonly savedEntry = computed(() => advancePaymentsForYear(this.meter(), this.selectedYear()));

  // Formularmodell; wird bei Jahreswechsel oder nach dem Speichern aus dem gespeicherten Stand befüllt
  readonly model = linkedSignal(() => toFormModel(this.savedEntry()));

  readonly paymentForm = form(this.model, (p) => {
    required(p.estimatedConsumption, {
      message: 'Bitte einen geschätzten Jahresverbrauch eingeben.',
    });
    validate(p.estimatedConsumption, ({ value }) => {
      const v = value();
      return v !== null && v <= 0
        ? { kind: 'positive', message: 'Der Jahresverbrauch muss größer 0 sein.' }
        : undefined;
    });
    min(p.estimatedGardenConsumption, 0, {
      message: 'Der Gartenwasserverbrauch darf nicht negativ sein.',
    });
    validate(p.estimatedGardenConsumption, ({ value, valueOf }) => {
      const garden = value();
      const total = valueOf(p.estimatedConsumption);
      return garden !== null && total !== null && garden > total
        ? {
            kind: 'gardenAboveTotal',
            message: 'Der Gartenwasserverbrauch darf nicht größer als der Jahresverbrauch sein.',
          }
        : undefined;
    });
    applyEach(p.payments, (row) => {
      min(row.amount, 0, { message: 'Abschläge dürfen nicht negativ sein.' });
    });
  });

  readonly rows = computed(() => this.model().payments);
  readonly paymentCount = computed(() => this.rows().length);
  readonly startMonth = computed(() => this.rows()[0]?.month ?? 1);
  readonly interval = computed(() => this.model().interval);
  // Abschläge laufen im gewählten Rhythmus bis höchstens Dezember des Jahres
  readonly countOptions = computed(() =>
    ALL_MONTHS.slice(0, maxPayments(this.startMonth(), this.interval())),
  );

  readonly formErrors = computed(() => [
    ...new Set(
      this.paymentForm()
        .errorSummary()
        .map((e) => e.message ?? e.kind),
    ),
  ]);

  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly dirty = computed(() => {
    const saved = this.savedEntry();
    const current = this.model();
    if (!saved) return true;
    return (
      saved.estimatedConsumption !== current.estimatedConsumption ||
      (saved.estimatedGardenConsumption ?? null) !== current.estimatedGardenConsumption ||
      (saved.interval ?? 1) !== current.interval ||
      !sameRows(saved.payments, current.payments)
    );
  });

  readonly result = computed(() => {
    const saved = this.savedEntry();
    return saved ? calculateCostPreview(this.meter(), saved) : null;
  });

  readonly noTariff = computed(() => this.savedEntry() !== null && this.result() === null);

  selectYear(year: number): void {
    this.selectedYear.set(year);
    this.saveError.set(null);
  }

  /** Ändert die Anzahl; die Monate folgen ab dem ersten Abschlag dem Rhythmus. */
  setPaymentCount(count: number): void {
    this.reschedule(this.startMonth(), this.interval(), count);
  }

  /** Verschiebt alle Abschläge so, dass sie im gewählten Monat beginnen. */
  setStartMonth(start: number): void {
    this.reschedule(start, this.interval(), this.paymentCount());
  }

  /** Wechselt den Rhythmus; die Anzahl springt auf alle Termine bis Dezember. */
  setInterval(interval: PaymentInterval): void {
    const start = this.startMonth();
    this.reschedule(start, interval, maxPayments(start, interval));
  }

  async save(event?: Event): Promise<void> {
    event?.preventDefault();
    const { estimatedConsumption, estimatedGardenConsumption, payments } = this.model();
    if (this.paymentForm().invalid() || estimatedConsumption === null) return;

    const entry: AdvancePaymentYear = {
      year: this.selectedYear(),
      estimatedConsumption,
      ...(this.hasLinkedGardenWater() && estimatedGardenConsumption !== null
        ? { estimatedGardenConsumption }
        : {}),
      interval: this.model().interval,
      // Nur die Daten übernehmen — Signal Forms markiert Array-Elemente intern
      payments: payments.map(({ month, amount }) => ({ month, amount })),
    };

    this.saving.set(true);
    this.saveError.set(null);
    try {
      await this.advancePaymentService.saveYear(this.meter().id, entry);
    } catch {
      this.saveError.set('Speichern fehlgeschlagen. Bitte Eingaben prüfen und erneut versuchen.');
    } finally {
      this.saving.set(false);
    }
  }

  private reschedule(start: number, interval: PaymentInterval, count: number): void {
    this.model.update((m) => ({
      ...m,
      interval,
      payments: scheduleRows(start, interval, count, m.payments),
    }));
  }
}
