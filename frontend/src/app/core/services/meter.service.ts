import { Injectable, signal, computed, inject } from '@angular/core';
import { MeterConfig, TariffPeriod } from '../models/energy.models';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class MeterService {
  private readonly supabase = inject(SupabaseService);

  readonly meters = signal<MeterConfig[]>([]);
  readonly loading = signal(true);

  readonly activeMeters = computed(() => this.meters().filter((m) => m.active));

  constructor() {
    this.loadMeters();
  }

  async loadMeters(): Promise<void> {
    this.loading.set(true);
    const meters = await this.supabase.getMeters();
    this.meters.set(meters);
    this.loading.set(false);
  }

  getMeter(id: string): MeterConfig | undefined {
    return this.meters().find((m) => m.id === id);
  }

  async addMeter(meter: Omit<MeterConfig, 'id' | 'createdAt'>): Promise<MeterConfig> {
    const saved = await this.supabase.addMeter(meter);
    this.meters.update((list) => [...list, saved]);
    return saved;
  }

  async updateMeter(id: string, changes: Partial<MeterConfig>): Promise<void> {
    await this.supabase.updateMeter(id, changes);
    this.meters.update((list) => list.map((m) => (m.id === id ? { ...m, ...changes } : m)));
  }

  async deleteMeter(id: string): Promise<void> {
    await this.supabase.deleteMeter(id);
    this.meters.update((list) => list.filter((m) => m.id !== id));
  }
}
