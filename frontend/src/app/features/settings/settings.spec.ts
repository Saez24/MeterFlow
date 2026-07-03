import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Settings } from './settings';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { SupabaseService } from '../../core/services/supabase.service';
import { EnergyService } from '../../core/services/energy.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('Settings', () => {
  let component: Settings;
  let fixture: ComponentFixture<Settings>;

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
      imports: [Settings, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        SupabaseService,
        EnergyService,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => null,
              },
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
