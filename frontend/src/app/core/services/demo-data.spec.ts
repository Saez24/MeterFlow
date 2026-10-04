import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { EnergyType, MeterConfig, MeterReading } from '../models/energy.models';
import { ApiService, validateAdvancePayments } from './api.service';
import { apiServiceMock } from './api.service.mock';
import { buildDemoData } from './demo-data';
import { MeterService } from './meter.service';
import { ReadingService } from './reading.service';

const TODAY = new Date('2026-10-04T10:00:00');

describe('buildDemoData', () => {
  it('matches the app calculation exactly (recalculation changes nothing)', async () => {
    const api = apiServiceMock();
    const updateReading = vi.fn(async () => {});
    (api as unknown as { updateReading: typeof updateReading }).updateReading = updateReading;
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        provideRouter([]),
        provideZonelessChangeDetection(),
      ],
    });
    const meterService = TestBed.inject(MeterService);
    const readingService = TestBed.inject(ReadingService);
    // Let the constructors' initial (empty) loads settle before seeding state.
    await new Promise((resolve) => setTimeout(resolve));

    const demo = buildDemoData(TODAY);
    // Same shape as ApiService.mapMeter / mapReading produce after the import.
    meterService.meters.set(
      demo.meters.map((m) => ({ ...m, createdAt: TODAY }) as unknown as MeterConfig),
    );
    readingService.readings.set(
      demo.readings.map((r) => ({ ...r, date: new Date(r.date) }) as MeterReading),
    );

    for (const meter of demo.meters) {
      await readingService.recalculateAllReadingsForMeter(meter.id);
    }

    expect(updateReading).not.toHaveBeenCalled();
  });

  it('produces valid advance payments for every meter', () => {
    for (const meter of buildDemoData(TODAY).meters) {
      expect(() =>
        validateAdvancePayments(
          meter.advancePayments,
          meter.type,
          meter.linkedWaterMeterId ?? null,
        ),
      ).not.toThrow();
    }
  });

  it('links the garden water meter to the water meter', () => {
    const { meters } = buildDemoData(TODAY);
    const water = meters.find((m) => m.type === EnergyType.Water)!;
    const garden = meters.find((m) => m.type === EnergyType.GardenWater)!;
    expect(garden.linkedWaterMeterId).toBe(water.id);
  });

  it('creates fresh ids on every call', () => {
    const ids = (d: ReturnType<typeof buildDemoData>) => [
      ...d.meters.map((m) => m.id),
      ...d.readings.map((r) => r.id),
    ];
    const first = new Set(ids(buildDemoData(TODAY)));
    expect(ids(buildDemoData(TODAY)).some((id) => first.has(id))).toBe(false);
  });

  it('covers two years up to the current month and never lies in the future', () => {
    const { readings, meters } = buildDemoData(TODAY);
    const dates = readings.map((r) => r.date).sort();
    expect(dates[0]).toBe('2024-10-01');
    expect(dates.at(-1)).toBe('2026-10-01');
    expect(readings).toHaveLength(meters.length * 25);
  });

  it('has a tariff for the first reading of every meter with tariffs', () => {
    const { meters } = buildDemoData(TODAY);
    for (const meter of meters.filter((m) => m.tariffHistory.length > 0)) {
      expect(meter.tariffHistory[0].validFrom <= '2024-10-01').toBe(true);
    }
  });
});
