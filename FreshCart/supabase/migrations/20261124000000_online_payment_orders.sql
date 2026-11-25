-- Online payment orders are created by authenticated customers and remain unpaid
-- until the Razorpay signature has been verified by the Edge Function.
create policy "Customers can place online orders"
  on public.orders
  for insert
  to authenticated
  with check (
    status = 'pending'
    and payment_method = 'online'
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
