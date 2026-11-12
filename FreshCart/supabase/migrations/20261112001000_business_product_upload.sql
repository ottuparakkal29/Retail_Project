alter table public.products enable row level security;
alter table public.categories enable row level security;

drop policy if exists "Approved businesses can create categories" on public.categories;
drop policy if exists "Businesses can create categories" on public.categories;
create policy "Businesses can create categories"
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
    )
  );

drop policy if exists "Approved businesses can create their own products" on public.products;
create policy "Businesses can create their own products"
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
        and business_profiles.id = products.business_id
    )
  );

drop policy if exists "Approved businesses can update their own products" on public.products;
create policy "Businesses can update their own products"
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
        and business_profiles.id = products.business_id
    )
  );

drop policy if exists "Approved businesses can delete their own products" on public.products;
create policy "Businesses can delete their own products"
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
        and business_profiles.id = products.business_id
    )
  );

drop policy if exists "Approved businesses can upload product media" on storage.objects;
create policy "Businesses can upload product media"
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
        and business_profiles.id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Approved businesses can update product media" on storage.objects;
create policy "Businesses can update product media"
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
        and business_profiles.id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Approved businesses can delete product media" on storage.objects;
create policy "Businesses can delete product media"
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
        and business_profiles.id::text = (storage.foldername(name))[1]
    )
  );
