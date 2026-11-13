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
