-- Сначала примените db/super_admin_role.sql, чтобы роль super_admin была разрешена constraint.
-- password_hash создан тем же PBKDF2-SHA256 алгоритмом, который использует BarStock.

insert into public.users (name, login, password_hash, role, restaurant_id, is_active)
values (
  'Виктор Админ',
  'admin',
  'pbkdf2$sha256$210000$vozzW_SbZXoOguqXTcVe3w$dgA6-eNsgnbrZMhiH7jmnmnNgHPgNQNIWynAp7PXg3k',
  'super_admin',
  null,
  true
)
on conflict (login) do update set
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = 'super_admin',
  restaurant_id = null,
  is_active = true;
