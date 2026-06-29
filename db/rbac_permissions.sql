begin;

create table if not exists public.app_roles (
  key text primary key,
  label text not null,
  network_scope text not null check (network_scope in ('own', 'all')),
  restaurant_scope text not null
    check (restaurant_scope in ('own', 'network', 'assigned_or_network')),
  area_scope text not null check (area_scope in ('bar', 'kitchen', 'all')),
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.app_permissions (
  key text primary key,
  group_key text not null,
  label text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_role_permissions (
  role_key text not null references public.app_roles(key) on delete cascade,
  permission_key text not null references public.app_permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

insert into public.app_roles (key, label, network_scope, restaurant_scope, area_scope)
values
  ('bartender', 'Бармен', 'own', 'own', 'bar'),
  ('kitchen_manager', 'Заведующий производством', 'own', 'own', 'kitchen'),
  ('accountant', 'Бухгалтер', 'own', 'network', 'all'),
  ('manager', 'Управляющий', 'own', 'assigned_or_network', 'all'),
  ('bar_manager', 'Бар-менеджер', 'own', 'network', 'bar'),
  ('kitchen_area_manager', 'Менеджер по кухне', 'own', 'network', 'kitchen'),
  ('super_admin', 'Администратор системы', 'all', 'network', 'all')
on conflict (key) do update set
  label = excluded.label,
  network_scope = excluded.network_scope,
  restaurant_scope = excluded.restaurant_scope,
  area_scope = excluded.area_scope,
  is_system = true;

insert into public.app_permissions (key, group_key, label, description)
values
  ('inventories.view', 'inventories', 'Просмотр переучётов', null),
  ('inventories.create', 'inventories', 'Создание переучётов', null),
  ('inventories.edit', 'inventories', 'Редактирование фактических остатков', null),
  ('inventories.close', 'inventories', 'Закрытие переучётов', null),
  ('inventories.reopen', 'inventories', 'Возврат переучёта на доработку', null),
  ('inventories.delete', 'inventories', 'Удаление переучётов', null),
  ('reports.view', 'reports', 'Просмотр отчётов', null),
  ('reports.list', 'reports', 'Просмотр списка отчётов', null),
  ('reports.view_in_progress', 'reports', 'Просмотр незавершённых отчётов', null),
  ('reports.edit_accounting', 'reports', 'Изменение бухгалтерских остатков и комментариев', null),
  ('reports.export', 'reports', 'Экспорт отчётов', null),
  ('statistics.view', 'statistics', 'Просмотр статистики', null),
  ('write_offs.view', 'write_offs', 'Просмотр списаний', null),
  ('write_offs.create', 'write_offs', 'Создание списаний', null),
  ('write_offs.export', 'write_offs', 'Экспорт списаний', null),
  ('transfers.view', 'transfers', 'Просмотр перемещений', null),
  ('transfers.create', 'transfers', 'Создание перемещений', null),
  ('transfers.confirm', 'transfers', 'Подтверждение перемещений', null),
  ('transfers.cancel', 'transfers', 'Отмена перемещений', null),
  ('announcements.view', 'announcements', 'Просмотр сообщений персоналу', null),
  ('announcements.create', 'announcements', 'Публикация сообщений персоналу', null),
  ('announcements.deactivate', 'announcements', 'Скрытие сообщений персоналу', null),
  ('staff.view', 'staff', 'Просмотр сотрудников', null),
  ('staff.directory', 'staff', 'Просмотр зонального справочника сотрудников', null),
  ('staff.create', 'staff', 'Создание сотрудников', null),
  ('staff.edit', 'staff', 'Редактирование сотрудников', null),
  ('staff.delete', 'staff', 'Удаление или отключение сотрудников', null),
  ('products.view', 'products', 'Просмотр товаров', null),
  ('products.manage', 'products', 'Управление товарами', null),
  ('categories.view', 'categories', 'Просмотр категорий', null),
  ('categories.manage', 'categories', 'Управление категориями', null),
  ('restaurants.view', 'restaurants', 'Просмотр ресторанов', null),
  ('restaurants.manage', 'restaurants', 'Управление ресторанами', null),
  ('networks.view', 'networks', 'Просмотр сетей', null),
  ('networks.manage', 'networks', 'Управление сетями', null),
  ('login_history.view', 'security', 'Просмотр журнала входов', null),
  ('roles.view', 'roles', 'Просмотр системных ролей', null),
  ('roles.assign', 'roles', 'Назначение разрешённых ролей', null),
  ('admin.access', 'admin', 'Доступ к административному разделу', null)
on conflict (key) do update set
  group_key = excluded.group_key,
  label = excluded.label,
  description = excluded.description;

with presets(role_key, permissions) as (
  values
    (
      'bartender',
      array[
        'inventories.view', 'inventories.create', 'inventories.edit', 'inventories.close',
        'write_offs.view', 'write_offs.create',
        'transfers.view', 'transfers.create', 'transfers.confirm', 'transfers.cancel',
        'announcements.view'
      ]::text[]
    ),
    (
      'kitchen_manager',
      array[
        'inventories.view', 'inventories.create', 'inventories.edit', 'inventories.close',
        'write_offs.view', 'write_offs.create',
        'transfers.view', 'transfers.create', 'transfers.confirm', 'transfers.cancel',
        'announcements.view'
      ]::text[]
    ),
    (
      'accountant',
      array[
        'inventories.reopen', 'inventories.delete',
        'reports.view', 'reports.list', 'reports.view_in_progress', 'reports.edit_accounting',
        'reports.export', 'statistics.view',
        'write_offs.view', 'write_offs.export', 'transfers.view', 'transfers.cancel',
        'announcements.view',
        'staff.view', 'staff.create', 'staff.edit', 'staff.delete',
        'products.view', 'products.manage', 'categories.view', 'categories.manage',
        'restaurants.view', 'restaurants.manage', 'roles.view', 'roles.assign', 'admin.access'
      ]::text[]
    ),
    (
      'manager',
      array[
        'reports.view', 'statistics.view', 'transfers.view', 'announcements.view'
      ]::text[]
    ),
    (
      'bar_manager',
      array[
        'reports.view', 'reports.view_in_progress', 'statistics.view',
        'write_offs.view', 'write_offs.export',
        'transfers.view', 'announcements.view', 'announcements.create',
        'announcements.deactivate', 'staff.view', 'staff.directory', 'restaurants.view'
      ]::text[]
    ),
    (
      'kitchen_area_manager',
      array[
        'reports.view', 'reports.view_in_progress', 'statistics.view',
        'write_offs.view', 'write_offs.export',
        'transfers.view', 'announcements.view', 'announcements.create',
        'announcements.deactivate', 'staff.view', 'staff.directory', 'restaurants.view'
      ]::text[]
    )
)
insert into public.app_role_permissions (role_key, permission_key)
select presets.role_key, permission_key
from presets
cross join lateral unnest(presets.permissions) as permission_key
on conflict (role_key, permission_key) do nothing;

insert into public.app_role_permissions (role_key, permission_key)
select 'super_admin', key from public.app_permissions
on conflict (role_key, permission_key) do nothing;

do $$
begin
  if exists (
    select 1
    from public.users u
    left join public.app_roles r on r.key = u.role
    where r.key is null
  ) then
    raise exception 'users contains a role missing from app_roles';
  end if;
end
$$;

alter table public.users drop constraint if exists users_role_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'users'
      and c.conname = 'users_role_app_roles_fkey'
  ) then
    alter table public.users
      add constraint users_role_app_roles_fkey
      foreign key (role) references public.app_roles(key);
  end if;
end
$$;

create index if not exists app_role_permissions_permission_key_idx
  on public.app_role_permissions (permission_key);

alter table public.app_roles enable row level security;
alter table public.app_permissions enable row level security;
alter table public.app_role_permissions enable row level security;

revoke all on public.app_roles from anon, authenticated;
revoke all on public.app_permissions from anon, authenticated;
revoke all on public.app_role_permissions from anon, authenticated;
grant select, insert, update, delete on public.app_roles to service_role;
grant select, insert, update, delete on public.app_permissions to service_role;
grant select, insert, update, delete on public.app_role_permissions to service_role;

drop policy if exists "service app_roles all" on public.app_roles;
create policy "service app_roles all" on public.app_roles
  for all to service_role using (true) with check (true);
drop policy if exists "service app_permissions all" on public.app_permissions;
create policy "service app_permissions all" on public.app_permissions
  for all to service_role using (true) with check (true);
drop policy if exists "service app_role_permissions all" on public.app_role_permissions;
create policy "service app_role_permissions all" on public.app_role_permissions
  for all to service_role using (true) with check (true);

commit;
