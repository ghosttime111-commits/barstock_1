begin;

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
      'super_admin'
    )
  );

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.restaurant_networks(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 150),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  priority text not null default 'normal'
    check (priority in ('normal', 'important', 'urgent')),
  audience_type text not null default 'all_staff'
    check (audience_type in ('all_staff', 'restaurant', 'bar_staff')),
  target_restaurant_id uuid references public.restaurants(id) on delete cascade,
  target_area text check (target_area is null or target_area in ('bar', 'kitchen')),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  constraint announcements_restaurant_audience_check
    check (audience_type <> 'restaurant' or target_restaurant_id is not null),
  constraint announcements_bar_staff_area_check
    check (audience_type <> 'bar_staff' or target_area = 'bar')
);

create table if not exists public.announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  constraint announcement_reads_announcement_user_key unique (announcement_id, user_id)
);

create index if not exists announcements_network_id_idx
  on public.announcements (network_id);
create index if not exists announcements_created_at_idx
  on public.announcements (created_at desc);
create index if not exists announcements_target_restaurant_id_idx
  on public.announcements (target_restaurant_id);
create index if not exists announcement_reads_announcement_id_idx
  on public.announcement_reads (announcement_id);
create index if not exists announcement_reads_user_id_idx
  on public.announcement_reads (user_id);

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

revoke all on public.announcements from anon, authenticated;
revoke all on public.announcement_reads from anon, authenticated;
grant select, insert, update on public.announcements to service_role;
grant select, insert, update on public.announcement_reads to service_role;

drop policy if exists "service announcements all" on public.announcements;
create policy "service announcements all" on public.announcements
  for all to service_role using (true) with check (true);

drop policy if exists "service announcement_reads all" on public.announcement_reads;
create policy "service announcement_reads all" on public.announcement_reads
  for all to service_role using (true) with check (true);

-- Tenant and audience isolation are enforced by authenticated BarStock server functions.
-- The browser never supplies a trusted network_id for ordinary users.

commit;
