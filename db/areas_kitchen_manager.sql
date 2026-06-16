alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('bartender', 'accountant', 'kitchen_manager'));

alter table public.products
  add column if not exists area text not null default 'bar';

update public.products
set area = 'bar'
where area is null;

alter table public.products
  drop constraint if exists products_area_check;

alter table public.products
  add constraint products_area_check
  check (area in ('bar', 'kitchen'));

alter table public.inventories
  add column if not exists area text not null default 'bar';

update public.inventories
set area = 'bar'
where area is null;

alter table public.inventories
  drop constraint if exists inventories_area_check;

alter table public.inventories
  add constraint inventories_area_check
  check (area in ('bar', 'kitchen'));
