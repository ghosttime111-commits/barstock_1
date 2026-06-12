alter table public.users
add column if not exists is_active boolean not null default true;

update public.users
set is_active = true
where is_active is null;
