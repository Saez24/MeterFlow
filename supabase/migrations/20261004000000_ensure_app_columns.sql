-- Ensures every optional column the app reads or writes exists.
-- The live project was not created exactly from the 2024 migrations (e.g.
-- meters.archived and meters.calorific_value were missing), so PostgREST
-- rejected selects/inserts with PGRST204. Idempotent: existing columns are
-- left untouched; required columns (name, type, value, …) are not touched.

-- ── meters ────────────────────────────────────────────────────────────
alter table public.meters add column if not exists active boolean not null default true;
alter table public.meters add column if not exists meter_number text;
alter table public.meters add column if not exists provider text;
alter table public.meters add column if not exists notes text;
alter table public.meters add column if not exists calorific_value numeric;
alter table public.meters add column if not exists z_number numeric;
alter table public.meters add column if not exists connected_load_kw numeric;
alter table public.meters
  add column if not exists linked_water_meter_id uuid references public.meters(id) on delete set null;
alter table public.meters add column if not exists tariff_history jsonb not null default '[]'::jsonb;
alter table public.meters add column if not exists budget jsonb;
alter table public.meters add column if not exists advance_payments jsonb not null default '[]'::jsonb;
alter table public.meters add column if not exists created_at timestamptz not null default now();

create index if not exists idx_meters_linked_water_meter_id
  on public.meters(linked_water_meter_id);

-- ── readings ──────────────────────────────────────────────────────────
alter table public.readings add column if not exists consumption numeric;
alter table public.readings add column if not exists kwh numeric;
alter table public.readings add column if not exists cost numeric;
alter table public.readings add column if not exists wastewater_cost numeric;
alter table public.readings add column if not exists total_cost numeric;
alter table public.readings add column if not exists note text;
alter table public.readings add column if not exists photo text;
alter table public.readings add column if not exists created_at timestamptz not null default now();

-- ── co2_factors ───────────────────────────────────────────────────────
alter table public.co2_factors add column if not exists source text not null default '';
alter table public.co2_factors add column if not exists source_url text;

-- PostgREST caches the schema; reload it so the new columns are usable at once.
notify pgrst, 'reload schema';
