-- CO₂-Emissionsfaktoren pro User: jährlich pflegbare Werte
-- Fallback auf hartkodierte Konstanten (CO2_FACTORS) im Client wenn keine Einträge vorhanden.

create table co2_factors (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  energy_type      text not null,
  factor_kg_per_unit numeric(12, 6) not null,   -- kg CO₂ pro Einheit (kann negativ sein: Solar)
  unit             text not null,                -- kWh, m³, Liter, MWh
  source           text not null default '',
  source_url       text,
  valid_from       date not null default current_date,
  created_at       timestamptz not null default now(),

  unique (user_id, energy_type, valid_from)
);

-- RLS
alter table co2_factors enable row level security;

create policy "users can read own co2 factors"
  on co2_factors for select
  using (auth.uid() = user_id);

create policy "users can insert own co2 factors"
  on co2_factors for insert
  with check (auth.uid() = user_id);

create policy "users can update own co2 factors"
  on co2_factors for update
  using (auth.uid() = user_id);

create policy "users can delete own co2 factors"
  on co2_factors for delete
  using (auth.uid() = user_id);
