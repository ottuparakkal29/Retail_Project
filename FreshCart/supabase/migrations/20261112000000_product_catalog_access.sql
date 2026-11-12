alter table public.products enable row level security;
alter table public.categories enable row level security;

drop policy if exists "Anyone can read active categories" on public.categories;
create policy "Anyone can read active categories"
  on public.categories
  for select
  to anon, authenticated
  using (is_active);

drop policy if exists "Approved businesses can create categories" on public.categories;
create policy "Approved businesses can create categories"
  on public.categories
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      join public.business_profiles on business_profiles.user_id = profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'business'
        and business_profiles.approval_status = 'approved'
    )
  );

drop policy if exists "Anyone can read active products" on public.products;
create policy "Anyone can read active products"
  on public.products
  for select
  to anon, authenticated
  using (is_active);

drop policy if exists "Businesses can read their own products" on public.products;
create policy "Businesses can read their own products"
  on public.products
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      join public.business_profiles on business_profiles.user_id = profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'business'
        and business_profiles.id = products.business_id
    )
  );

drop policy if exists "Approved businesses can create their own products" on public.products;
create policy "Approved businesses can create their own products"
  on public.products
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      join public.business_profiles on business_profiles.user_id = profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'business'
        and business_profiles.approval_status = 'approved'
        and business_profiles.id = products.business_id
    )
  );

drop policy if exists "Approved businesses can update their own products" on public.products;
create policy "Approved businesses can update their own products"
  on public.products
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      join public.business_profiles on business_profiles.user_id = profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'business'
        and business_profiles.approval_status = 'approved'
        and business_profiles.id = products.business_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      join public.business_profiles on business_profiles.user_id = profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'business'
        and business_profiles.approval_status = 'approved'
        and business_profiles.id = products.business_id
    )
  );

drop policy if exists "Approved businesses can delete their own products" on public.products;
create policy "Approved businesses can delete their own products"
  on public.products
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      join public.business_profiles on business_profiles.user_id = profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'business'
        and business_profiles.approval_status = 'approved'
        and business_profiles.id = products.business_id
    )
  );

insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Approved businesses can upload product media" on storage.objects;
create policy "Approved businesses can upload product media"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-media'
    and exists (
      select 1
      from public.profiles
      join public.business_profiles on business_profiles.user_id = profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'business'
        and business_profiles.approval_status = 'approved'
        and business_profiles.id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Approved businesses can update product media" on storage.objects;
create policy "Approved businesses can update product media"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'product-media'
    and exists (
      select 1
      from public.profiles
      join public.business_profiles on business_profiles.user_id = profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'business'
        and business_profiles.approval_status = 'approved'
        and business_profiles.id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'product-media'
    and exists (
      select 1
      from public.profiles
      join public.business_profiles on business_profiles.user_id = profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'business'
        and business_profiles.approval_status = 'approved'
        and business_profiles.id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Approved businesses can delete product media" on storage.objects;
create policy "Approved businesses can delete product media"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-media'
    and exists (
      select 1
      from public.profiles
      join public.business_profiles on business_profiles.user_id = profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'business'
        and business_profiles.approval_status = 'approved'
        and business_profiles.id::text = (storage.foldername(name))[1]
    )
  );
