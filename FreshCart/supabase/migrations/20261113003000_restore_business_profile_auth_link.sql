update public.profiles as profiles
set role = 'customer'
from auth.users as users
where profiles.id = users.id
  and users.raw_user_meta_data ->> 'account_type' = 'business'
  and profiles.role <> 'admin'
  and exists (
    select 1
    from public.business_profiles as businesses
    where businesses.user_id = profiles.id
      and businesses.approval_status <> 'approved'
  );

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
join public.profiles as profiles on profiles.id = users.id
where users.raw_user_meta_data ->> 'account_type' = 'business'
on conflict (user_id) do nothing;

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

drop trigger if exists on_auth_user_created_profile on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_business_profile on auth.users;

do $$
declare
  existing_trigger record;
begin
  for existing_trigger in
    select triggers.tgname
    from pg_trigger as triggers
    where triggers.tgrelid = 'auth.users'::regclass
      and not triggers.tgisinternal
      and triggers.tgfoid = 'public.handle_new_customer_profile()'::regprocedure
  loop
    execute format('drop trigger %I on auth.users', existing_trigger.tgname);
  end loop;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_customer_profile();

drop policy if exists "Businesses can insert their own pending profile"
  on public.business_profiles;
create policy "Businesses can insert their own pending profile"
  on public.business_profiles
  for insert
  to authenticated
  with check (
    approval_status = 'pending'
    and exists (
      select 1
      from public.profiles
      where profiles.id = business_profiles.user_id
        and profiles.auth_user_id = (select auth.uid())
        and (select auth.jwt() -> 'user_metadata' ->> 'account_type') = 'business'
    )
  );

drop policy if exists "Businesses can update their own pending profile"
  on public.business_profiles;
create policy "Businesses can update their own pending profile"
  on public.business_profiles
  for update
  to authenticated
  using (
    approval_status = 'pending'
    and exists (
      select 1
      from public.profiles
      where profiles.id = business_profiles.user_id
        and profiles.auth_user_id = (select auth.uid())
        and (select auth.jwt() -> 'user_metadata' ->> 'account_type') = 'business'
    )
  )
  with check (
    approval_status = 'pending'
    and exists (
      select 1
      from public.profiles
      where profiles.id = business_profiles.user_id
        and profiles.auth_user_id = (select auth.uid())
        and (select auth.jwt() -> 'user_metadata' ->> 'account_type') = 'business'
    )
  );

create or replace function public.admin_review_business(
  p_business_id uuid,
  p_decision text,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_profile_id uuid;
  v_business_user_id uuid;
  v_message text;
  v_title text;
begin
  select profiles.id into v_admin_profile_id
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.role = 'admin';

  if v_admin_profile_id is null then
    raise exception 'Only admins can review business applications';
  end if;

  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  v_message := nullif(btrim(p_message), '');
  if p_decision = 'rejected' and v_message is null then
    raise exception 'A rejection message is required';
  end if;

  select businesses.user_id into v_business_user_id
  from public.business_profiles as businesses
  where businesses.id = p_business_id
    and businesses.approval_status = 'pending'
  for update;

  if v_business_user_id is null then
    raise exception 'Pending business application not found';
  end if;

  if p_decision = 'approved' then
    v_title := 'Business application approved';
    v_message := coalesce(
      v_message,
      'Your business account has been approved. You can now access your business dashboard.'
    );

    update public.business_profiles
    set approval_status = 'approved',
        approved_by = v_admin_profile_id,
        approved_at = now(),
        rejection_reason = null,
        updated_at = now()
    where id = p_business_id;

    update public.profiles
    set role = 'business'
    where id = v_business_user_id;
  else
    v_title := 'Business application rejected';

    update public.business_profiles
    set approval_status = 'rejected',
        approved_by = null,
        approved_at = null,
        rejection_reason = v_message,
        updated_at = now()
    where id = p_business_id;

    update public.profiles
    set role = 'customer'
    where id = v_business_user_id
      and role <> 'admin';
  end if;

  insert into public.notifications (user_id, title, message, type, metadata)
  values (
    v_business_user_id,
    v_title,
    v_message,
    'admin_message',
    jsonb_build_object(
      'business_profile_id', p_business_id,
      'decision', p_decision
    )
  );
end;
$$;

revoke execute on function public.admin_review_business(uuid, text, text)
  from public, anon;
grant execute on function public.admin_review_business(uuid, text, text)
  to authenticated;
