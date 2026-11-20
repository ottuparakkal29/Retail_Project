alter table public.business_profiles
  add column if not exists taluk text null,
  add column if not exists village text null;

update public.business_profiles as business
set
  taluk = location.taluk,
  village = location.village
from (
  select distinct district, taluk, village
  from public.kerala_locations
) as location
where business.taluk is null
  and business.village is null
  and business.district is not null
  and business.area is not null
  and lower(btrim(business.district)) = lower(btrim(location.district))
  and lower(btrim(business.area)) = lower(btrim(location.village))
  and (
    select count(distinct candidate.taluk)
    from public.kerala_locations as candidate
    where lower(btrim(candidate.district)) = lower(btrim(business.district))
      and lower(btrim(candidate.village)) = lower(btrim(business.area))
  ) = 1;

alter table public.kerala_locations enable row level security;
drop policy if exists "Anyone can read Kerala locations"
  on public.kerala_locations;
create policy "Anyone can read Kerala locations"
  on public.kerala_locations
  for select
  to anon, authenticated
  using (true);
grant select on public.kerala_locations to anon, authenticated;

alter table public.business_profiles enable row level security;
revoke select on public.business_profiles from public, anon, authenticated;
grant select (
  id,
  business_name,
  business_type,
  district,
  taluk,
  village,
  address,
  contact_name,
  contact_email,
  contact_phone,
  approval_status
) on public.business_profiles to anon;
grant select (
  id,
  user_id,
  business_name,
  business_type,
  district,
  taluk,
  village,
  address,
  contact_name,
  contact_email,
  contact_phone,
  approval_status
) on public.business_profiles to authenticated;

drop function if exists public.update_own_business_location(text, text, text);
create or replace function public.update_own_business_location(
  p_district text,
  p_taluk text,
  p_village text,
  p_address text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  select profiles.id into v_profile_id
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.role = 'business';

  if v_profile_id is null then
    raise exception 'Only business accounts can update a business location';
  end if;

  if not exists (
    select 1
    from public.kerala_locations
    where kerala_locations.district = p_district
      and kerala_locations.taluk = p_taluk
      and kerala_locations.village = p_village
  ) then
    raise exception 'Choose a valid district, taluk, and village';
  end if;

  update public.business_profiles
  set
    district = p_district,
    taluk = p_taluk,
    village = p_village,
    address = nullif(btrim(p_address), '')
  where user_id = v_profile_id;

  if not found then
    raise exception 'Business profile not found';
  end if;
end;
$$;

revoke execute on function public.update_own_business_location(text, text, text, text)
  from public, anon;
grant execute on function public.update_own_business_location(text, text, text, text)
  to authenticated;

create or replace function public.handle_new_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_is_business boolean;
begin
  v_is_business := new.raw_user_meta_data ->> 'account_type' = 'business';

  insert into public.profiles (id, full_name, phone, role, address)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    'customer',
    case
      when v_is_business then null
      else nullif(btrim(new.raw_user_meta_data ->> 'address'), '')
    end
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    role = case
      when public.profiles.role = 'admin' then 'admin'
      else 'customer'
    end,
    address = coalesce(excluded.address, public.profiles.address)
  returning id into v_profile_id;

  if v_is_business then
    insert into public.business_profiles (
      user_id,
      business_name,
      business_type,
      contact_name,
      contact_email,
      contact_phone,
      license_number,
      gstin,
      fssai_number,
      district,
      taluk,
      village,
      address,
      approval_status
    )
    values (
      v_profile_id,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'business_name'), ''), 'Business'),
      nullif(btrim(new.raw_user_meta_data ->> 'business_type'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'contact_name'), ''),
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'contact_email'), ''), new.email),
      nullif(btrim(new.raw_user_meta_data ->> 'contact_phone'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'license_number'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'gstin'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'fssai_number'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'district'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'taluk'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'village'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'address'), ''),
      'pending'
    )
    on conflict (user_id) do update
    set
      business_name = excluded.business_name,
      business_type = excluded.business_type,
      contact_name = excluded.contact_name,
      contact_email = excluded.contact_email,
      contact_phone = excluded.contact_phone,
      license_number = excluded.license_number,
      gstin = excluded.gstin,
      fssai_number = excluded.fssai_number,
      district = excluded.district,
      taluk = excluded.taluk,
      village = excluded.village,
      address = excluded.address;
  end if;

  return new;
end;
$$;

drop trigger if exists business_profiles_sync_area_from_auth_metadata
  on public.business_profiles;
drop function if exists public.sync_business_area_from_auth_metadata();
alter table public.business_profiles
  drop column if exists area;
