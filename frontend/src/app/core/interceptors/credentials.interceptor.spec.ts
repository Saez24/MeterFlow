import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { credentialsInterceptor } from './credentials.interceptor';

const API = environment.apiUrl;
const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0));

describe('credentialsInterceptor', () => {
  let http: HttpClient;
  let mock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([credentialsInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    mock.verify();
    vi.restoreAllMocks();
  });

  it('sends credentials (cookies) with every request', () => {
    http.get(`${API}/meters/`).subscribe();
    const req = mock.expectOne(`${API}/meters/`);
    expect(req.request.withCredentials).toBe(true);
    req.flush([]);
  });

  it('on 401 refreshes once and retries the original request', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));

    let result: unknown;
    http.get(`${API}/meters/`).subscribe((r) => (result = r));

    // First attempt → 401 triggers the refresh.
    mock.expectOne(`${API}/meters/`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await flushMicrotasks();

    expect(fetchSpy).toHaveBeenCalledWith(
      `${API}/auth/refresh`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );

    // Retried request succeeds.
    mock.expectOne(`${API}/meters/`).flush([{ ok: true }]);
    await flushMicrotasks();
    expect(result).toEqual([{ ok: true }]);
  });

  it('does not attempt a refresh for auth endpoints', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    let error: unknown;
    http.post(`${API}/auth/login`, {}).subscribe({ error: (e) => (error = e) });

    mock
      .expectOne(`${API}/auth/login`)
      .flush({ detail: 'Invalid credentials' }, { status: 401, statusText: 'x' });
    await flushMicrotasks();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(error).toBeTruthy();
  });
});
