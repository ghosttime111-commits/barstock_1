-- BarStock uses service-role server functions for tenant isolation.
-- This RPC is not callable by browser roles and does not accept network_id.
create or replace function public.update_products_batch(p_products jsonb)
returns table (
  id uuid,
  name text,
  category_id uuid,
  unit text,
  status text,
  unit_price numeric,
  area text,
  network_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  product_count integer;
  updated_count integer;
begin
  if jsonb_typeof(p_products) is distinct from 'array' then
    raise exception 'products must be a JSON array';
  end if;

  product_count := jsonb_array_length(p_products);
  if product_count < 1 or product_count > 100 then
    raise exception 'products batch must contain between 1 and 100 items';
  end if;

  if (
    select count(*) <> count(distinct input.id)
    from jsonb_to_recordset(p_products) as input(
      id uuid,
      name text,
      category_id uuid,
      unit text,
      status text,
      unit_price numeric,
      area text
    )
  ) then
    raise exception 'duplicate product ids are not allowed';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_products) as input(
      id uuid,
      name text,
      category_id uuid,
      unit text,
      status text,
      unit_price numeric,
      area text
    )
    where input.id is null
       or input.category_id is null
       or input.name is null
       or length(btrim(input.name)) < 1
       or length(btrim(input.name)) > 200
       or input.unit not in ('л', 'кг', 'шт', 'бут')
       or input.status not in ('approved', 'pending', 'archived')
       or input.unit_price is null
       or input.unit_price < 0
       or input.unit_price > 1000000
       or input.area not in ('bar', 'kitchen')
  ) then
    raise exception 'one or more products contain invalid values';
  end if;

  -- Lock rows in a stable order so they cannot be changed or deleted between
  -- validation and the batch update.
  perform product.id
  from public.products as product
  join jsonb_to_recordset(p_products) as input(
    id uuid,
    name text,
    category_id uuid,
    unit text,
    status text,
    unit_price numeric,
    area text
  ) on product.id = input.id
  order by product.id
  for update of product;

  if (
    select count(*)
    from jsonb_to_recordset(p_products) as input(
      id uuid,
      name text,
      category_id uuid,
      unit text,
      status text,
      unit_price numeric,
      area text
    )
    join public.products as product on product.id = input.id
  ) <> product_count then
    raise exception 'one or more products do not exist';
  end if;

  perform category.id
  from public.categories as category
  join (
    select distinct input.category_id
    from jsonb_to_recordset(p_products) as input(
      id uuid,
      name text,
      category_id uuid,
      unit text,
      status text,
      unit_price numeric,
      area text
    )
  ) as requested_category on requested_category.category_id = category.id
  order by category.id
  for share of category;

  if exists (
    select 1
    from jsonb_to_recordset(p_products) as input(
      id uuid,
      name text,
      category_id uuid,
      unit text,
      status text,
      unit_price numeric,
      area text
    )
    join public.products as product on product.id = input.id
    left join public.categories as category on category.id = input.category_id
    where category.id is null
       or category.network_id is distinct from product.network_id
       or coalesce(category.area, 'bar') <> input.area
  ) then
    raise exception 'product category must exist in the same network and area';
  end if;

  return query
  with input as (
    select *
    from jsonb_to_recordset(p_products) as item(
      id uuid,
      name text,
      category_id uuid,
      unit text,
      status text,
      unit_price numeric,
      area text
    )
  ),
  updated as (
    update public.products as product
    set
      name = btrim(input.name),
      category_id = input.category_id,
      unit = input.unit,
      status = input.status,
      unit_price = input.unit_price,
      area = input.area
    from input
    where product.id = input.id
    returning
      product.id,
      product.name,
      product.category_id,
      product.unit,
      product.status,
      product.unit_price,
      product.area,
      product.network_id
  )
  select
    updated.id,
    updated.name,
    updated.category_id,
    updated.unit,
    updated.status,
    updated.unit_price,
    updated.area,
    updated.network_id
  from updated
  order by updated.name;

  get diagnostics updated_count = row_count;
  if updated_count <> product_count then
    raise exception 'not all products were updated';
  end if;
end;
$$;

revoke all on function public.update_products_batch(jsonb) from public;
revoke all on function public.update_products_batch(jsonb) from anon;
revoke all on function public.update_products_batch(jsonb) from authenticated;
grant execute on function public.update_products_batch(jsonb) to service_role;

comment on function public.update_products_batch(jsonb) is
  'Atomically updates validated BarStock products. Tenant authorization is enforced by the server function.';
