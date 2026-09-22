-- Migratie: telefoonnummers uit de publiek leesbare advertentietabel halen.
-- Plak dit volledig in Supabase > SQL Editor en klik Run. Eén keer uitvoeren volstaat.

-- ─────────────────────────────────────────────────────────────
-- Telefoonnummers apart houden
--
-- De publieke leesregel op private_listings geeft toegang tot álle kolommen van een goedgekeurde
-- advertentie. Met het nummer in die tabel kon iedereen met de publieke sleutel in één verzoek alle
-- telefoonnummers ophalen. Daarom staat het nummer in een eigen tabel die publiek niet leesbaar is;
-- bezoekers krijgen het per advertentie via ad_phone().
-- ─────────────────────────────────────────────────────────────

create table if not exists private_listing_phones (
  listing_id uuid primary key references private_listings(id) on delete cascade,
  phone      text not null
);

alter table private_listing_phones enable row level security;

-- Verkoper beheert het nummer van zijn eigen advertentie; beheerders mogen het zien
drop policy if exists "own phone" on private_listing_phones;
create policy "own phone" on private_listing_phones for all
  using (
    is_admin()
    or exists (select 1 from private_listings l where l.id = listing_id and l.user_id = auth.uid())
  )
  with check (exists (select 1 from private_listings l where l.id = listing_id and l.user_id = auth.uid()));

-- Bestaande nummers verhuizen en de kolom opruimen
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'private_listings' and column_name = 'phone') then
    insert into private_listing_phones (listing_id, phone)
      select id, phone from private_listings where phone is not null
      on conflict (listing_id) do nothing;
    alter table private_listings drop column phone;
  end if;
end $$;

-- Eén nummer per keer, enkel voor een advertentie die publiek zichtbaar is
create or replace function ad_phone(ad uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.phone
    from private_listing_phones p
    join private_listings l on l.id = p.listing_id
   where p.listing_id = ad
     and l.status = 'approved'
     and l.expires_at > now();
$$;

grant execute on function ad_phone(uuid) to anon, authenticated;

-- De bewaking op advertenties verwees nog naar de verwijderde kolom: opnieuw aanmaken
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
  if new.data is distinct from old.data or new.photos is distinct from old.photos then
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
