create or replace function public.admin_send_business_notification(
  p_business_id uuid,
  p_message text
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
begin
  select profiles.id into v_admin_profile_id
  from public.profiles
  where profiles.auth_user_id = auth.uid()
    and profiles.role = 'admin';

  if v_admin_profile_id is null then
    raise exception 'Only admins can send business notifications';
  end if;

  v_message := nullif(btrim(p_message), '');
  if v_message is null then
    raise exception 'A message is required';
  end if;

  select businesses.user_id into v_business_user_id
  from public.business_profiles as businesses
  where businesses.id = p_business_id;

  if v_business_user_id is null then
    raise exception 'Business profile not found';
  end if;

  insert into public.notifications (user_id, title, message, type, metadata)
  values (
    v_business_user_id,
    'Message from FreshCart Admin',
    v_message,
    'admin_message',
    jsonb_build_object(
      'business_profile_id', p_business_id,
      'notification_kind', 'admin_message'
    )
  );
end;
$$;

revoke execute on function public.admin_send_business_notification(uuid, text)
  from public, anon;
grant execute on function public.admin_send_business_notification(uuid, text)
  to authenticated;

create or replace function public.admin_list_business_notifications()
returns table (
  notification_id uuid,
  business_profile_id uuid,
  business_name text,
  title text,
  message text,
  created_at timestamptz,
  is_read boolean
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
    raise exception 'Only admins can view sent business notifications';
  end if;

  return query
  select
    notifications.id,
    businesses.id,
    businesses.business_name,
    notifications.title,
    notifications.message,
    notifications.created_at,
    notifications.is_read
  from public.notifications as notifications
  join public.business_profiles as businesses
    on businesses.id::text = notifications.metadata ->> 'business_profile_id'
  where notifications.type = 'admin_message'
    and notifications.metadata ->> 'notification_kind' = 'admin_message'
  order by notifications.created_at desc;
end;
$$;

revoke execute on function public.admin_list_business_notifications()
  from public, anon;
grant execute on function public.admin_list_business_notifications()
  to authenticated;
