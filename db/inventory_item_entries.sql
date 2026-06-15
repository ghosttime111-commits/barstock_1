create table if not exists public.inventory_item_entries (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventories(id) on delete cascade,
  product_id uuid not null references public.products(id),
  user_id uuid references public.users(id),
  quantity numeric not null,
  entry_type text not null default 'add' check (entry_type in ('add', 'set')),
  created_at timestamptz not null default now()
);

alter table public.inventory_item_entries enable row level security;

revoke all on public.inventory_item_entries from anon;
revoke all on public.inventory_item_entries from authenticated;
grant all on public.inventory_item_entries to service_role;

drop policy if exists "service inventory_item_entries all" on public.inventory_item_entries;

create policy "service inventory_item_entries all" on public.inventory_item_entries
  for all to service_role using (true) with check (true);
