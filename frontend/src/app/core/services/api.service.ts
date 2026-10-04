import { Injectable, computed, inject, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { AdvancePaymentYear, EnergyType, MeterConfig, MeterReading } from '../models/energy.models';
import { buildDemoData } from './demo-data';
import { SUPABASE_CLIENT } from './supabase.client';

export interface AppUser {
  id: string;
  email: string;
  /** Guest account (Supabase anonymous sign-in), deleted after 24 h. */
  isAnonymous?: boolean;
}

interface AuthResult {
  error: { message: string } | null;
}

export interface ImportResult {
  metersAdded: number;
  metersSkipped: number;
  readingsAdded: number;
  readingsSkipped: number;
}

type Row = Record<string, unknown>;

const num = (v: unknown): number | undefined =>
  v !== null && v !== undefined ? Number(v) : undefined;

const isoDate = (d: Date | string): string =>
  d instanceof Date ? d.toISOString().split('T')[0] : String(d);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Explicit column lists (no `select('*')`).
const METER_COLUMNS: string =
  'id, name, type, unit, icon, color, active, created_at, linked_water_meter_id, ' +
  'calorific_value, z_number, connected_load_kw, meter_number, provider, notes, ' +
  'tariff_history, budget, advance_payments';
const READING_COLUMNS: string =
  'id, meter_id, date, value, consumption, kwh, cost, wastewater_cost, total_cost, note, photo';
const CO2_COLUMNS: string =
  'id, energy_type, factor_kg_per_unit, unit, source, source_url, valid_from';

const PHOTO_BUCKET = 'meter-photos';
const PHOTO_URL_TTL_SECONDS = 3600;
// Same limits as the Django photo endpoint; the bucket enforces them as well.
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const ALLOWED_PHOTO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic']);

const MAX_IMPORT_METERS = 10_000;
const MAX_IMPORT_READINGS = 50_000;
const INSERT_CHUNK_SIZE = 500;
const MAX_ADVANCE_PAYMENT_YEARS = 50;

/** Reading fields the client computes; `undefined` in an update clears them. */
const COMPUTED_READING_FIELDS = {
  consumption: 'consumption',
  kwh: 'kwh',
  cost: 'cost',
  wastewaterCost: 'wastewater_cost',
  totalCost: 'total_cost',
} as const satisfies Partial<Record<keyof MeterReading, string>>;

const METER_COLUMN_BY_FIELD = {
  name: 'name',
  type: 'type',
  unit: 'unit',
  icon: 'icon',
  color: 'color',
  active: 'active',
  linkedWaterMeterId: 'linked_water_meter_id',
  calorificValue: 'calorific_value',
  zNumber: 'z_number',
  connectedLoadKw: 'connected_load_kw',
  meterNumber: 'meter_number',
  provider: 'provider',
  notes: 'notes',
  tariffHistory: 'tariff_history',
  budget: 'budget',
  advancePayments: 'advance_payments',
} as const satisfies Partial<Record<keyof MeterConfig, string>>;

/**
 * Supabase data layer (branch `supabase`). Same public surface as the REST
 * ApiService on `main`, so components and feature services stay identical and
 * `git merge main` only touches this file. Auth, RLS and Storage are handled
 * by Supabase; derived reading values (consumption, cost, …) are computed by
 * ReadingService on the client and persisted as given.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly client = inject(SUPABASE_CLIENT);

  readonly connectionStatus = signal<'checking' | 'connected' | 'error'>('checking');
  readonly currentUser = signal<AppUser | null>(null);
  readonly isGuest = computed(() => this.currentUser()?.isAnonymous === true);

  /** Resolves once the initial session probe has finished (used by guards). */
  readonly sessionReady: Promise<void>;
  private resolveReady!: () => void;

  constructor() {
    this.sessionReady = new Promise((resolve) => (this.resolveReady = resolve));
    this.client.auth.onAuthStateChange((_event, session) => {
      this.currentUser.set(this.toAppUser(session?.user ?? null));
    });
    void this.initSession();
  }

  private async initSession(): Promise<void> {
    try {
      const { data } = await this.client.auth.getSession();
      this.currentUser.set(this.toAppUser(data.session?.user ?? null));
      await this.checkConnection();
    } catch {
      this.currentUser.set(null);
      this.connectionStatus.set('error');
    } finally {
      this.resolveReady();
    }
  }

  private toAppUser(user: User | null): AppUser | null {
    return user
      ? { id: user.id, email: user.email ?? '', isAnonymous: user.is_anonymous === true }
      : null;
  }

  private requireUserId(): string {
    const id = this.currentUser()?.id;
    if (!id) throw new Error('Not authenticated');
    return id;
  }

  // ── Auth ────────────────────────────────────────────────────────────────
  async signUp(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) return { error: { message: error.message } };
    // With e-mail confirmation enabled Supabase returns no session yet; the
    // auth page maps this message to "Bitte bestätige zuerst deine E-Mail".
    if (!data.session) return { error: { message: 'Email not confirmed' } };
    this.currentUser.set(this.toAppUser(data.session.user));
    this.connectionStatus.set('connected');
    return { error: null };
  }

  /**
   * Demo guest: anonymous Supabase account seeded with demo data. The account
   * and its rows are deleted 24 h after sign-up by a pg_cron job (migration
   * 20261005000000_guest_access). Callers reload meters/readings afterwards.
   */
  async signInAsGuest(): Promise<AuthResult> {
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error) return { error: { message: error.message } };
    this.currentUser.set(this.toAppUser(data.user));
    try {
      await this.importData(buildDemoData(new Date()));
    } catch (err) {
      await this.signOut();
      return {
        error: { message: err instanceof Error ? err.message : 'Demo-Daten fehlgeschlagen' },
      };
    }
    this.connectionStatus.set('connected');
    return { error: null };
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) return { error: { message: error.message } };
    this.currentUser.set(this.toAppUser(data.user));
    this.connectionStatus.set('connected');
    return { error: null };
  }

  async signOut(): Promise<void> {
    try {
      await this.client.auth.signOut();
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
    const { data, error } = await this.client
      .from('meters')
      .select<string, Row>(METER_COLUMNS)
      .order('created_at');
    if (error) throw error;
    return ((data ?? []) as Row[]).map(this.mapMeter);
  }

  async addMeter(meter: Omit<MeterConfig, 'id' | 'createdAt'>): Promise<MeterConfig> {
    const row = this.meterRow(meter);
    if (meter.advancePayments !== undefined) {
      row['advance_payments'] = validateAdvancePayments(
        meter.advancePayments,
        meter.type,
        meter.linkedWaterMeterId ?? null,
      );
    }
    const { data, error } = await this.client
      .from('meters')
      .insert({ ...row, user_id: this.requireUserId() })
      .select<string, Row>(METER_COLUMNS)
      .single();
    if (error) throw error;
    return this.mapMeter(data as Row);
  }

  async updateMeter(id: string, changes: Partial<MeterConfig>): Promise<void> {
    const row = this.meterRow(changes);
    if (changes.advancePayments !== undefined) {
      const current = await this.getMeterTypeAndLink(id);
      row['advance_payments'] = validateAdvancePayments(
        changes.advancePayments,
        changes.type ?? current.type,
        changes.linkedWaterMeterId !== undefined
          ? changes.linkedWaterMeterId
          : current.linkedWaterMeterId,
      );
    }
    const { error } = await this.client.from('meters').update(row).eq('id', id);
    if (error) throw error;
  }

  async deleteMeter(id: string): Promise<void> {
    // Readings cascade in the DB; their photos live in Storage and are removed here.
    const { data } = await this.client
      .from('readings')
      .select('photo')
      .eq('meter_id', id)
      .not('photo', 'is', null);
    const { error } = await this.client.from('meters').delete().eq('id', id);
    if (error) throw error;
    await this.removeStorageObjects(((data ?? []) as Row[]).map((r) => r['photo'] as string));
  }

  private async getMeterTypeAndLink(
    id: string,
  ): Promise<{ type: EnergyType; linkedWaterMeterId: string | null }> {
    const { data, error } = await this.client
      .from('meters')
      .select('type, linked_water_meter_id')
      .eq('id', id)
      .single();
    if (error) throw error;
    const row = data as Row;
    return {
      type: row['type'] as EnergyType,
      linkedWaterMeterId: (row['linked_water_meter_id'] as string | null) ?? null,
    };
  }

  // ── Readings ────────────────────────────────────────────────────────────
  async getReadings(): Promise<MeterReading[]> {
    const { data, error } = await this.client
      .from('readings')
      .select<string, Row>(READING_COLUMNS)
      .order('date', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as Row[]).map(this.mapReading);
  }

  async addReading(reading: Omit<MeterReading, 'id'>): Promise<MeterReading> {
    const row: Row = {
      user_id: this.requireUserId(),
      meter_id: reading.meterId,
      date: isoDate(reading.date),
      value: reading.value,
      note: reading.note ?? null,
      consumption: reading.consumption ?? null,
      kwh: reading.kwh ?? null,
      cost: reading.cost ?? null,
      wastewater_cost: reading.wastewaterCost ?? null,
      total_cost: reading.totalCost ?? null,
    };
    const { data, error } = await this.client
      .from('readings')
      .insert(row)
      .select<string, Row>(READING_COLUMNS)
      .single();
    if (error) throw error;
    return this.mapReading(data as Row);
  }

  async updateReading(id: string, changes: Partial<MeterReading>): Promise<void> {
    const row: Row = {};
    if (changes.date !== undefined) row['date'] = isoDate(changes.date);
    if (changes.value !== undefined) row['value'] = changes.value;
    if (changes.note !== undefined) row['note'] = changes.note;
    // ReadingService passes computed fields explicitly (undefined = no value).
    for (const [field, column] of Object.entries(COMPUTED_READING_FIELDS)) {
      if (field in changes) row[column] = changes[field as keyof MeterReading] ?? null;
    }
    if (Object.keys(row).length === 0) return;
    const { error } = await this.client.from('readings').update(row).eq('id', id);
    if (error) throw error;
  }

  async deleteReading(id: string): Promise<void> {
    const photo = await this.getReadingPhoto(id);
    const { error } = await this.client.from('readings').delete().eq('id', id);
    if (error) throw error;
    if (photo) await this.removeStorageObjects([photo]);
  }

  /**
   * On `main` the backend recomputes derived values. Here ReadingService
   * already computes and persists them, so this just returns the meter's
   * readings in their stored state.
   */
  async recalculateReadings(meterId: string): Promise<MeterReading[]> {
    const { data, error } = await this.client
      .from('readings')
      .select<string, Row>(READING_COLUMNS)
      .eq('meter_id', meterId)
      .order('date');
    if (error) throw error;
    return ((data ?? []) as Row[]).map(this.mapReading);
  }

  // ── Bulk import ─────────────────────────────────────────────────────────
  /**
   * Bulk-import meters + readings. Preserves ids and resolves linked-meter /
   * reading references (like the Django import endpoint). Do NOT loop over
   * addMeter/addReading for imports — that reassigns ids and breaks links.
   * Rows whose id already exists for this user are skipped, so a failed
   * import can simply be repeated (it is not one transaction).
   */
  async importData(payload: { meters: unknown[]; readings: unknown[] }): Promise<ImportResult> {
    const userId = this.requireUserId();
    if (payload.meters.length > MAX_IMPORT_METERS) {
      throw new Error(`Too many meters (max ${MAX_IMPORT_METERS}).`);
    }
    if (payload.readings.length > MAX_IMPORT_READINGS) {
      throw new Error(`Too many readings (max ${MAX_IMPORT_READINGS}).`);
    }

    const [ownMeterIds, ownReadingIds] = await Promise.all([
      this.selectOwnIds('meters'),
      this.selectOwnIds('readings'),
    ]);

    // ── Meters (links in a second pass, so order in the file does not matter)
    const idMap = new Map<string, string>();
    const newMeters: Row[] = [];
    const pendingLinks: { id: string; linked: string }[] = [];
    let metersSkipped = 0;

    for (const raw of payload.meters) {
      const m = parseImportMeter(raw);
      const id = m.id && UUID_RE.test(m.id) ? m.id : crypto.randomUUID();
      if (m.id) idMap.set(m.id, id);
      if (ownMeterIds.has(id)) {
        metersSkipped++;
        continue;
      }
      newMeters.push({ ...m.row, id, user_id: userId, linked_water_meter_id: null });
      if (m.linkedWaterMeterId) pendingLinks.push({ id, linked: m.linkedWaterMeterId });
    }
    await this.insertChunked('meters', newMeters);
    const knownMeterIds = new Set([...ownMeterIds, ...newMeters.map((m) => m['id'] as string)]);

    for (const { id, linked } of pendingLinks) {
      const target = idMap.get(linked) ?? linked;
      if (!knownMeterIds.has(target)) {
        throw new Error('Verlinkter Wasserzähler nicht gefunden oder kein Zugriff');
      }
      const { error } = await this.client
        .from('meters')
        .update({ linked_water_meter_id: target })
        .eq('id', id);
      if (error) throw error;
    }

    // ── Readings
    const newReadings: Row[] = [];
    let readingsSkipped = 0;
    for (const raw of payload.readings) {
      const r = parseImportReading(raw);
      const id = r.id && UUID_RE.test(r.id) ? r.id : crypto.randomUUID();
      if (ownReadingIds.has(id)) {
        readingsSkipped++;
        continue;
      }
      const meterId = idMap.get(r.meterId) ?? r.meterId;
      if (!knownMeterIds.has(meterId)) {
        throw new Error('Meter nicht gefunden oder kein Zugriff');
      }
      // `photo` is never imported: a storage path from a file must not be trusted.
      newReadings.push({ ...r.row, id, user_id: userId, meter_id: meterId });
    }
    await this.insertChunked('readings', newReadings);

    return {
      metersAdded: newMeters.length,
      metersSkipped,
      readingsAdded: newReadings.length,
      readingsSkipped,
    };
  }

  private async selectOwnIds(table: 'meters' | 'readings'): Promise<Set<string>> {
    const { data, error } = await this.client.from(table).select('id');
    if (error) throw error;
    return new Set(((data ?? []) as Row[]).map((r) => r['id'] as string));
  }

  private async insertChunked(table: 'meters' | 'readings', rows: Row[]): Promise<void> {
    for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
      const { error } = await this.client.from(table).insert(rows.slice(i, i + INSERT_CHUNK_SIZE));
      if (error) throw error;
    }
  }

  // ── Photos (Supabase Storage, private bucket, path `<userId>/<uuid>.<ext>`) ──
  async uploadPhoto(file: File, readingId?: string): Promise<string> {
    const userId = this.requireUserId();
    // Also enforced by a restrictive storage policy.
    if (this.isGuest()) throw new Error('Fotos sind im Gastmodus deaktiviert');
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_PHOTO_TYPES.has(file.type) || !ALLOWED_PHOTO_EXTENSIONS.has(ext)) {
      throw new Error('Unsupported image type');
    }
    if (file.size > MAX_PHOTO_BYTES) throw new Error('Image too large');

    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await this.client.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;

    if (readingId) {
      const previous = await this.getReadingPhoto(readingId);
      const { error: updateError } = await this.client
        .from('readings')
        .update({ photo: path })
        .eq('id', readingId);
      if (updateError) {
        await this.removeStorageObjects([path]);
        throw updateError;
      }
      if (previous) await this.removeStorageObjects([previous]);
    }
    return path;
  }

  async getSignedPhotoUrl(path: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, PHOTO_URL_TTL_SECONDS);
    if (error) throw error;
    return data.signedUrl;
  }

  async deletePhoto(path: string): Promise<void> {
    const { error } = await this.client.storage.from(PHOTO_BUCKET).remove([path]);
    if (error) throw error;
  }

  /** Explicitly remove a reading's photo (RLS limits this to own readings). */
  async removePhoto(readingId: string): Promise<void> {
    const photo = await this.getReadingPhoto(readingId);
    if (!photo) return;
    const { error } = await this.client
      .from('readings')
      .update({ photo: null })
      .eq('id', readingId);
    if (error) throw error;
    await this.removeStorageObjects([photo]);
  }

  private async getReadingPhoto(readingId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from('readings')
      .select('photo')
      .eq('id', readingId)
      .maybeSingle();
    if (error) throw error;
    return ((data as Row | null)?.['photo'] as string | null) ?? null;
  }

  /** Best effort: a leftover file must not fail the data operation. */
  private async removeStorageObjects(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await this.client.storage.from(PHOTO_BUCKET).remove(paths);
    if (error) console.warn('Photo cleanup failed:', error.message);
  }

  // ── CO₂ factors ─────────────────────────────────────────────────────────
  /** Returns camelCase rows, matching the REST API that Co2FactorService maps. */
  async getCo2Factors(): Promise<{ data: unknown[] | null; error: unknown }> {
    const { data, error } = await this.client
      .from('co2_factors')
      .select<string, Row>(CO2_COLUMNS)
      .order('energy_type')
      .order('valid_from', { ascending: false });
    if (error) return { data: null, error };
    const rows = ((data ?? []) as Row[]).map((r) => ({
      id: r['id'],
      energyType: r['energy_type'],
      factorKgPerUnit: r['factor_kg_per_unit'],
      unit: r['unit'],
      source: r['source'],
      sourceUrl: r['source_url'],
      validFrom: r['valid_from'],
    }));
    return { data: rows, error: null };
  }

  async upsertCo2Factor(row: {
    energy_type: string;
    factor_kg_per_unit: number;
    unit: string;
    source: string;
    source_url: string | null;
    valid_from: string;
  }): Promise<void> {
    const { error } = await this.client.from('co2_factors').upsert(
      { ...row, user_id: this.requireUserId() },
      {
        onConflict: 'user_id,energy_type,valid_from',
      },
    );
    if (error) throw error;
  }

  async deleteCo2Factor(id: string): Promise<void> {
    const { error } = await this.client.from('co2_factors').delete().eq('id', id);
    if (error) throw error;
  }

  // ── Account: wipe all user data (account stays) ─────────────────────────
  async clearAllUserData(): Promise<void> {
    const userId = this.requireUserId();

    // Photos first: list the user's folder page by page and remove the files.
    const pageSize = 1000;
    for (;;) {
      const { data: files, error } = await this.client.storage
        .from(PHOTO_BUCKET)
        .list(userId, { limit: pageSize });
      if (error) throw error;
      if (!files || files.length === 0) break;
      const { error: removeError } = await this.client.storage
        .from(PHOTO_BUCKET)
        .remove(files.map((f) => `${userId}/${f.name}`));
      if (removeError) throw removeError;
      if (files.length < pageSize) break;
    }

    for (const table of ['readings', 'meters', 'co2_factors'] as const) {
      const { error } = await this.client.from(table).delete().eq('user_id', userId);
      if (error) throw error;
    }
  }

  async checkConnection(): Promise<void> {
    this.connectionStatus.set('checking');
    try {
      const { error } = await this.client
        .from('meters')
        .select('id', { head: true, count: 'exact' })
        .limit(1);
      this.connectionStatus.set(error ? 'error' : 'connected');
    } catch {
      this.connectionStatus.set('error');
    }
  }

  // ── Mappers (DB snake_case → app models) ────────────────────────────────
  private mapMeter = (m: Row): MeterConfig => ({
    id: m['id'] as string,
    name: m['name'] as string,
    type: m['type'] as MeterConfig['type'],
    unit: m['unit'] as MeterConfig['unit'],
    icon: m['icon'] as MeterConfig['icon'],
    color: m['color'] as string,
    active: m['active'] as boolean,
    createdAt: new Date(m['created_at'] as string),
    linkedWaterMeterId: (m['linked_water_meter_id'] as string) ?? undefined,
    calorificValue: num(m['calorific_value']),
    zNumber: num(m['z_number']),
    connectedLoadKw: num(m['connected_load_kw']),
    meterNumber: (m['meter_number'] as string) ?? undefined,
    provider: (m['provider'] as string) ?? undefined,
    notes: (m['notes'] as string) ?? undefined,
    tariffHistory: (m['tariff_history'] as MeterConfig['tariffHistory']) ?? [],
    budget: (m['budget'] as MeterConfig['budget']) ?? undefined,
    advancePayments: (m['advance_payments'] as MeterConfig['advancePayments']) ?? [],
  });

  private mapReading = (r: Row): MeterReading => ({
    id: r['id'] as string,
    meterId: r['meter_id'] as string,
    value: Number(r['value']),
    date: new Date(r['date'] as string),
    consumption: num(r['consumption']),
    kwh: num(r['kwh']),
    cost: num(r['cost']),
    wastewaterCost: num(r['wastewater_cost']),
    totalCost: num(r['total_cost']),
    note: (r['note'] as string) ?? undefined,
    photo: (r['photo'] as string) ?? undefined,
  });

  /** App model → DB columns, only fields that are defined. */
  private meterRow(m: Partial<MeterConfig>): Row {
    const row: Row = {};
    for (const [field, column] of Object.entries(METER_COLUMN_BY_FIELD)) {
      const value = m[field as keyof MeterConfig];
      if (value !== undefined) row[column] = value;
    }
    return row;
  }
}

// ── Validation (port of the Django serializers on `main`) ─────────────────

/**
 * Validates and normalises advance payments like `AdvancePaymentsField` in
 * backend/apps/meters/serializers.py: unique years sorted, payments sorted by
 * month, amounts rounded to cents, months matching the payment rhythm.
 */
export function validateAdvancePayments(
  entries: AdvancePaymentYear[],
  meterType: EnergyType,
  linkedWaterMeterId: string | null,
): AdvancePaymentYear[] {
  const fail = (message: string): never => {
    throw new Error(message);
  };
  if (!Array.isArray(entries)) fail('Abschläge müssen eine Liste sein.');
  if (entries.length > MAX_ADVANCE_PAYMENT_YEARS) {
    fail(`Höchstens ${MAX_ADVANCE_PAYMENT_YEARS} Jahre erlaubt.`);
  }
  if (entries.length > 0 && meterType === EnergyType.GardenWater && linkedWaterMeterId) {
    fail('Ein verknüpfter Gartenwasserzähler hat keine eigenen Abschläge.');
  }

  const isNumberIn = (v: unknown, min: number, max: number): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

  const normalised = entries.map((entry) => {
    if (!Number.isInteger(entry.year) || !isNumberIn(entry.year, 2000, 2100)) {
      fail('Ungültiges Jahr.');
    }
    if (!isNumberIn(entry.estimatedConsumption, 0, 1e9) || entry.estimatedConsumption <= 0) {
      fail('Der geschätzte Jahresverbrauch muss größer als 0 sein.');
    }
    const garden = entry.estimatedGardenConsumption ?? null;
    if (garden !== null) {
      if (!isNumberIn(garden, 0, 1e9)) fail('Ungültiger Gartenwasserverbrauch.');
      if (garden > entry.estimatedConsumption) {
        fail('Der Gartenwasserverbrauch darf nicht größer als der Jahresverbrauch sein.');
      }
    }
    const interval = entry.interval ?? 1;
    if (interval !== 1 && interval !== 3) fail('Ungültiger Zahlungsrhythmus.');

    const payments = entry.payments ?? [];
    if (payments.length < 1 || payments.length > 12) fail('1 bis 12 Abschläge pro Jahr.');
    const sorted = payments
      .map((p) => {
        if (!Number.isInteger(p.month) || !isNumberIn(p.month, 1, 12)) fail('Ungültiger Monat.');
        const amount = p.amount ?? null;
        if (amount !== null && !isNumberIn(amount, 0, 1_000_000)) fail('Ungültiger Betrag.');
        return { month: p.month, amount: amount === null ? null : Math.round(amount * 100) / 100 };
      })
      .sort((a, b) => a.month - b.month);
    const months = sorted.map((p) => p.month);
    if (new Set(months).size !== months.length) fail('Jeder Monat darf nur einmal vorkommen.');
    if (months.some((m, i) => i > 0 && m - months[i - 1] !== interval)) {
      fail('Die Monate passen nicht zum Zahlungsrhythmus.');
    }
    return { ...entry, estimatedGardenConsumption: garden, interval, payments: sorted };
  });

  const years = normalised.map((e) => e.year);
  if (new Set(years).size !== years.length) fail('Jedes Jahr darf nur einmal vorkommen.');
  return normalised.sort((a, b) => a.year - b.year);
}

/** Reads a camelCase key and falls back to snake_case (older exports). */
function pick(obj: Row, camel: string, snake: string): unknown {
  return obj[camel] !== undefined ? obj[camel] : obj[snake];
}

const optNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error('Ungültige Zahl im Import');
  return n;
};

const optString = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : String(v);

const requireString = (v: unknown, field: string): string => {
  if (typeof v !== 'string' || v === '') throw new Error(`Feld "${field}" fehlt im Import`);
  return v;
};

/** Repairs legacy latin-1/utf-8 mojibake in imported units (e.g. "mÂ³"). */
function fixEncoding(text: string): string {
  const codes = Array.from(text, (c) => c.charCodeAt(0));
  if (codes.some((c) => c > 0xff)) return text;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(codes));
  } catch {
    return text;
  }
}

function parseImportMeter(raw: unknown): {
  id: string | null;
  linkedWaterMeterId: string | null;
  row: Row;
} {
  if (!raw || typeof raw !== 'object') throw new Error('Ungültiger Zähler im Import');
  const m = raw as Row;
  const type = requireString(m['type'], 'type') as EnergyType;
  const linkedWaterMeterId = optString(pick(m, 'linkedWaterMeterId', 'linked_water_meter_id'));
  const tariffHistory = pick(m, 'tariffHistory', 'tariff_history') ?? [];
  if (!Array.isArray(tariffHistory)) throw new Error('Ungültige Tarifhistorie im Import');
  const budget = m['budget'] ?? null;
  if (budget !== null && (typeof budget !== 'object' || Array.isArray(budget))) {
    throw new Error('Ungültiges Budget im Import');
  }
  const advancePayments = validateAdvancePayments(
    (pick(m, 'advancePayments', 'advance_payments') ?? []) as AdvancePaymentYear[],
    type,
    linkedWaterMeterId,
  );
  return {
    id: optString(m['id']),
    linkedWaterMeterId,
    row: {
      name: requireString(m['name'], 'name'),
      type,
      unit: fixEncoding(requireString(m['unit'], 'unit')),
      icon: requireString(m['icon'], 'icon'),
      color: requireString(m['color'], 'color'),
      active: m['active'] === undefined ? true : Boolean(m['active']),
      meter_number: optString(pick(m, 'meterNumber', 'meter_number')),
      provider: optString(m['provider']),
      notes: optString(m['notes']),
      calorific_value: optNumber(pick(m, 'calorificValue', 'calorific_value')),
      z_number: optNumber(pick(m, 'zNumber', 'z_number')),
      connected_load_kw: optNumber(pick(m, 'connectedLoadKw', 'connected_load_kw')),
      tariff_history: tariffHistory,
      budget,
      advance_payments: advancePayments,
    },
  };
}

function parseImportReading(raw: unknown): { id: string | null; meterId: string; row: Row } {
  if (!raw || typeof raw !== 'object') throw new Error('Ungültige Ablesung im Import');
  const r = raw as Row;
  const value = optNumber(r['value']);
  if (value === null) throw new Error('Feld "value" fehlt im Import');
  const date = new Date(requireString(String(r['date'] ?? ''), 'date'));
  if (Number.isNaN(date.getTime())) throw new Error('Ungültiges Datumsformat im Import');
  return {
    id: optString(r['id']),
    meterId: requireString(pick(r, 'meterId', 'meter_id'), 'meterId'),
    row: {
      date: isoDate(date),
      value,
      consumption: optNumber(r['consumption']),
      kwh: optNumber(r['kwh']),
      cost: optNumber(r['cost']),
      wastewater_cost: optNumber(pick(r, 'wastewaterCost', 'wastewater_cost')),
      total_cost: optNumber(pick(r, 'totalCost', 'total_cost')),
      note: optString(r['note']),
    },
  };
}
