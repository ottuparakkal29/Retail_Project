-- Order management (Phase 3 MVP: cash on delivery / order request).
--
-- public.orders and public.order_items are created in the Supabase dashboard. This migration
-- adds the access rules, integrity checks and realtime publication the FreshCart app relies
-- on. It only touches those two tables and is safe to run more than once.

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Clients may read and place orders. After that only the status, payment status and
-- rejection reason can change, and enforce_order_update_rules (below) decides who may change
-- them and how.
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
grant select, insert on public.orders to authenticated;
grant update (status, payment_status, rejection_reason) on public.orders to authenticated;
grant select, insert on public.order_items to authenticated;

create index if not exists orders_business_id_created_at_idx
  on public.orders (business_id, created_at desc);
create index if not exists orders_customer_id_created_at_idx
  on public.orders (customer_id, created_at desc);
create index if not exists order_items_order_id_idx
  on public.order_items (order_id);

-- public.orders policies

drop policy if exists "Customers can read their own orders" on public.orders;
create policy "Customers can read their own orders"
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = orders.customer_id
        and profiles.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Businesses can read their shop orders" on public.orders;
create policy "Businesses can read their shop orders"
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      join public.business_profiles on business_profiles.user_id = profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'business'
        and business_profiles.approval_status = 'approved'
        and business_profiles.id = orders.business_id
    )
  );

drop policy if exists "Customers can place their own orders" on public.orders;
create policy "Customers can place their own orders"
  on public.orders
  for insert
  to authenticated
  with check (
    status = 'pending'
    and payment_method = 'cod'
    and payment_status = 'unpaid'
    and rejection_reason is null
    and exists (
      select 1
      from public.profiles
      where profiles.id = orders.customer_id
        and profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'customer'
    )
    and exists (
      select 1
      from public.business_profiles
      where business_profiles.id = orders.business_id
        and business_profiles.approval_status = 'approved'
    )
  );

drop policy if exists "Customers can cancel their own pending orders" on public.orders;
create policy "Customers can cancel their own pending orders"
  on public.orders
  for update
  to authenticated
  using (
    status = 'pending'
    and exists (
      select 1
      from public.profiles
      where profiles.id = orders.customer_id
        and profiles.auth_user_id = (select auth.uid())
    )
  )
  with check (
    status = 'cancelled'
    and exists (
      select 1
      from public.profiles
      where profiles.id = orders.customer_id
        and profiles.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Businesses can update their shop orders" on public.orders;
create policy "Businesses can update their shop orders"
  on public.orders
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      join public.business_profiles on business_profiles.user_id = profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'business'
        and business_profiles.approval_status = 'approved'
        and business_profiles.id = orders.business_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      join public.business_profiles on business_profiles.user_id = profiles.id
      where profiles.auth_user_id = (select auth.uid())
        and profiles.role = 'business'
        and business_profiles.approval_status = 'approved'
        and business_profiles.id = orders.business_id
    )
  );

-- public.order_items policies: items are visible with their order and can only be added by the
-- customer while the order is still pending.

drop policy if exists "Order participants can read order items" on public.order_items;
create policy "Order participants can read order items"
  on public.order_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders
      where orders.id = order_items.order_id
    )
  );

drop policy if exists "Customers can add items to their pending orders" on public.order_items;
create policy "Customers can add items to their pending orders"
  on public.order_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.orders
      join public.profiles on profiles.id = orders.customer_id
      where orders.id = order_items.order_id
        and orders.status = 'pending'
        and profiles.auth_user_id = (select auth.uid())
    )
  );

-- Who may change an order, and how. Customers can only cancel a pending order. The shop moves it
-- forward: pending -> accepted | rejected, accepted -> preparing, preparing -> ready_for_pickup
-- (pickup) or out_for_delivery (delivery), then -> delivered, which also marks it paid.
-- Updates without a signed-in user (SQL editor, service role) are not restricted.
create or replace function public.enforce_order_update_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_customer boolean := false;
  v_is_business boolean := false;
  v_item_count integer;
  v_item_total numeric;
begin
  new.updated_at := now();

  if v_user_id is null then
    return new;
  end if;

  if new.status is not distinct from old.status
    and new.payment_status is not distinct from old.payment_status
    and new.rejection_reason is not distinct from old.rejection_reason then
    return new;
  end if;

  select exists (
    select 1
    from public.profiles
    where profiles.id = old.customer_id
      and profiles.auth_user_id = v_user_id
  ) into v_is_customer;

  select exists (
    select 1
    from public.profiles
    join public.business_profiles on business_profiles.user_id = profiles.id
    where profiles.auth_user_id = v_user_id
      and profiles.role = 'business'
      and business_profiles.approval_status = 'approved'
      and business_profiles.id = old.business_id
  ) into v_is_business;

  if v_is_business then
    if not (
      (old.status = 'pending' and new.status in ('accepted', 'rejected'))
      or (old.status = 'accepted' and new.status = 'preparing')
      or (
        old.status = 'preparing'
        and new.status = case old.fulfillment_type
          when 'pickup' then 'ready_for_pickup'
          else 'out_for_delivery'
        end
      )
      or (old.status in ('ready_for_pickup', 'out_for_delivery') and new.status = 'delivered')
    ) then
      raise exception 'An order cannot move from % to %', old.status, new.status
        using detail = 'ORDER_INVALID_TRANSITION';
    end if;

    if new.status = 'rejected' then
      if nullif(btrim(new.rejection_reason), '') is null then
        raise exception 'A reason is required to reject an order'
          using detail = 'ORDER_REJECTION_REASON_REQUIRED';
      end if;
      new.rejection_reason := btrim(new.rejection_reason);
      new.payment_status := old.payment_status;
    elsif new.status = 'delivered' then
      new.payment_status := 'paid';
      new.rejection_reason := old.rejection_reason;
    else
      new.payment_status := old.payment_status;
      new.rejection_reason := old.rejection_reason;
    end if;

    if new.status = 'accepted' then
      select count(*), coalesce(sum(order_items.total_price), 0)
      into v_item_count, v_item_total
      from public.order_items
      where order_items.order_id = old.id;

      if v_item_count = 0 then
        raise exception 'This order has no items yet' using detail = 'ORDER_HAS_NO_ITEMS';
      end if;
      if v_item_total <> old.subtotal or old.subtotal + old.delivery_charge <> old.total_amount then
        raise exception 'The order total does not match its items'
          using detail = 'ORDER_TOTAL_MISMATCH';
      end if;
    end if;
  elsif v_is_customer then
    if not (old.status = 'pending' and new.status = 'cancelled') then
      raise exception 'Only a pending order can be cancelled'
        using detail = 'ORDER_NOT_CANCELLABLE';
    end if;
    new.payment_status := old.payment_status;
    new.rejection_reason := old.rejection_reason;
  else
    raise exception 'You are not allowed to change this order' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_order_update_rules()
  from public, anon, authenticated;

drop trigger if exists orders_enforce_update_rules on public.orders;
create trigger orders_enforce_update_rules
  before update on public.orders
  for each row execute function public.enforce_order_update_rules();

-- Order items are price snapshots, but the price must be the product's current price and the
-- product must belong to the order's shop. A changed price raises ORDER_PRICE_CHANGED so the app
-- can ask the customer to review the cart instead of saving a forged or stale price.
create or replace function public.enforce_order_item_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_business_id uuid;
  v_product record;
begin
  if auth.uid() is null then
    return new;
  end if;

  select orders.business_id into v_order_business_id
  from public.orders
  where orders.id = new.order_id;

  select products.business_id, products.name, products.price, products.is_active
  into v_product
  from public.products
  where products.id = new.product_id;

  if not found
    or v_product.is_active is not true
    or v_product.business_id is distinct from v_order_business_id then
    raise exception 'This product is not available from the shop you are ordering from'
      using detail = 'ORDER_ITEM_UNAVAILABLE';
  end if;

  if new.quantity is null or new.quantity <= 0 then
    raise exception 'Order quantities must be greater than zero';
  end if;

  if new.unit_price is distinct from v_product.price then
    raise exception 'The price of % changed. Review your cart and try again.', v_product.name
      using detail = 'ORDER_PRICE_CHANGED';
  end if;

  new.product_name := v_product.name;
  new.total_price := round(new.unit_price * new.quantity, 2);
  return new;
end;
$$;

revoke execute on function public.enforce_order_item_rules()
  from public, anon, authenticated;

drop trigger if exists order_items_enforce_rules on public.order_items;
create trigger order_items_enforce_rules
  before insert on public.order_items
  for each row execute function public.enforce_order_item_rules();

-- Realtime: lets the shop dashboard and My Orders update without a manual refresh.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'orders'
    ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
