import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../../core/services/api.service';
import { apiServiceMock } from '../../../core/services/api.service.mock';
import { GuestLogin } from './guest-login';

describe('GuestLogin', () => {
  let fixture: ComponentFixture<GuestLogin>;
  let api: ApiService;

  beforeEach(async () => {
    api = apiServiceMock();
    await TestBed.configureTestingModule({
      imports: [GuestLogin],
      providers: [
        { provide: ApiService, useValue: api },
        provideRouter([]),
        provideZonelessChangeDetection(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GuestLogin);
    await fixture.whenStable();
  });

  it('signs in as guest and navigates to the dashboard', async () => {
    const signIn = vi.spyOn(api, 'signInAsGuest');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.start();

    expect(signIn).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/']);
    expect(fixture.componentInstance.error()).toBe('');
  });

  it('shows an error and stays on the page when the guest sign-in fails', async () => {
    vi.spyOn(api, 'signInAsGuest').mockResolvedValue({ error: { message: 'disabled' } });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    await fixture.componentInstance.start();

    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).not.toBe('');
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
