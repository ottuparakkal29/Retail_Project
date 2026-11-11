alter table public.business_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists updated_at timestamptz;

update public.business_profiles
set id = gen_random_uuid()
where id is null;

alter table public.business_profiles
  alter column id set default gen_random_uuid(),
  alter column id set not null;

alter table public.business_profiles enable row level security;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select constraints.conname
    from pg_constraint as constraints
    where constraints.conrelid = 'public.business_profiles'::regclass
      and constraints.contype = 'f'
      and (select attribute.attnum
           from pg_attribute as attribute
           where attribute.attrelid = constraints.conrelid
             and attribute.attname = 'user_id') = any(constraints.conkey)
  loop
    execute format(
      'alter table public.business_profiles drop constraint %I',
      constraint_name
    );
  end loop;

  select constraints.conname into constraint_name
  from pg_constraint as constraints
  where constraints.conrelid = 'public.business_profiles'::regclass
    and constraints.contype = 'p';

  if constraint_name is not null then
    execute format(
      'alter table public.business_profiles drop constraint %I',
      constraint_name
    );
  end if;
end;
$$;

update public.business_profiles as businesses
set user_id = profiles.id
from public.profiles as profiles
where profiles.auth_user_id = businesses.user_id
  and profiles.id <> businesses.user_id;

alter table public.business_profiles
  add constraint business_profiles_pkey primary key (id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.business_profiles'::regclass
      and conname = 'business_profiles_user_id_key'
  ) then
    alter table public.business_profiles
      add constraint business_profiles_user_id_key unique (user_id);
  end if;

  alter table public.business_profiles
    add constraint business_profiles_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.business_profiles'::regclass
      and conname = 'business_profiles_approved_by_fkey'
  ) then
    alter table public.business_profiles
      add constraint business_profiles_approved_by_fkey
      foreign key (approved_by) references public.profiles (id) on delete set null;
  end if;
end;
$$;

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
