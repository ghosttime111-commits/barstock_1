-- Expected stock values entered by the accountant for a closed inventory.
-- In the secure MVP the browser must not access this table directly.
-- All reads/writes should go through server functions using the service role key.

create table if not exists public.expected_items (
  inventory_id uuid not null references public.inventories(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (inventory_id, product_id)
);

alter table public.expected_items enable row level security;

revoke all on public.expected_items from anon;
revoke all on public.expected_items from authenticated;
grant all on public.expected_items to service_role;

drop policy if exists "anon expected read" on public.expected_items;
drop policy if exists "anon expected write" on public.expected_items;
drop policy if exists "anon expected update" on public.expected_items;
drop policy if exists "anon expected delete" on public.expected_items;
drop policy if exists "service all" on public.expected_items;

create policy "service all" on public.expected_items
  for all to service_role using (true) with check (true);
