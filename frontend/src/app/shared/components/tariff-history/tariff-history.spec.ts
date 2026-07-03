import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TariffHistory } from './tariff-history';
import { MeterConfig, EnergyType } from '../../../core/models/energy.models';
import { vi } from 'vitest';

describe('TariffHistory', () => {
  let component: TariffHistory;
  let fixture: ComponentFixture<TariffHistory>;

  const mockMeter: MeterConfig = {
    id: '1',
    name: 'Test Meter',
    type: EnergyType.Electricity,
    unit: 'kWh',
    color: '#ff0000',
    icon: 'bolt',
    active: true,
    createdAt: new Date('2024-01-01'),
    tariffHistory: [],
  };

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

    await TestBed.configureTestingModule({
      imports: [TariffHistory, NoopAnimationsModule],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(TariffHistory);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('meter', mockMeter);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
