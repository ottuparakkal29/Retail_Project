create table if not exists public.notifications (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'admin_message',
  is_read boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint notifications_pkey primary key (id)
);

create index if not exists idx_notifications_user_id
  on public.notifications using btree (user_id);

alter table public.notifications enable row level security;

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
        and profiles.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Admins can read business license images" on storage.objects;
create policy "Admins can read business license images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'business-licenses'
    and exists (
      select 1
      from public.profiles
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'admin'
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
  else
    v_title := 'Business application rejected';

    update public.business_profiles
    set approval_status = 'rejected',
        approved_by = null,
        approved_at = null,
        rejection_reason = v_message,
        updated_at = now()
    where id = p_business_id;
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
