-- Safe MVP security posture:
-- 1. The browser must not access tables directly with the anon key.
-- 2. All app data operations go through TanStack server functions.
-- 3. The server Supabase client must use BARSTOCK_SUPABASE_SERVICE_ROLE_KEY.
--
-- Apply only after the server environment has:
-- BARSTOCK_SUPABASE_SERVICE_ROLE_KEY=...
-- BARSTOCK_SESSION_SECRET=...

alter table public.users enable row level security;
alter table public.restaurants enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.inventories enable row level security;
alter table public.inventory_participants enable row level security;
alter table public.inventory_items enable row level security;
alter table public.expected_items enable row level security;
alter table public.discrepancies enable row level security;

revoke all on public.users from anon, authenticated;
revoke all on public.restaurants from anon, authenticated;
revoke all on public.categories from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.inventories from anon, authenticated;
revoke all on public.inventory_participants from anon, authenticated;
revoke all on public.inventory_items from anon, authenticated;
revoke all on public.expected_items from anon, authenticated;
revoke all on public.discrepancies from anon, authenticated;

grant all on public.users to service_role;
grant all on public.restaurants to service_role;
grant all on public.categories to service_role;
grant all on public.products to service_role;
grant all on public.inventories to service_role;
grant all on public.inventory_participants to service_role;
grant all on public.inventory_items to service_role;
grant all on public.expected_items to service_role;
grant all on public.discrepancies to service_role;

drop policy if exists "anon expected read" on public.expected_items;
drop policy if exists "anon expected write" on public.expected_items;
drop policy if exists "anon expected update" on public.expected_items;
drop policy if exists "anon expected delete" on public.expected_items;

drop policy if exists "service users all" on public.users;
drop policy if exists "service restaurants all" on public.restaurants;
drop policy if exists "service categories all" on public.categories;
drop policy if exists "service products all" on public.products;
drop policy if exists "service inventories all" on public.inventories;
drop policy if exists "service inventory_participants all" on public.inventory_participants;
drop policy if exists "service inventory_items all" on public.inventory_items;
drop policy if exists "service expected_items all" on public.expected_items;
drop policy if exists "service discrepancies all" on public.discrepancies;

create policy "service users all" on public.users
  for all to service_role using (true) with check (true);
create policy "service restaurants all" on public.restaurants
  for all to service_role using (true) with check (true);
create policy "service categories all" on public.categories
  for all to service_role using (true) with check (true);
create policy "service products all" on public.products
  for all to service_role using (true) with check (true);
create policy "service inventories all" on public.inventories
  for all to service_role using (true) with check (true);
create policy "service inventory_participants all" on public.inventory_participants
  for all to service_role using (true) with check (true);
create policy "service inventory_items all" on public.inventory_items
  for all to service_role using (true) with check (true);
create policy "service expected_items all" on public.expected_items
  for all to service_role using (true) with check (true);
create policy "service discrepancies all" on public.discrepancies
  for all to service_role using (true) with check (true);

