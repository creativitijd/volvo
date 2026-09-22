-- Vind een Volvo — Supabase schema
-- Uitvoeren in Supabase > SQL Editor

create table if not exists listings (
  id          text primary key,          -- `${source}:${sourceId}`
  source      text not null,             -- volvo_be | volvo_nl | 2dehands | autoscout24
  model       text not null,
  price       integer not null,
  active      boolean not null default true,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  data        jsonb not null             -- volledig Listing-object (src/lib/types.ts)
);

create index if not exists listings_active_idx on listings (active, source);
create index if not exists listings_model_idx on listings (model);

create table if not exists price_history (
  id          bigserial primary key,
  listing_id  text not null references listings(id) on delete cascade,
  price       integer not null,
  seen_at     timestamptz not null default now()
);

create index if not exists price_history_listing_idx on price_history (listing_id, seen_at);

-- Publiek leesbaar (anon key), schrijven enkel via service role
alter table listings enable row level security;
alter table price_history enable row level security;

drop policy if exists "public read listings" on listings;
create policy "public read listings" on listings for select using (true);

drop policy if exists "public read price_history" on price_history;
create policy "public read price_history" on price_history for select using (true);

-- ─────────────────────────────────────────────────────────────
-- Accounts: favorieten en e-mailmeldingen
-- (gebruikers zelf zitten in auth.users, beheerd door Supabase Auth)
-- ─────────────────────────────────────────────────────────────

create table if not exists favorites (
  user_id     uuid not null references auth.users(id) on delete cascade,
  listing_id  text not null,            -- geen FK: favoriet blijft bestaan als de wagen verkocht is
  snapshot    jsonb,                    -- kaartgegevens op het moment van liken (voor verkochte wagens)
  created_at  timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists alerts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  criteria           jsonb not null,    -- Criteria uit src/lib/filters.ts
  frequency          text not null check (frequency in ('daily', 'weekly')),
  unsubscribe_token  uuid not null default gen_random_uuid(),
  last_sent_at       timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists alerts_user_idx on alerts (user_id);

alter table favorites enable row level security;
alter table alerts enable row level security;

drop policy if exists "own favorites" on favorites;
create policy "own favorites" on favorites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own alerts" on alerts;
create policy "own alerts" on alerts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Uitschrijven via de link in de e-mail, zonder in te loggen
create or replace function unsubscribe_alert(token uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with d as (delete from alerts where unsubscribe_token = token returning 1)
  select exists (select 1 from d);
$$;

grant execute on function unsubscribe_alert(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Particuliere advertenties (met moderatie, 60 dagen geldig)
-- ─────────────────────────────────────────────────────────────

-- Beheerders: voeg jezelf toe met
--   insert into admins (user_id) select id from auth.users where email = '<jouw e-mailadres>';
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table admins enable row level security;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

drop policy if exists "admins see admins" on admins;
create policy "admins see admins" on admins for select using (is_admin());

create table if not exists private_listings (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  status              text not null default 'pending'
                        check (status in ('pending', 'approved', 'rejected', 'sold')),
  data                jsonb not null,          -- PrivateAd uit src/lib/private.ts
  photos              text[] not null default '{}',  -- publieke URL's in de Sevalla-bucket
  phone               text not null,
  reject_reason       text,
  created_at          timestamptz not null default now(),
  approved_at         timestamptz,
  expires_at          timestamptz,
  seller_notified_at  timestamptz,             -- mail na goedkeuren/afwijzen verstuurd
  reminder_sent_at    timestamptz              -- herinnering vóór het verlopen verstuurd
);

create index if not exists private_listings_public_idx on private_listings (status, expires_at);
create index if not exists private_listings_user_idx on private_listings (user_id);

alter table private_listings enable row level security;

-- Iedereen ziet goedgekeurde, niet-verlopen advertenties
drop policy if exists "public approved ads" on private_listings;
create policy "public approved ads" on private_listings for select
  using (status = 'approved' and expires_at > now());

-- Verkopers zien en beheren hun eigen advertenties
drop policy if exists "own ads select" on private_listings;
create policy "own ads select" on private_listings for select using (auth.uid() = user_id);

drop policy if exists "own ads insert" on private_listings;
create policy "own ads insert" on private_listings for insert
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "own ads update" on private_listings;
create policy "own ads update" on private_listings for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own ads delete" on private_listings;
create policy "own ads delete" on private_listings for delete using (auth.uid() = user_id);

-- Beheerders zien en wijzigen alles
drop policy if exists "admins all ads" on private_listings;
create policy "admins all ads" on private_listings for all using (is_admin()) with check (is_admin());

-- Verkopers mogen hun advertentie niet zelf goedkeuren: status en datums bewaakt door een trigger
create or replace function guard_private_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() or auth.role() = 'service_role' then
    if new.status = 'approved' and old.status is distinct from 'approved' then
      new.approved_at := now();
      new.expires_at := now() + interval '60 days';
      new.seller_notified_at := null;
    end if;
    if new.status = 'rejected' and old.status is distinct from 'rejected' then
      new.seller_notified_at := null;
    end if;
    return new;
  end if;

  -- Verkoper: enkel als verkocht markeren of verlengen; inhoud wijzigen = opnieuw nakijken
  if new.status not in ('pending', 'sold') and new.status is distinct from old.status then
    raise exception 'Status % mag je niet zelf instellen', new.status;
  end if;
  if new.data is distinct from old.data or new.photos is distinct from old.photos or new.phone is distinct from old.phone then
    new.status := 'pending';
    new.approved_at := null;
    new.expires_at := null;
  end if;
  -- Vervaldatum enkel via renew_private_listing() (die zet de vlag app.renewing)
  if coalesce(current_setting('app.renewing', true), '') <> '1' and new.status <> 'pending' then
    new.expires_at := old.expires_at;
  end if;
  new.approved_at := case when new.status = 'pending' then null else old.approved_at end;
  new.reject_reason := case when new.status = 'pending' then null else old.reject_reason end;
  new.seller_notified_at := old.seller_notified_at;
  new.reminder_sent_at := case when new.expires_at is distinct from old.expires_at then null else old.reminder_sent_at end;
  return new;
end;
$$;

drop trigger if exists guard_private_listing on private_listings;
create trigger guard_private_listing before update on private_listings
  for each row execute function guard_private_listing();

-- Verlengen met 60 dagen (enkel eigen, goedgekeurde advertenties die binnen 14 dagen verlopen of verlopen zijn)
create or replace function renew_private_listing(ad_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  new_expiry timestamptz;
begin
  perform set_config('app.renewing', '1', true);
  update private_listings
     set expires_at = greatest(now(), expires_at) + interval '60 days',
         reminder_sent_at = null
   where id = ad_id
     and user_id = auth.uid()
     and status = 'approved'
     and expires_at < now() + interval '14 days'
  returning expires_at into new_expiry;
  perform set_config('app.renewing', '', true);
  return new_expiry;
end;
$$;
grant execute on function renew_private_listing(uuid) to authenticated;

-- Foto's staan in een Sevalla object-storage bucket, niet in Supabase Storage.
