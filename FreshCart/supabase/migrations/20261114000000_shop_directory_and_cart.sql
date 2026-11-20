alter table public.business_profiles
  add column if not exists area text null;

update public.business_profiles as business
set area = nullif(btrim(users.raw_user_meta_data ->> 'area'), '')
from public.profiles
join auth.users as users on users.id = profiles.auth_user_id
where profiles.id = business.user_id
  and business.area is null
  and nullif(btrim(users.raw_user_meta_data ->> 'area'), '') is not null;

alter table public.business_profiles enable row level security;

revoke select on public.business_profiles from public, anon, authenticated;
grant select (
  id,
  business_name,
  business_type,
  district,
  area,
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
  area,
  address,
  contact_name,
  contact_email,
  contact_phone,
  approval_status
) on public.business_profiles to authenticated;

drop policy if exists "Public can read approved businesses" on public.business_profiles;
create policy "Public can read approved businesses"
  on public.business_profiles
  for select
  to anon, authenticated
  using (approval_status = 'approved');

create or replace function public.admin_list_business_profiles()
returns table (
  id uuid,
  business_name text,
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
  created_at timestamptz,
  approval_status text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where profiles.auth_user_id = auth.uid()
      and profiles.role = 'admin'
  ) then
    raise exception 'Only administrators can list business profiles';
  end if;

  return query
  select
    business.id,
    business.business_name,
    business.business_type,
    business.contact_name,
    business.contact_email,
    business.contact_phone,
    business.license_number,
    business.gstin,
    business.fssai_number,
    business.district,
    business.address,
    business.license_document_path,
    business.created_at,
    business.approval_status
  from public.business_profiles as business
  where business.approval_status in ('pending', 'approved')
  order by business.created_at desc;
end;
$$;

revoke execute on function public.admin_list_business_profiles()
  from public, anon;
grant execute on function public.admin_list_business_profiles()
  to authenticated;

create or replace function public.sync_business_area_from_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.business_profiles as business
  set area = nullif(btrim(users.raw_user_meta_data ->> 'area'), '')
  from public.profiles
  join auth.users as users on users.id = profiles.auth_user_id
  where profiles.id = new.user_id
    and business.id = new.id
    and business.area is distinct from
      nullif(btrim(users.raw_user_meta_data ->> 'area'), '');

  return new;
end;
$$;

drop trigger if exists business_profiles_sync_area_from_auth_metadata
  on public.business_profiles;
create trigger business_profiles_sync_area_from_auth_metadata
  after insert on public.business_profiles
  for each row execute function public.sync_business_area_from_auth_metadata();

revoke execute on function public.sync_business_area_from_auth_metadata()
  from public, anon, authenticated;

create or replace function public.update_own_business_location(
  p_district text,
  p_area text,
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

  update public.business_profiles
  set
    district = nullif(btrim(p_district), ''),
    area = nullif(btrim(p_area), ''),
    address = nullif(btrim(p_address), '')
  where user_id = v_profile_id;

  if not found then
    raise exception 'Business profile not found';
  end if;
end;
$$;

revoke execute on function public.update_own_business_location(text, text, text)
  from public, anon;
grant execute on function public.update_own_business_location(text, text, text)
  to authenticated;

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table public.cart_items enable row level security;

drop policy if exists "Customers can read their own cart items" on public.cart_items;
create policy "Customers can read their own cart items"
  on public.cart_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = cart_items.user_id
        and profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'customer'
    )
  );

drop policy if exists "Customers can update their own cart items" on public.cart_items;
create policy "Customers can update their own cart items"
  on public.cart_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = cart_items.user_id
        and profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'customer'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = cart_items.user_id
        and profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'customer'
    )
  );

drop policy if exists "Customers can delete their own cart items" on public.cart_items;
create policy "Customers can delete their own cart items"
  on public.cart_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = cart_items.user_id
        and profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'customer'
    )
  );

grant select, delete on public.cart_items to authenticated;
grant update (quantity) on public.cart_items to authenticated;

create or replace function public.add_cart_item(
  p_product_id uuid,
  p_quantity integer default 1
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  if auth.uid() is null or p_quantity is null or p_quantity < 1 then
    raise exception 'A signed-in customer and positive quantity are required';
  end if;

  select profiles.id into v_profile_id
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.role = 'customer';

  if v_profile_id is null then
    raise exception 'Only customer accounts can add items to a cart';
  end if;

  if not exists (
    select 1
    from public.products
    where products.id = p_product_id
      and products.is_active = true
  ) then
    raise exception 'This product is not available';
  end if;

  insert into public.cart_items as existing (user_id, product_id, quantity)
  values (v_profile_id, p_product_id, p_quantity)
  on conflict (user_id, product_id) do update
    set quantity = existing.quantity + excluded.quantity;
end;
$$;

revoke execute on function public.add_cart_item(uuid, integer)
  from public, anon;
grant execute on function public.add_cart_item(uuid, integer)
  to authenticated;
