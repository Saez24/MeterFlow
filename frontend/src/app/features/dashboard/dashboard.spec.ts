import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Dashboard } from './dashboard';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { SupabaseService } from '../../core/services/supabase.service';
import { EnergyService } from '../../core/services/energy.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

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
      imports: [Dashboard, NoopAnimationsModule],
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

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
