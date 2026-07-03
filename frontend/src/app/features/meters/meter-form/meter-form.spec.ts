import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';

import { MeterForm } from './meter-form';
import { MeterService } from '../../../core/services/meter.service';
import { ReadingService } from '../../../core/services/reading.service';
import { TariffService } from '../../../core/services/tariff.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('MeterForm', () => {
  let component: MeterForm;
  let fixture: ComponentFixture<MeterForm>;

  beforeEach(async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const mockMeterService = {
      meters: signal([]),
      getMeter: vi.fn(),
      updateMeter: vi.fn(),
      addMeter: vi.fn(),
    };

    const mockSnackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [MeterForm, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => null,
              },
            },
          },
        },
        { provide: MeterService, useValue: mockMeterService },
        { provide: ReadingService, useValue: {} },
        { provide: TariffService, useValue: {} },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MeterForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
