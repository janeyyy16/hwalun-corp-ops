-- Run this once in the Supabase SQL editor (same project as hwa-lun-corporation).

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null
);

insert into roles (key, label) values
  ('super_admin', 'Super Admin'),
  ('hr', 'HR'),
  ('admin', 'Admin'),
  ('accounting_finance', 'Accounting & Finance')
on conflict (key) do nothing;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role_id uuid not null references roles(id),
  created_at timestamptz not null default now()
);

alter table roles enable row level security;
alter table profiles enable row level security;

-- Reads the caller's own role without the policy recursing into itself.
create or replace function current_role_key()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select r.key
  from profiles p
  join roles r on r.id = p.role_id
  where p.id = auth.uid()
$$;

create policy "authenticated can read roles"
  on roles for select
  to authenticated
  using (true);

create policy "users can read own profile"
  on profiles for select
  to authenticated
  using (id = auth.uid());

create policy "hr and super admin can read all profiles"
  on profiles for select
  to authenticated
  using (current_role_key() in ('super_admin', 'hr'));

-- No insert/update/delete policies on purpose: employee accounts are only
-- ever created through the Worker's /api/employees route, which uses the
-- Supabase service-role key (bypasses RLS) after checking the caller's role.

-- ── One-time bootstrap: create the first Super Admin ──
-- 1. Supabase Dashboard → Authentication → Users → Add user
--    Email: <your email>, Password: hwalun2026!, Auto Confirm User: yes
-- 2. Run the statement below, replacing the email with the one used above:
--
-- insert into profiles (id, full_name, email, role_id)
-- select u.id, 'Super Admin', u.email, r.id
-- from auth.users u, roles r
-- where u.email = 'your-email@example.com'
--   and r.key = 'super_admin';
