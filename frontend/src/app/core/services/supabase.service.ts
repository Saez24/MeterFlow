import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { MeterConfig, MeterReading } from '../models/energy.models';


@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseKey
  );
  readonly connectionStatus = signal<'checking' | 'connected' | 'error'>('checking');

  readonly currentUser = signal<User | null>(null);

  constructor() {
    // Session beim Start laden
    this.client.auth.getSession().then(({ data }) => {
      this.currentUser.set(data.session?.user ?? null);
      this.checkConnection();
    });

    // Auth Änderungen beobachten
    this.client.auth.onAuthStateChange((_, session) => {
      this.currentUser.set(session?.user ?? null);
    });
  }

  // ── Auth ──────────────────────────────────────────
  async signUp(email: string, password: string) {
    return this.client.auth.signUp({ email, password });
  }

  async signIn(email: string, password: string) {
    return this.client.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    return this.client.auth.signOut();
  }

  async getSession() {
    const { data } = await this.client.auth.getSession();
    return data.session?.user ?? null;
  }

  // ── Zähler ────────────────────────────────────────
  async getMeters(): Promise<MeterConfig[]> {
    const { data, error } = await this.client
      .from('meters')
      .select('*')
      .order('created_at');
    if (error) throw error;
    return (data ?? []).map(this.mapMeter);
  }

  async addMeter(meter: Omit<MeterConfig, 'id' | 'createdAt'>): Promise<MeterConfig> {
    const { data, error } = await this.client
      .from('meters')
      .insert(this.toDbMeter(meter))
      .select()
      .single();
    if (error) throw error;
    return this.mapMeter(data);
  }

  async updateMeter(id: string, changes: Partial<MeterConfig>): Promise<void> {
    const { error } = await this.client
      .from('meters')
      .update(this.toDbMeter(changes))
      .eq('id', id);
    if (error) throw error;
  }

  async deleteMeter(id: string): Promise<void> {
    const { error } = await this.client.from('meters').delete().eq('id', id);
    if (error) throw error;
  }

  // ── Ablesungen ────────────────────────────────────
  async getReadings(): Promise<MeterReading[]> {
    const { data, error } = await this.client
      .from('readings')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(this.mapReading);
  }

  async addReading(reading: Omit<MeterReading, 'id'>): Promise<MeterReading> {
    const { data, error } = await this.client
      .from('readings')
      .insert(this.toDbReading(reading))
      .select()
      .single();
    if (error) throw error;
    return this.mapReading(data);
  }

  async updateReading(id: string, changes: Partial<MeterReading>): Promise<void> {
    const { error } = await this.client
      .from('readings')
      .update(this.toDbReading(changes))
      .eq('id', id);
    if (error) throw error;
  }

  async deleteReading(id: string): Promise<void> {
    const { error } = await this.client.from('readings').delete().eq('id', id);
    if (error) throw error;
  }

  // ── Mapper: DB → App ──────────────────────────────
  private mapMeter = (d: any): MeterConfig => ({
    id: d.id,
    name: d.name,
    type: d.type,
    unit: d.unit,
    icon: d.icon,
    color: d.color,
    active: d.active,
    createdAt: new Date(d.created_at),
    linkedWaterMeterId: d.linked_water_meter_id,
    calorificValue: d.calorific_value,
    zNumber: d.z_number,
    meterNumber: d.meter_number,
    provider: d.provider,
    notes: d.notes,
    tariffHistory: d.tariff_history ?? [],
    budget: d.budget,
  });

  private mapReading = (d: any): MeterReading => ({
    id: d.id,
    meterId: d.meter_id,
    value: d.value,
    date: new Date(d.date),
    consumption: d.consumption,
    kwh: d.kwh,
    cost: d.cost,
    wastewaterCost: d.wastewater_cost,
    totalCost: d.total_cost,
    note: d.note,
    photo: d.photo,
  });

  // ── Mapper: App → DB ──────────────────────────────
  private toDbMeter = (m: Partial<MeterConfig>) => ({
    user_id: this.currentUser()?.id,
    ...(m.name !== undefined && { name: m.name }),
    ...(m.type !== undefined && { type: m.type }),
    ...(m.unit !== undefined && { unit: m.unit }),
    ...(m.icon !== undefined && { icon: m.icon }),
    ...(m.color !== undefined && { color: m.color }),
    ...(m.active !== undefined && { active: m.active }),
    ...(m.linkedWaterMeterId !== undefined && { linked_water_meter_id: m.linkedWaterMeterId }),
    ...(m.calorificValue !== undefined && { calorific_value: m.calorificValue }),
    ...(m.zNumber !== undefined && { z_number: m.zNumber }),
    ...(m.meterNumber !== undefined && { meter_number: m.meterNumber }),
    ...(m.provider !== undefined && { provider: m.provider }),
    ...(m.notes !== undefined && { notes: m.notes }),
    ...(m.tariffHistory !== undefined && { tariff_history: m.tariffHistory }),
    ...(m.budget !== undefined && { budget: m.budget }),
  });

  private toDbReading = (r: Partial<MeterReading>) => ({
    user_id: this.currentUser()?.id,
    ...(r.meterId !== undefined && { meter_id: r.meterId }),
    ...(r.value !== undefined && { value: r.value }),
    ...(r.date !== undefined && { date: r.date }),
    ...(r.consumption !== undefined && { consumption: r.consumption }),
    ...(r.kwh !== undefined && { kwh: r.kwh }),
    ...(r.cost !== undefined && { cost: r.cost }),
    ...(r.wastewaterCost !== undefined && { wastewater_cost: r.wastewaterCost }),
    ...(r.totalCost !== undefined && { total_cost: r.totalCost }),
    ...(r.note !== undefined && { note: r.note }),
    ...(r.photo !== undefined && { photo: r.photo }),
  });

  // ── Fotos (Storage) ───────────────────────────────
  async uploadPhoto(file: File): Promise<string> {
    const user = this.currentUser();
    if (!user) throw new Error('Not authenticated');
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await this.client.storage
      .from('meter-photos')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  }

  async getSignedPhotoUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.client.storage
      .from('meter-photos')
      .createSignedUrl(path, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
  }

  async deletePhoto(path: string): Promise<void> {
    const { error } = await this.client.storage
      .from('meter-photos')
      .remove([path]);
    if (error) throw error;
  }

  // ── CO₂-Faktoren ──────────────────────────────────
  async getCo2Factors() {
    return this.client
      .from('co2_factors')
      .select('*')
      .order('energy_type');
  }

  async upsertCo2Factor(row: {
    energy_type: string;
    factor_kg_per_unit: number;
    unit: string;
    source: string;
    source_url: string | null;
    valid_from: string;
  }) {
    const userId = this.currentUser()?.id;
    if (!userId) throw new Error('Not authenticated');
    const { error } = await this.client
      .from('co2_factors')
      .upsert({ ...row, user_id: userId }, { onConflict: 'user_id,energy_type,valid_from' });
    if (error) throw error;
  }

  async deleteCo2Factor(id: string) {
    const { error } = await this.client.from('co2_factors').delete().eq('id', id);
    if (error) throw error;
  }

  // ── Alle Nutzdaten löschen (Account bleibt bestehen) ──
  async clearAllUserData(): Promise<void> {
    const userId = this.currentUser()?.id;
    if (!userId) throw new Error('Not authenticated');

    // 1) Foto-Dateien im Storage-Ordner {userId}/ entfernen
    const { data: files, error: listErr } = await this.client.storage
      .from('meter-photos')
      .list(userId);
    if (listErr) throw listErr;
    if (files && files.length > 0) {
      const paths = files.map((f) => `${userId}/${f.name}`);
      const { error: storageErr } = await this.client.storage
        .from('meter-photos')
        .remove(paths);
      if (storageErr) throw storageErr;
    }

    // 2) DB-Zeilen löschen (readings zuerst explizit, dann meters + co2_factors)
    const { error: readingsErr } = await this.client
      .from('readings')
      .delete()
      .eq('user_id', userId);
    if (readingsErr) throw readingsErr;

    const { error: metersErr } = await this.client
      .from('meters')
      .delete()
      .eq('user_id', userId);
    if (metersErr) throw metersErr;

    const { error: co2Err } = await this.client
      .from('co2_factors')
      .delete()
      .eq('user_id', userId);
    if (co2Err) throw co2Err;
  }

  async checkConnection(): Promise<void> {
    this.connectionStatus.set('checking');
    try {
      const { error } = await this.client.from('meters').select('id').limit(1);
      this.connectionStatus.set(error ? 'error' : 'connected');
    } catch {
      this.connectionStatus.set('error');
    }
  }
}