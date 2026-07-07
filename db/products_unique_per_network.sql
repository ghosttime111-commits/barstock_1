begin;

-- Stop before changing the schema when the target uniqueness rule is already violated.
do $$
declare
  duplicate_group_count integer;
  duplicate_example text;
begin
  select
    count(*)::integer,
    min(
      format(
        'network_id=%s, area=%s, name=%s',
        coalesce(network_id::text, 'NULL'),
        coalesce(area, 'NULL'),
        normalized_name
      )
    )
  into duplicate_group_count, duplicate_example
  from (
    select
      network_id,
      area,
      lower(btrim(name)) as normalized_name
    from public.products
    group by network_id, area, lower(btrim(name))
    having count(*) > 1
  ) duplicates;

  if duplicate_group_count > 0 then
    raise exception using
      errcode = '23505',
      message = format(
        'Найдены дубли товаров по сети, зоне и нормализованному названию: %s групп(ы)',
        duplicate_group_count
      ),
      detail = format(
        'Пример: %s. Объедините или переименуйте дубли перед повторным запуском миграции.',
        duplicate_example
      );
  end if;
end $$;

-- Remove unique constraints whose only key is public.products.name.
-- Dropping a constraint also removes the index owned by that constraint.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select constraint_object.conname
    from pg_constraint constraint_object
    join pg_class table_object
      on table_object.oid = constraint_object.conrelid
    join pg_namespace table_schema
      on table_schema.oid = table_object.relnamespace
    join pg_attribute name_column
      on name_column.attrelid = table_object.oid
     and name_column.attname = 'name'
     and not name_column.attisdropped
    where table_schema.nspname = 'public'
      and table_object.relname = 'products'
      and constraint_object.contype = 'u'
      and array_length(constraint_object.conkey, 1) = 1
      and constraint_object.conkey[1] = name_column.attnum
  loop
    execute format(
      'alter table public.products drop constraint %I',
      constraint_row.conname
    );
  end loop;
end $$;

-- Remove standalone global unique indexes whose sole uniqueness key is name
-- (including expression indexes that depend only on the name column).
do $$
declare
  index_row record;
begin
  for index_row in
    select
      index_schema.nspname as schema_name,
      index_object.relname as index_name
    from pg_index index_metadata
    join pg_class table_object
      on table_object.oid = index_metadata.indrelid
    join pg_namespace table_schema
      on table_schema.oid = table_object.relnamespace
    join pg_class index_object
      on index_object.oid = index_metadata.indexrelid
    join pg_namespace index_schema
      on index_schema.oid = index_object.relnamespace
    join pg_attribute name_column
      on name_column.attrelid = table_object.oid
     and name_column.attname = 'name'
     and not name_column.attisdropped
    where table_schema.nspname = 'public'
      and table_object.relname = 'products'
      and index_metadata.indisunique
      and not index_metadata.indisprimary
      and index_metadata.indnkeyatts = 1
      and not exists (
        select 1
        from pg_constraint owning_constraint
        where owning_constraint.conindid = index_metadata.indexrelid
      )
      and (
        (
          index_metadata.indexprs is null
          and index_metadata.indkey[0] = name_column.attnum
        )
        or (
          index_metadata.indexprs is not null
          and exists (
            select 1
            from pg_depend name_dependency
            where name_dependency.classid = 'pg_class'::regclass
              and name_dependency.objid = index_metadata.indexrelid
              and name_dependency.refclassid = 'pg_class'::regclass
              and name_dependency.refobjid = table_object.oid
              and name_dependency.refobjsubid = name_column.attnum
          )
          and not exists (
            select 1
            from pg_depend other_dependency
            where other_dependency.classid = 'pg_class'::regclass
              and other_dependency.objid = index_metadata.indexrelid
              and other_dependency.refclassid = 'pg_class'::regclass
              and other_dependency.refobjid = table_object.oid
              and other_dependency.refobjsubid > 0
              and other_dependency.refobjsubid <> name_column.attnum
          )
        )
      )
  loop
    execute format(
      'drop index %I.%I',
      index_row.schema_name,
      index_row.index_name
    );
  end loop;
end $$;

-- IF NOT EXISTS must not silently accept an unrelated index with the target name.
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

  if target_index_oid is not null and not exists (
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
      'Индекс public.products_network_area_name_unique_idx уже существует, но имеет другую структуру';
  end if;
end $$;

create unique index if not exists products_network_area_name_unique_idx
on public.products (
  network_id,
  area,
  lower(btrim(name))
);

commit;
