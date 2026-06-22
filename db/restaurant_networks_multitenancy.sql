begin;

create table if not exists public.restaurant_networks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create unique index if not exists restaurant_networks_name_unique_idx
  on public.restaurant_networks (lower(btrim(name)));

insert into public.restaurant_networks (name)
select 'Terra'
where not exists (
  select 1 from public.restaurant_networks where lower(btrim(name)) = lower('Terra')
);

alter table public.restaurants add column if not exists network_id uuid;
alter table public.users add column if not exists network_id uuid;
alter table public.categories add column if not exists network_id uuid;
alter table public.products add column if not exists network_id uuid;
alter table public.inventories add column if not exists network_id uuid;

do $$
begin
  if to_regclass('public.write_offs') is not null then
    alter table public.write_offs add column if not exists network_id uuid;
  end if;
end $$;

do $$
declare
  terra_id uuid;
begin
  select id into terra_id
  from public.restaurant_networks
  where lower(btrim(name)) = lower('Terra')
  order by created_at
  limit 1;

  if terra_id is null then
    raise exception 'Не удалось создать сеть Terra';
  end if;

  update public.restaurants set network_id = terra_id where network_id is null;
  update public.users
  set network_id = terra_id
  where network_id is null and role <> 'super_admin';
  update public.categories set network_id = terra_id where network_id is null;
  update public.products set network_id = terra_id where network_id is null;
  update public.inventories set network_id = terra_id where network_id is null;
  if to_regclass('public.write_offs') is not null then
    update public.write_offs set network_id = terra_id where network_id is null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'restaurants'
      and c.conname = 'restaurants_network_id_fkey'
  ) then
    alter table public.restaurants
      add constraint restaurants_network_id_fkey foreign key (network_id)
      references public.restaurant_networks(id) on delete restrict;
  end if;
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'users'
      and c.conname = 'users_network_id_fkey'
  ) then
    alter table public.users
      add constraint users_network_id_fkey foreign key (network_id)
      references public.restaurant_networks(id) on delete restrict;
  end if;
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'categories'
      and c.conname = 'categories_network_id_fkey'
  ) then
    alter table public.categories
      add constraint categories_network_id_fkey foreign key (network_id)
      references public.restaurant_networks(id) on delete restrict;
  end if;
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'products'
      and c.conname = 'products_network_id_fkey'
  ) then
    alter table public.products
      add constraint products_network_id_fkey foreign key (network_id)
      references public.restaurant_networks(id) on delete restrict;
  end if;
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'inventories'
      and c.conname = 'inventories_network_id_fkey'
  ) then
    alter table public.inventories
      add constraint inventories_network_id_fkey foreign key (network_id)
      references public.restaurant_networks(id) on delete restrict;
  end if;
  if to_regclass('public.write_offs') is not null and not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'write_offs'
      and c.conname = 'write_offs_network_id_fkey'
  ) then
    alter table public.write_offs
      add constraint write_offs_network_id_fkey foreign key (network_id)
      references public.restaurant_networks(id) on delete restrict;
  end if;
end $$;

alter table public.restaurants alter column network_id set not null;
alter table public.users alter column network_id drop not null;
alter table public.categories alter column network_id set not null;
alter table public.products alter column network_id set not null;
alter table public.inventories alter column network_id set not null;

alter table public.users drop constraint if exists users_network_required_check;
alter table public.users
  add constraint users_network_required_check
  check (coalesce(role = 'super_admin', false) or network_id is not null);

do $$
begin
  if to_regclass('public.write_offs') is not null then
    alter table public.write_offs alter column network_id set not null;
  end if;
end $$;

create index if not exists users_network_id_idx on public.users (network_id);
create index if not exists restaurants_network_id_idx on public.restaurants (network_id);
create index if not exists categories_network_id_idx on public.categories (network_id);
create index if not exists products_network_id_idx on public.products (network_id);
create index if not exists inventories_network_id_idx on public.inventories (network_id);

do $$
begin
  if to_regclass('public.write_offs') is not null then
    create index if not exists write_offs_network_id_idx on public.write_offs (network_id);
  end if;
end $$;

-- Tenant isolation for application data is enforced by authenticated server functions.
-- Those functions use the service_role connection and resolve network_id from public.users.
-- Client-provided network_id is only a filter for super_admin; it is never trusted for other roles.
-- Tenant RLS policies for the existing application tables are intentionally out of scope here.

alter table public.restaurant_networks enable row level security;
revoke all on public.restaurant_networks from anon, authenticated;
grant select, insert, update on public.restaurant_networks to service_role;

drop policy if exists "service restaurant_networks all" on public.restaurant_networks;
create policy "service restaurant_networks all" on public.restaurant_networks
  for all to service_role using (true) with check (true);

commit;
