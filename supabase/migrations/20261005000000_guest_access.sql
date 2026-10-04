-- Guest access for the demo (branch `supabase`): anonymous sign-ins get their
-- own demo data (seeded by the client), cannot upload photos, are limited in
-- volume and are deleted 24 h after sign-up by a pg_cron job.
-- Requires "Allow anonymous sign-ins" in Authentication → Providers.
-- Idempotent: safe to run more than once.

-- ── Cascades: deleting a guest in auth.users must remove all their rows ──
-- The live schema drifted from the repo migrations before, so the foreign
-- keys are checked and (re)created with ON DELETE CASCADE where needed.
create or replace function pg_temp.ensure_cascade_fk(
  p_table regclass, p_column text, p_target regclass, p_target_column text
) returns void
language plpgsql
as $$
declare
  fk record;
  found_fk boolean := false;
begin
  for fk in
    select c.conname, c.confdeltype
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f'
      and c.conrelid = p_table
      and c.confrelid = p_target
      and a.attname = p_column
  loop
    found_fk := true;
    if fk.confdeltype <> 'c' then
      execute format('alter table %s drop constraint %I', p_table, fk.conname);
      found_fk := false;
    end if;
  end loop;

  if not found_fk then
    -- NOT VALID: do not fail on legacy orphan rows; the cascade still applies.
    execute format(
      'alter table %s add constraint %I foreign key (%I) references %s(%I) on delete cascade not valid',
      p_table,
      replace(p_table::text, '.', '_') || '_' || p_column || '_cascade_fkey',
      p_column, p_target, p_target_column
    );
  end if;
end;
$$;

select pg_temp.ensure_cascade_fk('public.meters', 'user_id', 'auth.users', 'id');
select pg_temp.ensure_cascade_fk('public.readings', 'user_id', 'auth.users', 'id');
select pg_temp.ensure_cascade_fk('public.readings', 'meter_id', 'public.meters', 'id');
select pg_temp.ensure_cascade_fk('public.co2_factors', 'user_id', 'auth.users', 'id');

-- ── Guests cannot upload photos ───────────────────────────────────────
-- Restrictive: combined with AND on top of the existing per-user policy.
-- (Storage files cannot be deleted via SQL, so the 24 h cleanup could not
-- remove them; it also keeps strangers from storing files on the project.)
drop policy if exists "Guests cannot upload photos" on storage.objects;
create policy "Guests cannot upload photos"
  on storage.objects
  as restrictive
  for insert
  to authenticated
  with check (coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false);

-- ── Volume limit for guests (abuse protection) ────────────────────────
create or replace function public.guest_row_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_rows integer := case tg_table_name when 'meters' then 20 else 2000 end;
  row_count integer;
begin
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    if tg_table_name = 'meters' then
      select count(*) into row_count from public.meters where user_id = new.user_id;
    else
      select count(*) into row_count from public.readings where user_id = new.user_id;
    end if;
    if row_count >= max_rows then
      raise exception 'Gastmodus: Limit von % Einträgen erreicht', max_rows
        using errcode = '54000';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guest_row_limit() from public, anon, authenticated;

drop trigger if exists meters_guest_row_limit on public.meters;
create trigger meters_guest_row_limit
  before insert on public.meters
  for each row execute function public.guest_row_limit();

drop trigger if exists readings_guest_row_limit on public.readings;
create trigger readings_guest_row_limit
  before insert on public.readings
  for each row execute function public.guest_row_limit();

-- ── Delete guests 24 h after sign-up ──────────────────────────────────
-- Runs hourly at :15. Rows in meters/readings/co2_factors follow via cascade.
-- cron.schedule with an existing job name replaces that job.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'cleanup-guest-users',
  '15 * * * *',
  $$ delete from auth.users
     where is_anonymous is true
       and created_at < now() - interval '24 hours' $$
);
