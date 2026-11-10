insert into public.profiles (auth_user_id, full_name, phone, role)
select
  users.id,
  nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
  nullif(btrim(users.raw_user_meta_data ->> 'phone'), ''),
  'customer'
from auth.users as users
where users.raw_user_meta_data ? 'full_name'
   or users.raw_user_meta_data ? 'phone'
on conflict (auth_user_id) do update
set
  full_name = coalesce(public.profiles.full_name, excluded.full_name),
  phone = coalesce(public.profiles.phone, excluded.phone);
