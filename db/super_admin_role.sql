alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (role in ('bartender', 'accountant', 'kitchen_manager', 'manager', 'super_admin'));

-- Сначала убедитесь, что это нужная учётная запись Виктора:
select id, name, login, role
from public.users
where login = 'accountant';

-- Выполните отдельно только после проверки результата SELECT выше:
-- update public.users
-- set role = 'super_admin'
-- where login = 'accountant';
