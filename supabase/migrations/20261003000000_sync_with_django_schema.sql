-- Brings the Supabase schema up to the state of the Django backend on `main`
-- (backend/apps/meters/models.py, backend/apps/readings/views.py).
-- Append-only: the three 2024 migrations are already applied in production.

-- ── Meters: new columns ───────────────────────────────────────────────
-- Fernwärme: Anschlussleistung in kW.
alter table public.meters
  add column if not exists connected_load_kw numeric;

-- Abschläge pro Kalenderjahr (siehe AdvancePaymentYear im Frontend). The
-- detailed validation runs in ApiService.validateAdvancePayments; the DB only
-- guarantees the top-level shape.
alter table public.meters
  add column if not exists advance_payments jsonb not null default '[]'::jsonb;

alter table public.meters
  drop constraint if exists meters_advance_payments_is_array;
alter table public.meters
  add constraint meters_advance_payments_is_array
  check (jsonb_typeof(advance_payments) = 'array');

alter table public.meters
  drop constraint if exists meters_tariff_history_is_array;
alter table public.meters
  add constraint meters_tariff_history_is_array
  check (jsonb_typeof(tariff_history) = 'array');

-- ── Indexes: every foreign key is indexed ─────────────────────────────
create index if not exists idx_meters_linked_water_meter_id
  on public.meters(linked_water_meter_id);
create index if not exists idx_co2_factors_user_id
  on public.co2_factors(user_id);

-- ── Ownership of referenced meters ────────────────────────────────────
-- RLS only checks the row's own user_id. Without these triggers a user could
-- point a reading or a garden-water link at another user's meter id (Django
-- rejects that with 403/404 via OwnMeterField and _resolve_meter_id).
-- Security invoker: the lookup runs under the caller's RLS, so only own
-- meters are visible; the explicit user_id match keeps it correct even for
-- privileged roles that bypass RLS.
create or replace function public.readings_check_meter_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.meters m where m.id = new.meter_id and m.user_id = new.user_id
  ) then
    raise exception 'Meter not found or no access' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.meters_check_linked_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.linked_water_meter_id is not null and not exists (
    select 1 from public.meters m
    where m.id = new.linked_water_meter_id and m.user_id = new.user_id
  ) then
    raise exception 'Linked water meter not found or no access' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Trigger functions are not meant to be called directly.
revoke all on function public.readings_check_meter_owner() from public, anon, authenticated;
revoke all on function public.meters_check_linked_owner() from public, anon, authenticated;

drop trigger if exists readings_check_meter_owner on public.readings;
create trigger readings_check_meter_owner
  before insert or update of meter_id, user_id on public.readings
  for each row execute function public.readings_check_meter_owner();

drop trigger if exists meters_check_linked_owner on public.meters;
create trigger meters_check_linked_owner
  before insert or update of linked_water_meter_id, user_id on public.meters
  for each row execute function public.meters_check_linked_owner();

-- ── Storage: same photo limit as the Django backend (10 MiB) ──────────
update storage.buckets
  set file_size_limit = 10485760
  where id = 'meter-photos';
