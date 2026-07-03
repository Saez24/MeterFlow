import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MeterDetail } from './meter-detail';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { SupabaseService } from '../../../core/services/supabase.service';
import { EnergyService } from '../../../core/services/energy.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

describe('MeterDetail', () => {
  let component: MeterDetail;
  let fixture: ComponentFixture<MeterDetail>;

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
      imports: [MeterDetail, NoopAnimationsModule],
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
                get: () => '1',
              },
              queryParamMap: {
                get: () => null,
              },
            },
            params: of({ id: '1' }),
            queryParams: of({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MeterDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
