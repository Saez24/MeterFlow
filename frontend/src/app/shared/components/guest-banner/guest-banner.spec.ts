import { computed, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { ApiService } from '../../../core/services/api.service';
import { apiServiceMock } from '../../../core/services/api.service.mock';
import { GuestBanner } from './guest-banner';

describe('GuestBanner', () => {
  const render = async (guest: boolean): Promise<HTMLElement> => {
    const isGuest = signal(guest);
    const api = { ...apiServiceMock(), isGuest: computed(() => isGuest()) } as ApiService;
    await TestBed.configureTestingModule({
      imports: [GuestBanner],
      providers: [
        { provide: ApiService, useValue: api },
        provideRouter([]),
        provideZonelessChangeDetection(),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(GuestBanner);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('is shown for guests', async () => {
    expect((await render(true)).querySelector('.guest-banner')).not.toBeNull();
  });

  it('is hidden for regular accounts', async () => {
    expect((await render(false)).querySelector('.guest-banner')).toBeNull();
  });
});
