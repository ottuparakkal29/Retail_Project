create or replace function public.handle_new_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_profile_id uuid;
begin
  v_role := case
    when new.raw_user_meta_data ->> 'account_type' = 'business' then 'business'
    else 'customer'
  end;

  insert into public.profiles (id, full_name, phone, role, address)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    v_role,
    case
      when v_role = 'customer' then nullif(btrim(new.raw_user_meta_data ->> 'address'), '')
      else null
    end
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    role = excluded.role,
    address = coalesce(excluded.address, public.profiles.address)
  returning id into v_profile_id;

  if v_role = 'business' then
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

update public.profiles as profiles
set address = nullif(btrim(users.raw_user_meta_data ->> 'address'), '')
from auth.users as users
where profiles.id = users.id
  and profiles.role = 'customer'
  and nullif(btrim(users.raw_user_meta_data ->> 'address'), '') is not null;
