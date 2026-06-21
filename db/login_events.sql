create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  login text not null,
  user_name text,
  role text,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  success boolean not null,
  failure_reason text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists login_events_created_at_idx
  on public.login_events (created_at desc);
create index if not exists login_events_success_created_at_idx
  on public.login_events (success, created_at desc);
create index if not exists login_events_role_created_at_idx
  on public.login_events (role, created_at desc);

alter table public.login_events enable row level security;

revoke all on public.login_events from anon, authenticated;
grant select, insert on public.login_events to service_role;

drop policy if exists "service login_events all" on public.login_events;
create policy "service login_events all" on public.login_events
  for all to service_role using (true) with check (true);
