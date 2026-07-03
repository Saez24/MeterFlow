import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { signal, computed } from '@angular/core';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReadingsForm } from './readings-form';
import { MeterService } from '../../../core/services/meter.service';
import { ReadingService } from '../../../core/services/reading.service';
import { TariffService } from '../../../core/services/tariff.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MeterConfig, MeterReading, EnergyType, TariffPeriod } from '../../../core/models/energy.models';
import { vi } from 'vitest';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const ELEC_METER: MeterConfig = {
  id: 'meter-1',
  name: 'Strom',
  type: 'electricity' as EnergyType,
  unit: 'kWh',
  icon: 'bolt',
  color: '#FFD600',
  active: true,
  createdAt: new Date('2024-01-01'),
  tariffHistory: [
    { id: 't1', validFrom: new Date('2024-01-01'), pricePerUnit: 0.30, baseCharge: 5 },
  ],
};

function makeReading(
  id: string,
  meterId: string,
  date: string,
  value: number,
  extras: Partial<MeterReading> = {},
): MeterReading {
  return { id, meterId, date: new Date(date), value, ...extras };
}

// ── Shared mock state ─────────────────────────────────────────────────────────
const metersSignal = signal<MeterConfig[]>([]);
const readingsSignal = signal<MeterReading[]>([]);

const mockMeterService = {
  meters: metersSignal,
  loading: signal(false),
  activeMeters: computed(() => metersSignal().filter((m) => m.active)),
  getMeter: (id: string) => metersSignal().find((m) => m.id === id),
};

const mockReadingService = {
  readings: readingsSignal,
  loading: signal(false),
  readingsByMeter: computed(() => new Map()),
  latestReadings: computed(() => new Map()),
  getReading: (id: string) => readingsSignal().find((r) => r.id === id),
  getReadingsForMeter: (meterId: string) =>
    readingsSignal()
      .filter((r) => r.meterId === meterId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
};

const mockTariffService = {
  getActiveTariffForDate: (meter: MeterConfig, date: Date): TariffPeriod | null => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const sorted = (meter.tariffHistory ?? [])
      .filter((p) => {
        const from = new Date(p.validFrom);
        from.setHours(0, 0, 0, 0);
        if (from > d) return false;
        if (p.validTo) {
          const to = new Date(p.validTo);
          to.setHours(0, 0, 0, 0);
          if (to < d) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime());
    return sorted[0] ?? null;
  },
};

const mockSupabaseService = {
  getSignedPhotoUrl: vi.fn().mockResolvedValue(null),
  uploadPhoto: vi.fn().mockResolvedValue('path/photo.jpg'),
  deletePhoto: vi.fn().mockResolvedValue(undefined),
};

// ── Basic smoke test (uses real services via TestBed) ─────────────────────────
describe('ReadingsForm', () => {
  let component: ReadingsForm;
  let fixture: ComponentFixture<ReadingsForm>;

  beforeEach(async () => {
    metersSignal.set([]);
    readingsSignal.set([]);

    await TestBed.configureTestingModule({
      imports: [ReadingsForm, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: MeterService, useValue: mockMeterService },
        { provide: ReadingService, useValue: mockReadingService },
        { provide: TariffService, useValue: mockTariffService },
        { provide: SupabaseService, useValue: mockSupabaseService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => null },
              queryParamMap: { get: () => null },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReadingsForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('isEditMode is false when no route id', () => {
    expect(component.isEditMode).toBe(false);
  });

  // ── consumptionPreview ─────────────────────────────────────────────────────
  describe('consumptionPreview', () => {
    it('returns null when no meter is selected', () => {
      expect(component.consumptionPreview()).toBeNull();
    });

    it('returns null when value is empty', () => {
      metersSignal.set([ELEC_METER]);
      component.form.patchValue({ meterId: 'meter-1', value: null });
      expect(component.consumptionPreview()).toBeNull();
    });

    it('calculates consumption and cost against last reading', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([makeReading('r1', 'meter-1', '2024-03-01', 1000)]);
      component.form.patchValue({ meterId: 'meter-1', value: 1100, date: new Date('2024-04-01') });
      const preview = component.consumptionPreview();
      expect(preview?.consumption).toBe(100);
      expect(preview?.cost).toBeCloseTo(30); // 100 kWh × 0.30 €
    });

    it('returns null when new value is less than last reading (negative consumption)', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([makeReading('r1', 'meter-1', '2024-03-01', 1000)]);
      component.form.patchValue({ meterId: 'meter-1', value: 900, date: new Date('2024-04-01') });
      expect(component.consumptionPreview()).toBeNull();
    });

    it('returns zero consumption when there is no previous reading', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([]);
      component.form.patchValue({ meterId: 'meter-1', value: 500, date: new Date('2024-04-01') });
      const preview = component.consumptionPreview();
      expect(preview?.consumption).toBe(0);
    });

    it('returns { cost: 0 } when no active tariff is found', () => {
      const meterNoTariff: MeterConfig = { ...ELEC_METER, tariffHistory: [] };
      metersSignal.set([meterNoTariff]);
      component.form.patchValue({ meterId: 'meter-1', value: 500, date: new Date('2020-01-01') });
      const preview = component.consumptionPreview();
      expect(preview?.cost).toBe(0);
    });
  });

  // ── previousReading ────────────────────────────────────────────────────────
  describe('previousReading', () => {
    it('returns null when no meter is selected', () => {
      expect(component.previousReading()).toBeNull();
    });

    it('returns the most recent reading before the selected date', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([
        makeReading('r1', 'meter-1', '2024-02-01', 900),
        makeReading('r2', 'meter-1', '2024-03-01', 1000),
        makeReading('r3', 'meter-1', '2024-05-01', 1200), // AFTER selected date
      ]);
      component.form.patchValue({ meterId: 'meter-1', date: new Date('2024-04-01') });
      expect(component.previousReading()?.id).toBe('r2');
    });

    it('returns null when all readings are after the selected date', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([makeReading('r1', 'meter-1', '2024-06-01', 1200)]);
      component.form.patchValue({ meterId: 'meter-1', date: new Date('2024-01-01') });
      expect(component.previousReading()).toBeNull();
    });
  });

  // ── minValue / maxValue ────────────────────────────────────────────────────
  describe('minValue and maxValue', () => {
    it('minValue defaults to 0 when no previous reading', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([]);
      component.form.patchValue({ meterId: 'meter-1', date: new Date('2024-04-01') });
      expect(component.minValue()).toBe(0);
    });

    it('minValue is the value of the previous reading', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([makeReading('r1', 'meter-1', '2024-03-01', 1000)]);
      component.form.patchValue({ meterId: 'meter-1', date: new Date('2024-04-01') });
      expect(component.minValue()).toBe(1000);
    });

    it('maxValue is null when no next reading', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([makeReading('r1', 'meter-1', '2024-01-01', 500)]);
      component.form.patchValue({ meterId: 'meter-1', date: new Date('2024-04-01') });
      expect(component.maxValue()).toBeNull();
    });

    it('maxValue is the value of the next reading', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([makeReading('r1', 'meter-1', '2024-06-01', 1500)]);
      component.form.patchValue({ meterId: 'meter-1', date: new Date('2024-04-01') });
      expect(component.maxValue()).toBe(1500);
    });
  });

  // ── isSaveDisabled ─────────────────────────────────────────────────────────
  describe('isSaveDisabled', () => {
    it('is true when form is invalid (no meterId)', () => {
      component.form.patchValue({ meterId: '', value: 100 });
      expect(component.isSaveDisabled()).toBe(true);
    });

    it('is true when no selectedMeter found', () => {
      metersSignal.set([]);
      component.form.patchValue({ meterId: 'unknown', value: 100 });
      expect(component.isSaveDisabled()).toBe(true);
    });

    it('is false when form is valid and meter exists', () => {
      metersSignal.set([ELEC_METER]);
      component.form.patchValue({ meterId: 'meter-1', value: 500, date: new Date('2024-04-01') });
      expect(component.isSaveDisabled()).toBe(false);
    });

    it('is true when value exceeds maxValue (next reading)', () => {
      metersSignal.set([ELEC_METER]);
      readingsSignal.set([makeReading('r1', 'meter-1', '2024-06-01', 800)]);
      component.form.patchValue({ meterId: 'meter-1', value: 900, date: new Date('2024-04-01') });
      expect(component.isSaveDisabled()).toBe(true);
    });
  });
});

