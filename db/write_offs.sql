create table if not exists public.write_offs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  area text not null check (area in ('bar', 'kitchen')),
  product_id uuid not null references public.products(id),
  user_id uuid not null references public.users(id),
  quantity numeric not null check (quantity > 0),
  reason text not null check (char_length(btrim(reason)) >= 3),
  created_at timestamptz not null default now()
);

create index if not exists write_offs_restaurant_created_at_idx
  on public.write_offs (restaurant_id, created_at desc);
create index if not exists write_offs_product_id_idx
  on public.write_offs (product_id);
create index if not exists write_offs_user_id_idx
  on public.write_offs (user_id);
create index if not exists write_offs_area_created_at_idx
  on public.write_offs (area, created_at desc);

alter table public.write_offs enable row level security;

revoke all on public.write_offs from anon, authenticated;
grant select, insert on public.write_offs to service_role;

drop policy if exists "service write_offs all" on public.write_offs;
create policy "service write_offs all" on public.write_offs
  for all to service_role using (true) with check (true);
