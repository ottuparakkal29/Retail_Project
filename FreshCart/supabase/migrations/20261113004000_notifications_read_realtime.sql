create or replace function public.set_business_notification_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type = 'admin_message'
    and new.metadata ->> 'decision' in ('approved', 'rejected') then
    new.type := 'business_' || (new.metadata ->> 'decision');
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_set_business_type on public.notifications;
create trigger notifications_set_business_type
  before insert or update of type, metadata on public.notifications
  for each row execute function public.set_business_notification_type();

update public.notifications
set type = 'business_' || (metadata ->> 'decision')
where type = 'admin_message'
  and metadata ->> 'decision' in ('approved', 'rejected');

drop policy if exists "Customers can read their own profile" on public.profiles;
create policy "Customers can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (
    auth_user_id = (select auth.uid())
    or id = (select auth.uid())
  );

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
  on public.notifications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = notifications.user_id
        and (
          profiles.auth_user_id = (select auth.uid())
          or profiles.id = (select auth.uid())
        )
    )
  );

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = notifications.user_id
        and (
          profiles.auth_user_id = (select auth.uid())
          or profiles.id = (select auth.uid())
        )
    )
  )
  with check (
    notifications.is_read = true
    and exists (
      select 1
      from public.profiles
      where profiles.id = notifications.user_id
        and (
          profiles.auth_user_id = (select auth.uid())
          or profiles.id = (select auth.uid())
        )
    )
  );

revoke update on table public.notifications from authenticated;
grant update (is_read) on table public.notifications to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
