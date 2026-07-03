import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MeterConfig, MeterReading } from '../models/energy.models';

export interface AppUser {
  id: string;
  email: string;
}

interface AuthResult {
  error: { message: string } | null;
}

const num = (v: unknown): number | undefined =>
  v !== null && v !== undefined ? Number(v) : undefined;

const isoDate = (d: Date | string): string =>
  d instanceof Date ? d.toISOString().split('T')[0] : String(d);

/**
 * REST data layer against the Django backend (contract). Cookie-based JWT auth
 * (the credentials interceptor handles withCredentials + 401 refresh). The API
 * speaks camelCase, so response bodies map almost 1:1 — only dates and
 * decimal-strings need conversion.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  readonly connectionStatus = signal<'checking' | 'connected' | 'error'>('checking');
  readonly currentUser = signal<AppUser | null>(null);

  /** Resolves once the initial session probe has finished (used by guards). */
  readonly sessionReady: Promise<void>;
  private resolveReady!: () => void;

  constructor() {
    this.sessionReady = new Promise((resolve) => (this.resolveReady = resolve));
    void this.initSession();
  }

  private async initSession(): Promise<void> {
    try {
      const user = await firstValueFrom(this.http.get<AppUser>(`${this.base}/auth/me`));
      this.currentUser.set(user);
      this.connectionStatus.set('connected');
    } catch {
      // The interceptor already attempts a refresh on 401; if we still fail the
      // user is simply logged out.
      this.currentUser.set(null);
      this.connectionStatus.set('error');
    } finally {
      this.resolveReady();
    }
  }

  private authError(err: unknown, fallback: string): AuthResult {
    const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
    const message = Array.isArray(detail)
      ? String((detail[0] as { msg?: string })?.msg ?? fallback)
      : String(detail ?? fallback);
    return { error: { message } };
  }

  // ── Auth ────────────────────────────────────────────────────────────────
  async signUp(email: string, password: string): Promise<AuthResult> {
    try {
      const user = await firstValueFrom(
        this.http.post<AppUser>(`${this.base}/auth/register`, { email, password }),
      );
      this.currentUser.set(user);
      this.connectionStatus.set('connected');
      return { error: null };
    } catch (err) {
      return this.authError(err, 'Registrierung fehlgeschlagen');
    }
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const user = await firstValueFrom(
        this.http.post<AppUser>(`${this.base}/auth/login`, { email, password }),
      );
      this.currentUser.set(user);
      this.connectionStatus.set('connected');
      return { error: null };
    } catch (err) {
      return this.authError(err, 'Login fehlgeschlagen');
    }
  }

  async signOut(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.base}/auth/logout`, {}));
    } finally {
      this.currentUser.set(null);
    }
  }

  async getSession(): Promise<AppUser | null> {
    await this.sessionReady;
    return this.currentUser();
  }

  // ── Meters ──────────────────────────────────────────────────────────────
  async getMeters(): Promise<MeterConfig[]> {
    const data = await firstValueFrom(this.http.get<unknown[]>(`${this.base}/meters/`));
    return (data ?? []).map(this.mapMeter);
  }

  async addMeter(meter: Omit<MeterConfig, 'id' | 'createdAt'>): Promise<MeterConfig> {
    const data = await firstValueFrom(
      this.http.post<unknown>(`${this.base}/meters/`, this.meterBody(meter)),
    );
    return this.mapMeter(data);
  }

  async updateMeter(id: string, changes: Partial<MeterConfig>): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.base}/meters/${id}/`, this.meterBody(changes)));
  }

  async deleteMeter(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/meters/${id}/`));
  }

  // ── Readings ────────────────────────────────────────────────────────────
  async getReadings(): Promise<MeterReading[]> {
    const data = await firstValueFrom(this.http.get<unknown[]>(`${this.base}/readings/`));
    return (data ?? []).map(this.mapReading);
  }

  async addReading(reading: Omit<MeterReading, 'id'>): Promise<MeterReading> {
    const body = {
      meterId: reading.meterId,
      date: isoDate(reading.date),
      value: reading.value,
      note: reading.note ?? null,
    };
    const data = await firstValueFrom(this.http.post<unknown>(`${this.base}/readings/`, body));
    return this.mapReading(data);
  }

  async updateReading(id: string, changes: Partial<MeterReading>): Promise<void> {
    const body: Record<string, unknown> = {};
    if (changes.date !== undefined) body['date'] = isoDate(changes.date);
    if (changes.value !== undefined) body['value'] = changes.value;
    if (changes.note !== undefined) body['note'] = changes.note;
    await firstValueFrom(this.http.patch(`${this.base}/readings/${id}/`, body));
  }

  async deleteReading(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/readings/${id}/`));
  }

  async recalculateReadings(meterId: string): Promise<MeterReading[]> {
    const data = await firstValueFrom(
      this.http.post<unknown[]>(`${this.base}/readings/recalculate/${meterId}/`, {}),
    );
    return (data ?? []).map(this.mapReading);
  }

  // ── Photos ──────────────────────────────────────────────────────────────
  async uploadPhoto(file: File, readingId?: string): Promise<string> {
    if (!readingId) throw new Error('readingId required for photo upload');
    const formData = new FormData();
    formData.append('file', file);
    const data = await firstValueFrom(
      this.http.post<{ photo: string }>(`${this.base}/readings/${readingId}/photo/`, formData),
    );
    return data.photo;
  }

  /** Backend already returns a usable (signed) URL in `reading.photo`. */
  async getSignedPhotoUrl(path: string): Promise<string> {
    return path;
  }

  /** Photos are removed server-side together with their reading. */
  async deletePhoto(_path: string): Promise<void> {
    return;
  }

  // ── CO₂ factors ─────────────────────────────────────────────────────────
  async getCo2Factors(): Promise<{ data: unknown[] | null; error: unknown }> {
    try {
      const data = await firstValueFrom(this.http.get<unknown[]>(`${this.base}/co2-factors/`));
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async upsertCo2Factor(row: {
    energy_type: string;
    factor_kg_per_unit: number;
    unit: string;
    source: string;
    source_url: string | null;
    valid_from: string;
  }): Promise<void> {
    // snake_case keys pass through the camelCase parser unchanged.
    await firstValueFrom(this.http.put(`${this.base}/co2-factors/`, row));
  }

  async deleteCo2Factor(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/co2-factors/${id}`));
  }

  // ── Account: wipe all user data (account stays) ─────────────────────────
  async clearAllUserData(): Promise<void> {
    const readings = await this.getReadings();
    await Promise.all(readings.map((r) => this.deleteReading(r.id)));

    const meters = await this.getMeters();
    await Promise.all(meters.map((m) => this.deleteMeter(m.id)));

    const { data } = await this.getCo2Factors();
    await Promise.all((data ?? []).map((f) => this.deleteCo2Factor((f as { id: string }).id)));
  }

  async checkConnection(): Promise<void> {
    this.connectionStatus.set('checking');
    try {
      await firstValueFrom(this.http.get(`${this.base}/co2-factors/defaults`));
      this.connectionStatus.set('connected');
    } catch {
      this.connectionStatus.set('error');
    }
  }

  // ── Mappers (camelCase API → app models) ────────────────────────────────
  private mapMeter = (d: unknown): MeterConfig => {
    const m = d as Record<string, unknown>;
    return {
      id: m['id'] as string,
      name: m['name'] as string,
      type: m['type'] as MeterConfig['type'],
      unit: m['unit'] as MeterConfig['unit'],
      icon: m['icon'] as MeterConfig['icon'],
      color: m['color'] as string,
      active: m['active'] as boolean,
      createdAt: new Date(m['createdAt'] as string),
      linkedWaterMeterId: (m['linkedWaterMeterId'] as string) ?? undefined,
      calorificValue: num(m['calorificValue']),
      zNumber: num(m['zNumber']),
      connectedLoadKw: num(m['connectedLoadKw']),
      meterNumber: (m['meterNumber'] as string) ?? undefined,
      provider: (m['provider'] as string) ?? undefined,
      notes: (m['notes'] as string) ?? undefined,
      tariffHistory: (m['tariffHistory'] as MeterConfig['tariffHistory']) ?? [],
      budget: (m['budget'] as MeterConfig['budget']) ?? undefined,
    };
  };

  private mapReading = (d: unknown): MeterReading => {
    const r = d as Record<string, unknown>;
    return {
      id: r['id'] as string,
      meterId: r['meterId'] as string,
      value: Number(r['value']),
      date: new Date(r['date'] as string),
      consumption: num(r['consumption']),
      kwh: num(r['kwh']),
      cost: num(r['cost']),
      wastewaterCost: num(r['wastewaterCost']),
      totalCost: num(r['totalCost']),
      note: (r['note'] as string) ?? undefined,
      photo: (r['photo'] as string) ?? undefined,
    };
  };

  // ── Request bodies (app model → camelCase API, only defined fields) ─────
  private meterBody = (m: Partial<MeterConfig>): Record<string, unknown> => {
    const body: Record<string, unknown> = {};
    const keys: (keyof MeterConfig)[] = [
      'name',
      'type',
      'unit',
      'icon',
      'color',
      'active',
      'linkedWaterMeterId',
      'calorificValue',
      'zNumber',
      'connectedLoadKw',
      'meterNumber',
      'provider',
      'notes',
      'tariffHistory',
      'budget',
    ];
    for (const key of keys) {
      if (m[key] !== undefined) body[key] = m[key];
    }
    return body;
  };
}
