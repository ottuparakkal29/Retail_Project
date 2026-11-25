-- These tables are created separately; customer_id is the Supabase Auth user ID.
alter table public.shop_updates enable row level security;
alter table public.shop_followers enable row level security;

grant select on public.shop_updates to anon, authenticated;
grant insert, update, delete on public.shop_updates to authenticated;
grant select, insert, delete on public.shop_followers to authenticated;

create index if not exists shop_updates_business_created_idx
  on public.shop_updates (business_id, created_at desc);
create index if not exists shop_followers_business_idx
  on public.shop_followers (business_id);

drop policy if exists "Public can read active shop updates" on public.shop_updates;
create policy "Public can read active shop updates" on public.shop_updates
  for select to anon, authenticated
  using (
    is_active = true
    and (valid_until is null or valid_until >= now())
    and exists (
      select 1 from public.business_profiles as business
      where business.id = shop_updates.business_id
        and business.approval_status = 'approved'
    )
  );

drop policy if exists "Businesses can read own shop updates" on public.shop_updates;
create policy "Businesses can read own shop updates" on public.shop_updates
  for select to authenticated
  using (
    exists (
      select 1 from public.business_profiles as business
      join public.profiles as profile on profile.id = business.user_id
      where business.id = shop_updates.business_id
        and business.approval_status = 'approved'
        and profile.role = 'business'
        and profile.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Businesses can insert own shop updates" on public.shop_updates;
create policy "Businesses can insert own shop updates" on public.shop_updates
  for insert to authenticated
  with check (
    exists (
      select 1 from public.business_profiles as business
      join public.profiles as profile on profile.id = business.user_id
      where business.id = shop_updates.business_id and business.approval_status = 'approved'
        and profile.role = 'business' and profile.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Businesses can update own shop updates" on public.shop_updates;
create policy "Businesses can update own shop updates" on public.shop_updates
  for update to authenticated
  using (
    exists (
      select 1 from public.business_profiles as business
      join public.profiles as profile on profile.id = business.user_id
      where business.id = shop_updates.business_id and business.approval_status = 'approved'
        and profile.role = 'business' and profile.auth_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.business_profiles as business
      join public.profiles as profile on profile.id = business.user_id
      where business.id = shop_updates.business_id and business.approval_status = 'approved'
        and profile.role = 'business' and profile.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Businesses can delete own shop updates" on public.shop_updates;
create policy "Businesses can delete own shop updates" on public.shop_updates
  for delete to authenticated
  using (
    exists (
      select 1 from public.business_profiles as business
      join public.profiles as profile on profile.id = business.user_id
      where business.id = shop_updates.business_id and business.approval_status = 'approved'
        and profile.role = 'business' and profile.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Customers can read own follows" on public.shop_followers;
create policy "Customers can read own follows" on public.shop_followers
  for select to authenticated using (customer_id = (select auth.uid()));

drop policy if exists "Businesses can read their followers" on public.shop_followers;
create policy "Businesses can read their followers" on public.shop_followers
  for select to authenticated
  using (
    exists (
      select 1 from public.business_profiles as business
      join public.profiles as profile on profile.id = business.user_id
      where business.id = shop_followers.business_id and business.approval_status = 'approved'
        and profile.role = 'business' and profile.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Customers can follow approved shops" on public.shop_followers;
create policy "Customers can follow approved shops" on public.shop_followers
  for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and exists (
      select 1 from public.profiles as profile
      where profile.auth_user_id = (select auth.uid()) and profile.role = 'customer'
    )
    and exists (
      select 1 from public.business_profiles as business
      where business.id = shop_followers.business_id and business.approval_status = 'approved'
    )
  );

drop policy if exists "Customers can unfollow shops" on public.shop_followers;
create policy "Customers can unfollow shops" on public.shop_followers
  for delete to authenticated using (customer_id = (select auth.uid()));
