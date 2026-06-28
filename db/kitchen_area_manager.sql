begin;

-- Safe to run again: constraints are replaced, rows are not changed or deleted.
alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check
  check (
    role in (
      'bartender',
      'accountant',
      'kitchen_manager',
      'manager',
      'bar_manager',
      'kitchen_area_manager',
      'super_admin'
    )
  );

alter table public.announcements
  drop constraint if exists announcements_audience_type_check;

alter table public.announcements
  add constraint announcements_audience_type_check
  check (audience_type in ('all_staff', 'restaurant', 'bar_staff', 'kitchen_staff'));

alter table public.announcements
  drop constraint if exists announcements_bar_staff_area_check;

alter table public.announcements
  add constraint announcements_bar_staff_area_check
  check (audience_type <> 'bar_staff' or target_area = 'bar');

alter table public.announcements
  drop constraint if exists announcements_kitchen_staff_area_check;

alter table public.announcements
  add constraint announcements_kitchen_staff_area_check
  check (audience_type <> 'kitchen_staff' or target_area = 'kitchen');

-- The browser has no direct table access. Tenant and area isolation remain enforced
-- by BarStock server functions using the service_role client.

commit;
