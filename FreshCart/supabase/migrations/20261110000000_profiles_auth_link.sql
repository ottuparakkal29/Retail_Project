alter table public.profiles
  add column if not exists auth_user_id uuid unique
  references auth.users (id) on delete cascade;

alter table public.profiles
  alter column role set default 'customer';

alter table public.profiles enable row level security;

drop policy if exists "Customers can read their own profile" on public.profiles;
create policy "Customers can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

create or replace function public.handle_new_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (auth_user_id, full_name, phone, role)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    'customer'
  )
  on conflict (auth_user_id) do update
  set
    full_name = excluded.full_name,
    phone = excluded.phone;

  return new;
end;
$$;

revoke execute on function public.handle_new_customer_profile()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_customer_profile();
