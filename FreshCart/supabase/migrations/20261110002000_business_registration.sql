create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  business_name text not null,
  business_type text,
  contact_name text,
  contact_email text,
  contact_phone text,
  license_number text,
  gstin text,
  fssai_number text,
  district text,
  address text,
  license_document_path text,
  approval_status text not null default 'pending',
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.business_profiles enable row level security;

drop policy if exists "Customers can read their own profile" on public.profiles;
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

drop policy if exists "Businesses can read their own profile" on public.business_profiles;
create policy "Businesses can read their own profile"
  on public.business_profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = business_profiles.user_id
        and profiles.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Admins can read business profiles" on public.business_profiles;
create policy "Admins can read business profiles"
  on public.business_profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

drop policy if exists "Admins can update business profiles" on public.business_profiles;
create policy "Admins can update business profiles"
  on public.business_profiles
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

update public.profiles as profiles
set
  full_name = coalesce(
    profiles.full_name,
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), '')
  ),
  phone = coalesce(
    profiles.phone,
    nullif(btrim(users.raw_user_meta_data ->> 'phone'), '')
  ),
  role = case
    when users.raw_user_meta_data ->> 'account_type' = 'business' then 'business'
    else profiles.role
  end
from auth.users as users
where profiles.auth_user_id = users.id;

create or replace function public.handle_new_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_profile_id uuid;
begin
  v_role := case
    when new.raw_user_meta_data ->> 'account_type' = 'business' then 'business'
    else 'customer'
  end;

  insert into public.profiles (auth_user_id, full_name, phone, role)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    v_role
  )
  on conflict (auth_user_id) do update
  set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    role = excluded.role
  returning id into v_profile_id;

  if v_role = 'business' then
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
      address = excluded.address;
  end if;

  return new;
end;
$$;

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
  address,
  approval_status
)
select
  profiles.id,
  coalesce(nullif(btrim(users.raw_user_meta_data ->> 'business_name'), ''), 'Business'),
  nullif(btrim(users.raw_user_meta_data ->> 'business_type'), ''),
  nullif(btrim(users.raw_user_meta_data ->> 'contact_name'), ''),
  coalesce(nullif(btrim(users.raw_user_meta_data ->> 'contact_email'), ''), users.email),
  nullif(btrim(users.raw_user_meta_data ->> 'contact_phone'), ''),
  nullif(btrim(users.raw_user_meta_data ->> 'license_number'), ''),
  nullif(btrim(users.raw_user_meta_data ->> 'gstin'), ''),
  nullif(btrim(users.raw_user_meta_data ->> 'fssai_number'), ''),
  nullif(btrim(users.raw_user_meta_data ->> 'district'), ''),
  nullif(btrim(users.raw_user_meta_data ->> 'address'), ''),
  'pending'
from auth.users as users
join public.profiles as profiles on profiles.auth_user_id = users.id
where users.raw_user_meta_data ->> 'account_type' = 'business'
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
  address = excluded.address;

revoke execute on function public.handle_new_customer_profile()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_customer_profile();

insert into storage.buckets (id, name, public)
values ('business-licenses', 'business-licenses', false)
on conflict (id) do update set public = false;

drop policy if exists "Businesses can upload their own license" on storage.objects;
create policy "Businesses can upload their own license"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'business-licenses'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Businesses can read their own license" on storage.objects;
create policy "Businesses can read their own license"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'business-licenses'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create or replace function public.set_business_license_path(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  if auth.uid() is null or p_path is null
    or split_part(p_path, '/', 1) <> auth.uid()::text then
    raise exception 'Invalid business license path';
  end if;

  select profiles.id into v_profile_id
  from public.profiles
  where profiles.auth_user_id = auth.uid();

  update public.business_profiles
  set license_document_path = p_path
  where user_id = v_profile_id;

  if not found then
    raise exception 'Business profile not found';
  end if;
end;
$$;

revoke execute on function public.set_business_license_path(text)
  from public, anon;
grant execute on function public.set_business_license_path(text)
  to authenticated;
