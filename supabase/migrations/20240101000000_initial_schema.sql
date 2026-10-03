-- MeterFlow Initial Schema
-- Enables Row Level Security (RLS) on all tables

-- ── Extensions ─────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Meters ─────────────────────────────────────────────────────────
create table if not exists public.meters (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  name            text not null,
  type            text not null,
  unit            text not null,
  icon            text not null,
  color           text not null,
  active          boolean not null default true,
  archived        boolean not null default false,
  meter_number    text,
  provider        text,
  notes           text,
  calorific_value numeric,
  z_number        numeric,
  linked_water_meter_id uuid references public.meters(id) on delete set null,
  tariff_history  jsonb not null default '[]'::jsonb,
  budget          jsonb,
  created_at      timestamptz not null default now()
);

alter table public.meters enable row level security;

create policy "Users can manage their own meters"
  on public.meters
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Readings ───────────────────────────────────────────────────────
create table if not exists public.readings (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  meter_id        uuid references public.meters(id) on delete cascade not null,
  date            date not null,
  value           numeric not null,
  consumption     numeric,
  kwh             numeric,
  cost            numeric,
  wastewater_cost numeric,
  total_cost      numeric,
  note            text,
  photo           text,
  created_at      timestamptz not null default now()
);

alter table public.readings enable row level security;

create policy "Users can manage their own readings"
  on public.readings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Indexes ────────────────────────────────────────────────────────
create index if not exists idx_meters_user_id on public.meters(user_id);
create index if not exists idx_readings_user_id on public.readings(user_id);
create index if not exists idx_readings_meter_id on public.readings(meter_id);
create index if not exists idx_readings_date on public.readings(date desc);
