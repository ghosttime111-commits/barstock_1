begin;

create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.restaurant_networks(id) on delete restrict,
  from_restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  to_restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  area text not null check (area in ('bar', 'kitchen')),
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  status text not null default 'sent' check (status in ('sent', 'delivered', 'cancelled')),
  sent_by uuid not null references public.users(id) on delete restrict,
  delivered_by uuid references public.users(id) on delete set null,
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  comment text,
  delivery_comment text,
  constraint stock_transfers_different_restaurants_check
    check (from_restaurant_id <> to_restaurant_id)
);

create index if not exists stock_transfers_network_id_idx
  on public.stock_transfers (network_id);
create index if not exists stock_transfers_from_restaurant_id_idx
  on public.stock_transfers (from_restaurant_id);
create index if not exists stock_transfers_to_restaurant_id_idx
  on public.stock_transfers (to_restaurant_id);
create index if not exists stock_transfers_product_id_idx
  on public.stock_transfers (product_id);
create index if not exists stock_transfers_status_idx
  on public.stock_transfers (status);
create index if not exists stock_transfers_sent_at_idx
  on public.stock_transfers (sent_at desc);

alter table public.stock_transfers enable row level security;

revoke all on public.stock_transfers from anon, authenticated;
grant select, insert, update on public.stock_transfers to service_role;

drop policy if exists "service stock_transfers all" on public.stock_transfers;
create policy "service stock_transfers all" on public.stock_transfers
  for all to service_role using (true) with check (true);

-- Tenant isolation is enforced by BarStock server functions using service_role.
-- network_id, from_restaurant_id and area are always resolved from the current user.

commit;
