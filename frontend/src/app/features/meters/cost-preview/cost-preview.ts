import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormField, applyEach, form, min, required, validate } from '@angular/forms/signals';
import { MatIconModule } from '@angular/material/icon';
import {
  AdvancePayment,
  AdvancePaymentYear,
  MONTH_NAMES_FULL,
  MeterConfig,
} from '../../../core/models/energy.models';
import { AdvancePaymentService } from '../../../core/services/advance-payment.service';
import {
  advancePaymentsForYear,
  calculateCostPreview,
} from '../../../core/utils/cost-preview.calc';

const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface AdvancePaymentFormModel {
  estimatedConsumption: number | null;
  payments: AdvancePayment[];
}

function toFormModel(saved: AdvancePaymentYear | null): AdvancePaymentFormModel {
  return {
    estimatedConsumption: saved?.estimatedConsumption ?? null,
    payments: saved
      ? saved.payments.map((p) => ({ ...p }))
      : ALL_MONTHS.map((month) => ({ month, amount: null })),
  };
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

  readonly meter = input.required<MeterConfig>();

  readonly monthNames = MONTH_NAMES_FULL;
  readonly countOptions = ALL_MONTHS;

  readonly selectedYear = signal(new Date().getFullYear());

  readonly yearOptions = computed(() => {
    const current = new Date().getFullYear();
    const saved = (this.meter().advancePayments ?? []).map((e) => e.year);
    return [...new Set([current - 1, current, current + 1, ...saved])].sort((a, b) => a - b);
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
    applyEach(p.payments, (row) => {
      min(row.amount, 0, { message: 'Abschläge dürfen nicht negativ sein.' });
    });
  });

  readonly rows = computed(() => this.model().payments);
  readonly paymentCount = computed(() => this.rows().length);

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

  setPaymentCount(count: number): void {
    this.updatePayments((rows) => {
      if (count <= rows.length) return rows.slice(0, count);
      const used = new Set(rows.map((r) => r.month));
      const free = ALL_MONTHS.filter((m) => !used.has(m));
      const added = free.slice(0, count - rows.length).map((month) => ({ month, amount: null }));
      return [...rows, ...added].sort((a, b) => a.month - b.month);
    });
  }

  /** Monate, die in Zeile `index` wählbar sind (keine Doppelungen). */
  availableMonths(index: number): number[] {
    const taken = new Set(
      this.rows()
        .filter((_, i) => i !== index)
        .map((r) => r.month),
    );
    return ALL_MONTHS.filter((m) => !taken.has(m));
  }

  setMonth(index: number, month: number): void {
    this.updatePayments((rows) => rows.map((r, i) => (i === index ? { ...r, month } : r)));
  }

  async save(event?: Event): Promise<void> {
    event?.preventDefault();
    const { estimatedConsumption, payments } = this.model();
    if (this.paymentForm().invalid() || estimatedConsumption === null) return;

    const entry: AdvancePaymentYear = {
      year: this.selectedYear(),
      estimatedConsumption,
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

  private updatePayments(fn: (rows: AdvancePayment[]) => AdvancePayment[]): void {
    this.model.update((m) => ({ ...m, payments: fn(m.payments) }));
  }
}
