begin;

-- BarStock tenant isolation is enforced by server functions with service_role.
-- Browser roles must not be able to call this RPC directly.
-- This migration intentionally does not repair prerequisite schema.
-- Apply db/categories_unique_per_network.sql and db/products_unique_per_network.sql first.
do $$
declare
  target_index_oid oid;
begin
  select index_object.oid
  into target_index_oid
  from pg_class index_object
  join pg_namespace index_schema
    on index_schema.oid = index_object.relnamespace
  where index_schema.nspname = 'public'
    and index_object.relname = 'categories_network_area_name_unique_idx';

  if target_index_oid is null then
    raise exception
      'Required index public.categories_network_area_name_unique_idx is missing. Apply db/categories_unique_per_network.sql first.';
  end if;

  if not exists (
    select 1
    from pg_index index_metadata
    join pg_attribute network_column
      on network_column.attrelid = index_metadata.indrelid
     and network_column.attname = 'network_id'
     and not network_column.attisdropped
    join pg_attribute area_column
      on area_column.attrelid = index_metadata.indrelid
     and area_column.attname = 'area'
     and not area_column.attisdropped
    where index_metadata.indexrelid = target_index_oid
      and index_metadata.indrelid = 'public.categories'::regclass
      and index_metadata.indisunique
      and not index_metadata.indisprimary
      and index_metadata.indnkeyatts = 3
      and index_metadata.indkey[0] = network_column.attnum
      and index_metadata.indkey[1] = area_column.attnum
      and index_metadata.indkey[2] = 0
      and index_metadata.indpred is null
      and regexp_replace(
        pg_get_expr(index_metadata.indexprs, index_metadata.indrelid),
        '\s+',
        '',
        'g'
      ) = 'lower(btrim(name))'
  ) then
    raise exception
      'Required index public.categories_network_area_name_unique_idx has an unexpected structure.';
  end if;
end $$;

do $$
declare
  target_index_oid oid;
begin
  select index_object.oid
  into target_index_oid
  from pg_class index_object
  join pg_namespace index_schema
    on index_schema.oid = index_object.relnamespace
  where index_schema.nspname = 'public'
    and index_object.relname = 'products_network_area_name_unique_idx';

  if target_index_oid is null then
    raise exception
      'Required index public.products_network_area_name_unique_idx is missing. Apply db/products_unique_per_network.sql first.';
  end if;

  if not exists (
    select 1
    from pg_index index_metadata
    join pg_attribute network_column
      on network_column.attrelid = index_metadata.indrelid
     and network_column.attname = 'network_id'
     and not network_column.attisdropped
    join pg_attribute area_column
      on area_column.attrelid = index_metadata.indrelid
     and area_column.attname = 'area'
     and not area_column.attisdropped
    where index_metadata.indexrelid = target_index_oid
      and index_metadata.indrelid = 'public.products'::regclass
      and index_metadata.indisunique
      and not index_metadata.indisprimary
      and index_metadata.indnkeyatts = 3
      and index_metadata.indkey[0] = network_column.attnum
      and index_metadata.indkey[1] = area_column.attnum
      and index_metadata.indkey[2] = 0
      and index_metadata.indpred is null
      and regexp_replace(
        pg_get_expr(index_metadata.indexprs, index_metadata.indrelid),
        '\s+',
        '',
        'g'
      ) = 'lower(btrim(name))'
  ) then
    raise exception
      'Required index public.products_network_area_name_unique_idx has an unexpected structure.';
  end if;
end $$;

create or replace function public.import_catalog_batch(
  p_network_id uuid,
  p_categories jsonb,
  p_products jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  category_count integer;
  product_count integer;
  duplicate_count integer;
  created_categories_json jsonb;
  created_products_json jsonb;
  skipped_products_json jsonb;
begin
  if p_network_id is null then
    raise exception 'network_id is required';
  end if;

  p_categories := coalesce(p_categories, '[]'::jsonb);
  p_products := coalesce(p_products, '[]'::jsonb);

  if jsonb_typeof(p_categories) is distinct from 'array' then
    raise exception 'categories must be a JSON array';
  end if;

  if jsonb_typeof(p_products) is distinct from 'array' then
    raise exception 'products must be a JSON array';
  end if;

  category_count := jsonb_array_length(p_categories);
  product_count := jsonb_array_length(p_products);

  if category_count > 500 then
    raise exception 'categories batch is too large';
  end if;

  if product_count > 2000 then
    raise exception 'products batch is too large';
  end if;

  if category_count = 0 and product_count = 0 then
    raise exception 'nothing to import';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_network_id::text, 0));

  drop table if exists pg_temp.catalog_import_categories;
  drop table if exists pg_temp.catalog_import_products;
  drop table if exists pg_temp.catalog_import_created_categories;
  drop table if exists pg_temp.catalog_import_created_products;
  drop table if exists pg_temp.catalog_import_skipped_products;
  drop table if exists pg_temp.catalog_import_category_map;

  create temporary table pg_temp.catalog_import_categories (
    name text not null,
    area text not null
  ) on commit drop;

  create temporary table pg_temp.catalog_import_products (
    name text not null,
    category_name text not null,
    area text not null,
    unit text not null,
    status text not null,
    unit_price numeric not null
  ) on commit drop;

  create temporary table pg_temp.catalog_import_created_categories (
    id uuid not null,
    name text not null,
    area text not null,
    network_id uuid not null
  ) on commit drop;

  create temporary table pg_temp.catalog_import_created_products (
    id uuid not null,
    name text not null,
    category_id uuid not null,
    unit text not null,
    status text not null,
    unit_price numeric not null,
    area text not null,
    network_id uuid not null
  ) on commit drop;

  create temporary table pg_temp.catalog_import_skipped_products (
    name text not null,
    area text not null,
    reason text not null
  ) on commit drop;

  insert into pg_temp.catalog_import_categories (name, area)
  select btrim(input.name), input.area
  from jsonb_to_recordset(p_categories) as input(name text, area text);

  if exists (
    select 1
    from pg_temp.catalog_import_categories as category
    where category.name is null
       or length(btrim(category.name)) < 1
       or length(btrim(category.name)) > 160
       or category.area not in ('bar', 'kitchen')
  ) then
    raise exception 'one or more categories contain invalid values';
  end if;

  select count(*)::integer
  into duplicate_count
  from (
    select area, lower(btrim(name))
    from pg_temp.catalog_import_categories
    group by area, lower(btrim(name))
    having count(*) > 1
  ) duplicates;

  if duplicate_count > 0 then
    raise exception 'duplicate categories are not allowed';
  end if;

  insert into pg_temp.catalog_import_products (
    name,
    category_name,
    area,
    unit,
    status,
    unit_price
  )
  select
    btrim(input.name),
    btrim(input.category_name),
    input.area,
    input.unit,
    coalesce(nullif(input.status, ''), 'approved'),
    input.unit_price
  from jsonb_to_recordset(p_products) as input(
    name text,
    category_name text,
    area text,
    unit text,
    status text,
    unit_price numeric
  );

  if exists (
    select 1
    from pg_temp.catalog_import_products as product
    where product.name is null
       or length(btrim(product.name)) < 1
       or length(btrim(product.name)) > 200
       or product.category_name is null
       or length(btrim(product.category_name)) < 1
       or length(btrim(product.category_name)) > 160
       or product.area not in ('bar', 'kitchen')
       or product.unit not in ('л', 'кг', 'шт', 'бут')
       or product.status not in ('approved', 'pending', 'archived')
       or product.unit_price is null
       or product.unit_price < 0
       or product.unit_price > 1000000
  ) then
    raise exception 'one or more products contain invalid values';
  end if;

  select count(*)::integer
  into duplicate_count
  from (
    select area, lower(btrim(name))
    from pg_temp.catalog_import_products
    group by area, lower(btrim(name))
    having count(*) > 1
  ) duplicates;

  if duplicate_count > 0 then
    raise exception 'duplicate products are not allowed';
  end if;

  with inserted as (
    insert into public.categories (name, area, network_id)
    select category.name, category.area, p_network_id
    from pg_temp.catalog_import_categories as category
    where not exists (
      select 1
      from public.categories as existing
      where existing.network_id = p_network_id
        and existing.area = category.area
        and lower(btrim(existing.name)) = lower(btrim(category.name))
    )
    on conflict (network_id, area, (lower(btrim(name)))) do nothing
    returning id, name, area, network_id
  )
  insert into pg_temp.catalog_import_created_categories (id, name, area, network_id)
  select inserted.id, inserted.name, inserted.area, inserted.network_id
  from inserted;

  create temporary table pg_temp.catalog_import_category_map on commit drop as
  select
    category.id,
    category.name,
    category.area,
    category.network_id,
    lower(btrim(category.name)) as normalized_name
  from public.categories as category
  where category.network_id = p_network_id
    and (
      exists (
        select 1
        from pg_temp.catalog_import_categories as input_category
        where input_category.area = category.area
          and lower(btrim(input_category.name)) = lower(btrim(category.name))
      )
      or exists (
        select 1
        from pg_temp.catalog_import_products as input_product
        where input_product.area = category.area
          and lower(btrim(input_product.category_name)) = lower(btrim(category.name))
      )
    );

  if exists (
    select 1
    from pg_temp.catalog_import_products as product
    where not exists (
      select 1
      from pg_temp.catalog_import_category_map as category
      where category.area = product.area
        and category.normalized_name = lower(btrim(product.category_name))
    )
  ) then
    if exists (
      select 1
      from pg_temp.catalog_import_products as product
      where exists (
        select 1
        from pg_temp.catalog_import_category_map as category
        where category.normalized_name = lower(btrim(product.category_name))
          and category.area <> product.area
      )
    ) then
      raise exception 'product category area mismatch';
    end if;

    raise exception 'product category does not exist';
  end if;

  insert into pg_temp.catalog_import_skipped_products (name, area, reason)
  select product.name, product.area, 'existing_product'
  from pg_temp.catalog_import_products as product
  where exists (
    select 1
    from public.products as existing
    where existing.network_id = p_network_id
      and existing.area = product.area
      and lower(btrim(existing.name)) = lower(btrim(product.name))
  );

  with input_products as (
    select
      product.name,
      category.id as category_id,
      product.unit,
      product.status,
      product.unit_price,
      product.area
    from pg_temp.catalog_import_products as product
    join pg_temp.catalog_import_category_map as category
      on category.area = product.area
     and category.normalized_name = lower(btrim(product.category_name))
    where not exists (
      select 1
      from public.products as existing
      where existing.network_id = p_network_id
        and existing.area = product.area
        and lower(btrim(existing.name)) = lower(btrim(product.name))
    )
  ),
  inserted as (
    insert into public.products (
      name,
      category_id,
      unit,
      status,
      unit_price,
      area,
      network_id
    )
    select
      input_products.name,
      input_products.category_id,
      input_products.unit,
      input_products.status,
      input_products.unit_price,
      input_products.area,
      p_network_id
    from input_products
    on conflict (network_id, area, (lower(btrim(name)))) do nothing
    returning id, name, category_id, unit, status, unit_price, area, network_id
  )
  insert into pg_temp.catalog_import_created_products (
    id,
    name,
    category_id,
    unit,
    status,
    unit_price,
    area,
    network_id
  )
  select
    inserted.id,
    inserted.name,
    inserted.category_id,
    inserted.unit,
    inserted.status,
    inserted.unit_price,
    inserted.area,
    inserted.network_id
  from inserted;

  select coalesce(jsonb_agg(to_jsonb(category) order by category.name), '[]'::jsonb)
  into created_categories_json
  from pg_temp.catalog_import_created_categories as category;

  select coalesce(jsonb_agg(to_jsonb(product) order by product.name), '[]'::jsonb)
  into created_products_json
  from pg_temp.catalog_import_created_products as product;

  select coalesce(jsonb_agg(to_jsonb(product) order by product.name), '[]'::jsonb)
  into skipped_products_json
  from pg_temp.catalog_import_skipped_products as product;

  return jsonb_build_object(
    'created_categories',
    created_categories_json,
    'created_products',
    created_products_json,
    'skipped_products',
    skipped_products_json,
    'counts',
    jsonb_build_object(
      'created_categories',
      (select count(*) from pg_temp.catalog_import_created_categories),
      'created_products',
      (select count(*) from pg_temp.catalog_import_created_products),
      'skipped_products',
      (select count(*) from pg_temp.catalog_import_skipped_products)
    )
  );
end;
$$;

revoke all on function public.import_catalog_batch(uuid, jsonb, jsonb) from public;
revoke all on function public.import_catalog_batch(uuid, jsonb, jsonb) from anon;
revoke all on function public.import_catalog_batch(uuid, jsonb, jsonb) from authenticated;
grant execute on function public.import_catalog_batch(uuid, jsonb, jsonb) to service_role;

comment on function public.import_catalog_batch(uuid, jsonb, jsonb) is
  'Atomically imports validated BarStock categories and new products for one restaurant network. Tenant authorization is enforced by server functions.';

commit;
