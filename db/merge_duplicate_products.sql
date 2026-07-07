begin;

-- Merge archived duplicate products into the approved product before creating
-- products_network_area_name_unique_idx.
--
-- Duplicate identity:
--   network_id, area, lower(btrim(name))
--
-- The approved product is the canonical row. Archived rows in the same group are
-- deleted only after all known product references have been moved to the
-- approved product. Product attributes on the approved row are never updated.

lock table public.products in share row exclusive mode;

do $$
begin
  if to_regclass('public.inventory_items') is not null then
    execute 'lock table public.inventory_items in share row exclusive mode';
  end if;
  if to_regclass('public.inventory_item_entries') is not null then
    execute 'lock table public.inventory_item_entries in share row exclusive mode';
  end if;
  if to_regclass('public.expected_items') is not null then
    execute 'lock table public.expected_items in share row exclusive mode';
  end if;
  if to_regclass('public.write_offs') is not null then
    execute 'lock table public.write_offs in share row exclusive mode';
  end if;
  if to_regclass('public.stock_transfers') is not null then
    execute 'lock table public.stock_transfers in share row exclusive mode';
  end if;
end $$;

create temporary table product_duplicate_groups on commit drop as
select
  product.network_id,
  product.area,
  lower(btrim(product.name)) as normalized_name,
  count(*)::integer as product_count,
  count(*) filter (where product.status = 'approved')::integer as approved_count,
  count(*) filter (where product.status = 'archived')::integer as archived_count,
  count(*) filter (
    where product.status not in ('approved', 'archived')
  )::integer as other_status_count
from public.products as product
group by product.network_id, product.area, lower(btrim(product.name))
having count(*) > 1;

-- Re-running after duplicates are already merged is a no-op.
do $$
declare
  invalid_group_count integer;
  invalid_group_example text;
begin
  select
    count(*)::integer,
    min(
      format(
        'network_id=%s, area=%s, name=%s, approved=%s, archived=%s, other=%s',
        coalesce(network_id::text, 'NULL'),
        coalesce(area, 'NULL'),
        normalized_name,
        approved_count,
        archived_count,
        other_status_count
      )
    )
  into invalid_group_count, invalid_group_example
  from product_duplicate_groups
  where network_id is null
     or area is null
     or approved_count <> 1
     or archived_count <> product_count - 1
     or other_status_count <> 0;

  if invalid_group_count > 0 then
    raise exception using
      message = format(
        'Нельзя объединить дубли товаров: найдены группы не вида 1 approved + archived: %s',
        invalid_group_count
      ),
      detail = format(
        'Пример: %s. Исправьте статусы вручную и повторите миграцию.',
        invalid_group_example
      );
  end if;
end $$;

create temporary table product_duplicate_merge_map (
  keep_product_id uuid not null,
  duplicate_product_id uuid not null,
  network_id uuid not null,
  area text not null,
  normalized_name text not null,
  primary key (duplicate_product_id)
) on commit drop;

insert into product_duplicate_merge_map (
  keep_product_id,
  duplicate_product_id,
  network_id,
  area,
  normalized_name
)
select
  approved_product.id as keep_product_id,
  archived_product.id as duplicate_product_id,
  duplicate_group.network_id,
  duplicate_group.area,
  duplicate_group.normalized_name
from product_duplicate_groups as duplicate_group
join public.products as approved_product
  on approved_product.network_id = duplicate_group.network_id
 and approved_product.area = duplicate_group.area
 and lower(btrim(approved_product.name)) = duplicate_group.normalized_name
 and approved_product.status = 'approved'
join public.products as archived_product
  on archived_product.network_id = duplicate_group.network_id
 and archived_product.area = duplicate_group.area
 and lower(btrim(archived_product.name)) = duplicate_group.normalized_name
 and archived_product.status = 'archived';

-- inventory_items and expected_items have composite primary keys
-- (inventory_id, product_id). Updating a duplicate product to the approved
-- product would violate the PK when the same inventory already contains the
-- approved product or another duplicate from the same group. Stop instead of
-- merging quantities automatically.
--
-- There is one safe inventory_items normalization before the strict check:
-- when several duplicate product rows for the same inventory would collapse into
-- the same approved product and every affected duplicate quantity is exactly 0,
-- keeping one zero row or the existing approved row preserves the factual stock
-- value. We still never sum quantities, never delete non-zero rows, and never
-- update the approved product itself.
do $$
declare
  conflict_count integer;
  conflict_example text;
begin
  if to_regclass('public.inventory_items') is not null then
    with affected_duplicate_rows as (
      select
        inventory_item.inventory_id,
        merge_map.keep_product_id,
        inventory_item.product_id as duplicate_product_id,
        inventory_item.quantity
      from public.inventory_items as inventory_item
      join product_duplicate_merge_map as merge_map
        on merge_map.duplicate_product_id = inventory_item.product_id
    ),
    affected_groups as (
      select
        affected.inventory_id,
        affected.keep_product_id,
        count(*)::integer as duplicate_count,
        bool_or(affected.quantity <> 0) as has_non_zero_quantity,
        exists (
          select 1
          from public.inventory_items as keep_item
          where keep_item.inventory_id = affected.inventory_id
            and keep_item.product_id = affected.keep_product_id
        ) as has_keep_product_row
      from affected_duplicate_rows as affected
      group by affected.inventory_id, affected.keep_product_id
    ),
    unsafe_groups as (
      select inventory_id, keep_product_id
      from affected_groups
      where (duplicate_count > 1 or has_keep_product_row)
        and has_non_zero_quantity
    )
    select
      count(*)::integer,
      min(format('inventory_id=%s, keep_product_id=%s', inventory_id, keep_product_id))
    into conflict_count, conflict_example
    from unsafe_groups;

    if conflict_count > 0 then
      raise exception using
        message = format(
          'Нельзя схлопнуть inventory_items: найдены ненулевые duplicate-строки: %s',
          conflict_count
        ),
        detail = format(
          'Пример: %s. Объедините количество вручную перед повторным запуском.',
          conflict_example
        );
    end if;

    with affected_duplicate_rows as (
      select
        inventory_item.inventory_id,
        merge_map.keep_product_id,
        inventory_item.product_id as duplicate_product_id,
        inventory_item.quantity
      from public.inventory_items as inventory_item
      join product_duplicate_merge_map as merge_map
        on merge_map.duplicate_product_id = inventory_item.product_id
    ),
    ranked_zero_duplicates as (
      select
        affected.inventory_id,
        affected.keep_product_id,
        affected.duplicate_product_id,
        row_number() over (
          partition by affected.inventory_id, affected.keep_product_id
          order by affected.duplicate_product_id
        ) as duplicate_rank,
        count(*) over (
          partition by affected.inventory_id, affected.keep_product_id
        ) as duplicate_count,
        bool_or(affected.quantity <> 0) over (
          partition by affected.inventory_id, affected.keep_product_id
        ) as has_non_zero_quantity,
        exists (
          select 1
          from public.inventory_items as keep_item
          where keep_item.inventory_id = affected.inventory_id
            and keep_item.product_id = affected.keep_product_id
        ) as has_keep_product_row
      from affected_duplicate_rows as affected
    ),
    zero_duplicates_to_delete as (
      select
        inventory_id,
        duplicate_product_id
      from ranked_zero_duplicates
      where not has_non_zero_quantity
        and (has_keep_product_row or duplicate_count > 1)
        and (has_keep_product_row or duplicate_rank > 1)
    )
    delete from public.inventory_items as inventory_item
    using zero_duplicates_to_delete as duplicate
    where inventory_item.inventory_id = duplicate.inventory_id
      and inventory_item.product_id = duplicate.duplicate_product_id;
  end if;
end $$;

do $$
declare
  conflict_count integer;
  conflict_example text;
begin
  if to_regclass('public.inventory_items') is not null then
    with affected_duplicate_rows as (
      select
        inventory_item.inventory_id,
        merge_map.keep_product_id,
        inventory_item.product_id
      from public.inventory_items as inventory_item
      join product_duplicate_merge_map as merge_map
        on merge_map.duplicate_product_id = inventory_item.product_id
    ),
    affected_target_rows as (
      select
        keep_item.inventory_id,
        keep_item.product_id as keep_product_id,
        keep_item.product_id
      from public.inventory_items as keep_item
      join (
        select distinct inventory_id, keep_product_id
        from affected_duplicate_rows
      ) as affected
        on affected.inventory_id = keep_item.inventory_id
       and affected.keep_product_id = keep_item.product_id
    ),
    conflicts as (
      select inventory_id, keep_product_id, count(*) as row_count
      from (
        select inventory_id, keep_product_id, product_id
        from affected_duplicate_rows
        union all
        select inventory_id, keep_product_id, product_id
        from affected_target_rows
      ) as rows_to_merge
      group by inventory_id, keep_product_id
      having count(*) > 1
    )
    select
      count(*)::integer,
      min(format('inventory_id=%s, keep_product_id=%s', inventory_id, keep_product_id))
    into conflict_count, conflict_example
    from conflicts;

    if conflict_count > 0 then
      raise exception using
        message = format(
          'Нельзя объединить inventory_items: найдены PK-конфликты: %s',
          conflict_count
        ),
        detail = format(
          'Пример: %s. Объедините количество вручную перед повторным запуском.',
          conflict_example
        );
    end if;
  end if;

  if to_regclass('public.expected_items') is not null then
    with affected_duplicate_rows as (
      select
        expected_item.inventory_id,
        merge_map.keep_product_id,
        expected_item.product_id
      from public.expected_items as expected_item
      join product_duplicate_merge_map as merge_map
        on merge_map.duplicate_product_id = expected_item.product_id
    ),
    affected_target_rows as (
      select
        keep_item.inventory_id,
        keep_item.product_id as keep_product_id,
        keep_item.product_id
      from public.expected_items as keep_item
      join (
        select distinct inventory_id, keep_product_id
        from affected_duplicate_rows
      ) as affected
        on affected.inventory_id = keep_item.inventory_id
       and affected.keep_product_id = keep_item.product_id
    ),
    conflicts as (
      select inventory_id, keep_product_id, count(*) as row_count
      from (
        select inventory_id, keep_product_id, product_id
        from affected_duplicate_rows
        union all
        select inventory_id, keep_product_id, product_id
        from affected_target_rows
      ) as rows_to_merge
      group by inventory_id, keep_product_id
      having count(*) > 1
    )
    select
      count(*)::integer,
      min(format('inventory_id=%s, keep_product_id=%s', inventory_id, keep_product_id))
    into conflict_count, conflict_example
    from conflicts;

    if conflict_count > 0 then
      raise exception using
        message = format(
          'Нельзя объединить expected_items: найдены PK-конфликты: %s',
          conflict_count
        ),
        detail = format(
          'Пример: %s. Объедините количество вручную перед повторным запуском.',
          conflict_example
        );
    end if;
  end if;
end $$;

-- Move historical references to the approved product. This keeps old inventory
-- and write-off history attached to the canonical product instead of losing it.
do $$
begin
  if to_regclass('public.inventory_items') is not null then
    update public.inventory_items as inventory_item
    set product_id = merge_map.keep_product_id
    from product_duplicate_merge_map as merge_map
    where inventory_item.product_id = merge_map.duplicate_product_id;
  end if;

  if to_regclass('public.inventory_item_entries') is not null then
    update public.inventory_item_entries as entry
    set product_id = merge_map.keep_product_id
    from product_duplicate_merge_map as merge_map
    where entry.product_id = merge_map.duplicate_product_id;
  end if;

  if to_regclass('public.expected_items') is not null then
    update public.expected_items as expected_item
    set product_id = merge_map.keep_product_id
    from product_duplicate_merge_map as merge_map
    where expected_item.product_id = merge_map.duplicate_product_id;
  end if;

  if to_regclass('public.write_offs') is not null then
    update public.write_offs as write_off
    set product_id = merge_map.keep_product_id
    from product_duplicate_merge_map as merge_map
    where write_off.product_id = merge_map.duplicate_product_id;
  end if;

  if to_regclass('public.stock_transfers') is not null then
    update public.stock_transfers as transfer
    set product_id = merge_map.keep_product_id
    from product_duplicate_merge_map as merge_map
    where transfer.product_id = merge_map.duplicate_product_id;
  end if;
end $$;

-- Ensure no known references still point at rows that are about to be deleted.
do $$
declare
  dangling_count integer := 0;
begin
  if to_regclass('public.inventory_items') is not null then
    select count(*)::integer
    into dangling_count
    from public.inventory_items as inventory_item
    join product_duplicate_merge_map as merge_map
      on merge_map.duplicate_product_id = inventory_item.product_id;

    if dangling_count > 0 then
      raise exception 'После переноса ссылок inventory_items всё ещё содержит duplicate_product_id';
    end if;
  end if;

  if to_regclass('public.inventory_item_entries') is not null then
    select count(*)::integer
    into dangling_count
    from public.inventory_item_entries as entry
    join product_duplicate_merge_map as merge_map
      on merge_map.duplicate_product_id = entry.product_id;

    if dangling_count > 0 then
      raise exception 'После переноса ссылок inventory_item_entries всё ещё содержит duplicate_product_id';
    end if;
  end if;

  if to_regclass('public.expected_items') is not null then
    select count(*)::integer
    into dangling_count
    from public.expected_items as expected_item
    join product_duplicate_merge_map as merge_map
      on merge_map.duplicate_product_id = expected_item.product_id;

    if dangling_count > 0 then
      raise exception 'После переноса ссылок expected_items всё ещё содержит duplicate_product_id';
    end if;
  end if;

  if to_regclass('public.write_offs') is not null then
    select count(*)::integer
    into dangling_count
    from public.write_offs as write_off
    join product_duplicate_merge_map as merge_map
      on merge_map.duplicate_product_id = write_off.product_id;

    if dangling_count > 0 then
      raise exception 'После переноса ссылок write_offs всё ещё содержит duplicate_product_id';
    end if;
  end if;

  if to_regclass('public.stock_transfers') is not null then
    select count(*)::integer
    into dangling_count
    from public.stock_transfers as transfer
    join product_duplicate_merge_map as merge_map
      on merge_map.duplicate_product_id = transfer.product_id;

    if dangling_count > 0 then
      raise exception 'После переноса ссылок stock_transfers всё ещё содержит duplicate_product_id';
    end if;
  end if;
end $$;

delete from public.products as product
using product_duplicate_merge_map as merge_map
where product.id = merge_map.duplicate_product_id
  and product.status = 'archived';

-- Approved products must remain. Archived duplicates from the merge map must be gone.
do $$
declare
  remaining_duplicate_count integer;
begin
  select count(*)::integer
  into remaining_duplicate_count
  from public.products as product
  join product_duplicate_merge_map as merge_map
    on merge_map.duplicate_product_id = product.id;

  if remaining_duplicate_count > 0 then
    raise exception
      'Не все archived-дубли товаров были удалены. Миграция откатывается.';
  end if;
end $$;

-- Final guard: after the merge, the future unique index rule must already hold.
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
      message = format(
        'После объединения всё ещё есть дубли товаров: %s групп(ы)',
        duplicate_group_count
      ),
      detail = format(
        'Пример: %s. Миграция откатывается.',
        duplicate_example
      );
  end if;
end $$;

commit;
