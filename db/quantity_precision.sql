begin;

alter table public.inventory_items
  alter column quantity type numeric using quantity::numeric;

alter table public.expected_items
  alter column quantity type numeric using quantity::numeric;

commit;
