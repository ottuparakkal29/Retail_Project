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
  v_notification_message text;
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
    raise exception 'A message to the business is required when rejecting an application';
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
    v_notification_message :=
      'Your business account has been approved. You can now access your business dashboard.';

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
    v_notification_message :=
      'Your business application has been rejected.';

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

  if v_message is not null then
    v_notification_message := v_notification_message
      || E'\n\nMessage from FreshCart Admin:\n'
      || v_message;
  end if;

  insert into public.notifications (user_id, title, message, type, metadata)
  values (
    v_business_user_id,
    v_title,
    v_notification_message,
    'business_' || p_decision,
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
