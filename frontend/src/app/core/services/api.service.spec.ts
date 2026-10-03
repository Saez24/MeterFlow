import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdvancePaymentYear, EnergyType } from '../models/energy.models';
import { ApiService, validateAdvancePayments } from './api.service';
import { SUPABASE_CLIENT } from './supabase.client';

interface Call {
  table: string;
  method: string;
  args: unknown[];
}

type Result = { data: unknown; error: unknown };

/**
 * Minimal chainable fake of the supabase-js query builder. Every call is
 * recorded; awaiting a query resolves to the next queued result for its table
 * (default: empty list, no error).
 */
class FakeSupabase {
  readonly calls: Call[] = [];
  private readonly results = new Map<string, Result[]>();
  readonly storageCalls: { method: string; args: unknown[] }[] = [];

  readonly auth = {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(async () => ({ error: null })),
  };

  readonly storage = {
    from: () => {
      const record =
        (method: string, result: Result) =>
        async (...args: unknown[]) => {
          this.storageCalls.push({ method, args });
          return result;
        };
      return {
        upload: record('upload', { data: {}, error: null }),
        remove: record('remove', { data: [], error: null }),
        list: record('list', { data: [], error: null }),
        createSignedUrl: record('createSignedUrl', {
          data: { signedUrl: 'https://signed' },
          error: null,
        }),
      };
    },
  };

  queue(table: string, ...results: Result[]): void {
    this.results.set(table, [...(this.results.get(table) ?? []), ...results]);
  }

  from(table: string): unknown {
    const builder: Record<string, unknown> = {};
    const methods = [
      'select',
      'insert',
      'update',
      'upsert',
      'delete',
      'eq',
      'not',
      'order',
      'limit',
      'single',
      'maybeSingle',
    ];
    for (const method of methods) {
      builder[method] = (...args: unknown[]) => {
        this.calls.push({ table, method, args });
        return builder;
      };
    }
    builder['then'] = (resolve: (r: Result) => unknown) =>
      resolve(this.results.get(table)?.shift() ?? { data: [], error: null });
    return builder;
  }

  callsOf(table: string, method: string): unknown[][] {
    return this.calls.filter((c) => c.table === table && c.method === method).map((c) => c.args);
  }
}

describe('ApiService (Supabase)', () => {
  let api: ApiService;
  let fake: FakeSupabase;

  const signedIn = async () => {
    fake.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
      error: null,
    });
    await api.signIn('a@b.c', 'pw');
  };

  beforeEach(async () => {
    fake = new FakeSupabase();
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT, useValue: fake }, ApiService],
    });
    api = TestBed.inject(ApiService);
    await api.sessionReady;
  });

  it('signIn sets currentUser', async () => {
    await signedIn();
    expect(api.currentUser()).toEqual({ id: 'u1', email: 'a@b.c' });
  });

  it('signIn surfaces the Supabase error message', async () => {
    fake.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });
    const { error } = await api.signIn('a@b.c', 'wrong');
    expect(error?.message).toBe('Invalid login credentials');
    expect(api.currentUser()).toBeNull();
  });

  it('signUp without a session asks for e-mail confirmation', async () => {
    fake.auth.signUp.mockResolvedValue({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    });
    const { error } = await api.signUp('a@b.c', 'pw123456');
    expect(error?.message).toBe('Email not confirmed');
    expect(api.currentUser()).toBeNull();
  });

  it('getMeters maps snake_case rows to app models', async () => {
    fake.queue('meters', {
      data: [
        {
          id: 'm1',
          name: 'Fernwärme',
          type: 'fernwarme',
          unit: 'MWh',
          icon: 'local_fire_department',
          color: '#000',
          active: true,
          created_at: '2026-01-01T00:00:00Z',
          linked_water_meter_id: null,
          connected_load_kw: '12.5',
          tariff_history: [],
          budget: null,
          advance_payments: [{ year: 2026, estimatedConsumption: 10, payments: [] }],
        },
      ],
      error: null,
    });

    const [meter] = await api.getMeters();

    expect(meter.connectedLoadKw).toBe(12.5);
    expect(meter.createdAt).toBeInstanceOf(Date);
    expect(meter.linkedWaterMeterId).toBeUndefined();
    expect(meter.advancePayments?.[0].year).toBe(2026);
    expect(fake.callsOf('meters', 'select')[0][0]).not.toContain('*');
  });

  it('addReading persists the client-computed values with the user id', async () => {
    await signedIn();
    fake.queue('readings', {
      data: { id: 'r1', meter_id: 'm1', date: '2026-03-01', value: 120, cost: 4.2 },
      error: null,
    });

    const saved = await api.addReading({
      meterId: 'm1',
      date: new Date('2026-03-01T00:00:00Z'),
      value: 120,
      consumption: 20,
      cost: 4.2,
      totalCost: 4.2,
    });

    const [row] = fake.callsOf('readings', 'insert')[0] as [Record<string, unknown>];
    expect(row).toMatchObject({
      user_id: 'u1',
      meter_id: 'm1',
      date: '2026-03-01',
      consumption: 20,
      cost: 4.2,
      wastewater_cost: null,
    });
    expect(saved.cost).toBe(4.2);
  });

  it('updateReading clears computed fields passed as undefined and skips absent ones', async () => {
    await api.updateReading('r1', { cost: 3, wastewaterCost: undefined });

    const [row] = fake.callsOf('readings', 'update')[0] as [Record<string, unknown>];
    expect(row).toEqual({ cost: 3, wastewater_cost: null });
  });

  it('getCo2Factors returns camelCase rows', async () => {
    fake.queue('co2_factors', {
      data: [
        {
          id: 'c1',
          energy_type: 'electricity',
          factor_kg_per_unit: 0.4,
          unit: 'kWh',
          source: 'UBA',
          source_url: null,
          valid_from: '2026-01-01',
        },
      ],
      error: null,
    });

    const { data } = await api.getCo2Factors();

    expect(data?.[0]).toMatchObject({ energyType: 'electricity', factorKgPerUnit: 0.4 });
  });

  it('uploadPhoto rejects unsupported file types before uploading', async () => {
    await signedIn();
    const file = new File(['x'], 'evil.svg', { type: 'image/svg+xml' });

    await expect(api.uploadPhoto(file, 'r1')).rejects.toThrow('Unsupported image type');
    expect(fake.storageCalls).toHaveLength(0);
  });

  it('uploadPhoto stores the file under the user folder and links it to the reading', async () => {
    await signedIn();
    fake.queue('readings', { data: { photo: 'u1/old.jpg' }, error: null });
    const file = new File(['x'], 'meter.JPG', { type: 'image/jpeg' });

    const path = await api.uploadPhoto(file, 'r1');

    expect(path).toMatch(/^u1\/[0-9a-f-]{36}\.jpg$/);
    expect(fake.callsOf('readings', 'update')[0][0]).toEqual({ photo: path });
    expect(fake.storageCalls.at(-1)).toEqual({ method: 'remove', args: [['u1/old.jpg']] });
  });

  describe('importData', () => {
    const meterId = '11111111-1111-4111-8111-111111111111';
    const gardenId = '22222222-2222-4222-8222-222222222222';

    it('keeps ids, links meters in a second pass and never imports photos', async () => {
      await signedIn();
      fake.queue('meters', { data: [], error: null }); // own meter ids
      fake.queue('readings', { data: [], error: null }); // own reading ids

      const result = await api.importData({
        meters: [
          {
            id: gardenId,
            name: 'Garten',
            type: 'garden_water',
            unit: 'mÂ³',
            icon: 'yard',
            color: '#0a0',
            linkedWaterMeterId: meterId,
          },
          {
            id: meterId,
            name: 'Wasser',
            type: 'water',
            unit: 'm³',
            icon: 'water_drop',
            color: '#00f',
          },
        ],
        readings: [
          { meterId: gardenId, date: '2026-01-01T00:00:00.000Z', value: 5, photo: 'u2/x.jpg' },
        ],
      });

      expect(result).toEqual({
        metersAdded: 2,
        metersSkipped: 0,
        readingsAdded: 1,
        readingsSkipped: 0,
      });
      const [meters] = fake.callsOf('meters', 'insert')[0] as [Record<string, unknown>[]];
      expect(meters.map((m) => m['id'])).toEqual([gardenId, meterId]);
      // Only columns the app reads (see METER_COLUMNS) — live DBs may lack others.
      expect(meters[0]).not.toHaveProperty('archived');
      expect(meters[0]['linked_water_meter_id']).toBeNull();
      expect(meters[0]['unit']).toBe('m³');
      expect(fake.callsOf('meters', 'update')[0][0]).toEqual({ linked_water_meter_id: meterId });
      const [readings] = fake.callsOf('readings', 'insert')[0] as [Record<string, unknown>[]];
      expect(readings[0]).toMatchObject({ meter_id: gardenId, date: '2026-01-01', user_id: 'u1' });
      expect(readings[0]).not.toHaveProperty('photo');
    });

    it('skips rows that already exist for the user', async () => {
      await signedIn();
      fake.queue('meters', { data: [{ id: meterId }], error: null });
      fake.queue('readings', { data: [], error: null });

      const result = await api.importData({
        meters: [
          {
            id: meterId,
            name: 'Wasser',
            type: 'water',
            unit: 'm³',
            icon: 'water_drop',
            color: '#00f',
          },
        ],
        readings: [],
      });

      expect(result.metersSkipped).toBe(1);
      expect(fake.callsOf('meters', 'insert')).toHaveLength(0);
    });

    it('rejects readings for meters the user does not own', async () => {
      await signedIn();
      fake.queue('meters', { data: [], error: null });
      fake.queue('readings', { data: [], error: null });

      await expect(
        api.importData({ meters: [], readings: [{ meterId, date: '2026-01-01', value: 1 }] }),
      ).rejects.toThrow('Meter nicht gefunden oder kein Zugriff');
    });
  });
});

describe('validateAdvancePayments', () => {
  const entry = (overrides: Partial<AdvancePaymentYear> = {}): AdvancePaymentYear => ({
    year: 2026,
    estimatedConsumption: 1000,
    payments: [{ month: 1, amount: 10 }],
    ...overrides,
  });

  it('sorts years and payments and rounds amounts to cents', () => {
    const result = validateAdvancePayments(
      [
        entry({ year: 2027 }),
        entry({
          payments: [
            { month: 2, amount: 10.006 },
            { month: 1, amount: null },
          ],
        }),
      ],
      EnergyType.Electricity,
      null,
    );

    expect(result.map((e) => e.year)).toEqual([2026, 2027]);
    expect(result[0].payments).toEqual([
      { month: 1, amount: null },
      { month: 2, amount: 10.01 },
    ]);
  });

  it('rejects months that do not match the quarterly rhythm', () => {
    expect(() =>
      validateAdvancePayments(
        [
          entry({
            interval: 3,
            payments: [
              { month: 2, amount: 1 },
              { month: 4, amount: 1 },
            ],
          }),
        ],
        EnergyType.Electricity,
        null,
      ),
    ).toThrow('Zahlungsrhythmus');
  });

  it('rejects garden water above the annual consumption', () => {
    expect(() =>
      validateAdvancePayments(
        [entry({ estimatedGardenConsumption: 2000 })],
        EnergyType.Water,
        null,
      ),
    ).toThrow('Gartenwasserverbrauch');
  });

  it('rejects payments on a linked garden-water meter', () => {
    expect(() => validateAdvancePayments([entry()], EnergyType.GardenWater, 'm1')).toThrow(
      'verknüpfter Gartenwasserzähler',
    );
  });

  it('rejects duplicate years', () => {
    expect(() => validateAdvancePayments([entry(), entry()], EnergyType.Electricity, null)).toThrow(
      'Jedes Jahr',
    );
  });
});
