alter table public.categories
  add column if not exists area text not null default 'bar';

update public.categories
set area = 'bar'
where area is null;

alter table public.categories
  drop constraint if exists categories_area_check;

alter table public.categories
  add constraint categories_area_check
  check (area in ('bar', 'kitchen'));
