import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { ApiService } from './api.service';

const API = environment.apiUrl;

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ApiService],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
    // The constructor probes the session — consume it as "logged out".
    http.expectOne(`${API}/auth/me`).flush(null, { status: 401, statusText: 'Unauthorized' });
  });

  afterEach(() => http.verify());

  it('signIn posts credentials and sets currentUser', async () => {
    const promise = api.signIn('a@b.c', 'pw');
    const req = http.expectOne(`${API}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.c', password: 'pw' });
    req.flush({ id: 'u1', email: 'a@b.c' });

    expect((await promise).error).toBeNull();
    expect(api.currentUser()?.id).toBe('u1');
  });

  it('signIn surfaces the backend detail message on 401', async () => {
    const promise = api.signIn('a@b.c', 'wrong');
    http
      .expectOne(`${API}/auth/login`)
      .flush({ detail: 'Invalid credentials' }, { status: 401, statusText: 'x' });

    expect((await promise).error?.message).toBe('Invalid credentials');
    expect(api.currentUser()).toBeNull();
  });

  it('getMeters maps decimals→numbers and createdAt→Date', async () => {
    const promise = api.getMeters();
    const req = http.expectOne(`${API}/meters/`);
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: 'm1',
        name: 'Strom',
        type: 'electricity',
        unit: 'kWh',
        icon: 'bolt',
        color: '#000',
        active: true,
        archived: false,
        calorificValue: '10.500000',
        linkedWaterMeterId: null,
        tariffHistory: [],
        budget: null,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]);

    const meters = await promise;
    expect(meters[0].calorificValue).toBe(10.5);
    expect(meters[0].createdAt instanceof Date).toBe(true);
  });

  it('addReading sends a camelCase body with an ISO date', async () => {
    const promise = api.addReading({
      meterId: 'm1',
      date: new Date('2026-02-01T12:00:00Z'),
      value: 1200,
    } as never);
    const req = http.expectOne(`${API}/readings/`);
    expect(req.request.body).toEqual({
      meterId: 'm1',
      date: '2026-02-01',
      value: 1200,
      note: null,
    });
    req.flush({
      id: 'r1',
      meterId: 'm1',
      date: '2026-02-01',
      value: '1200.000000',
      createdAt: '2026-02-01T00:00:00Z',
    });

    const reading = await promise;
    expect(reading.value).toBe(1200);
    expect(reading.date instanceof Date).toBe(true);
  });

  it('uploadPhoto posts multipart form data and returns the photo url', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'p.png', { type: 'image/png' });
    const promise = api.uploadPhoto(file, 'r1');
    const req = http.expectOne(`${API}/readings/r1/photo/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ photo: `${API}/readings/r1/photo/` });

    expect(await promise).toBe(`${API}/readings/r1/photo/`);
  });

  it('getCo2Factors returns { data, error } on success', async () => {
    const promise = api.getCo2Factors();
    http.expectOne(`${API}/co2-factors/`).flush([{ id: 'c1', energyType: 'gas' }]);

    const result = await promise;
    expect(result.error).toBeNull();
    expect(result.data?.length).toBe(1);
  });
});
