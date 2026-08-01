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

-- ── HR & Recruitment module ──
-- Storage: also create two PRIVATE buckets in the Supabase dashboard
-- (Storage → New bucket, "Public" off): "candidate-cvs" and
-- "onboarding-documents". Add a policy on each allowing
-- authenticated users where current_role_key() in ('super_admin','hr')
-- to select/insert/update/delete (Storage → bucket → Policies → New policy,
-- "For full customization" template, same USING/WITH CHECK expression as
-- the table policies below).

create table hr_candidates (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  position text,
  department text,
  cv_path text,
  status text not null default 'applied'
    check (status in ('applied','interviewing','hired','rejected')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table hr_onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  category text not null,
  file_name text not null,
  storage_path text not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table hr_warning_forms (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  reason text not null,
  description text not null,
  issued_by uuid references profiles(id),
  issued_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table hr_coe_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  job_title text not null,
  start_date date not null,
  purpose text,
  issued_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table hr_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  target_label text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table hr_candidates enable row level security;
alter table hr_onboarding_documents enable row level security;
alter table hr_warning_forms enable row level security;
alter table hr_coe_documents enable row level security;
alter table hr_activity_log enable row level security;

create policy "hr and super admin manage candidates" on hr_candidates
  for all to authenticated
  using (current_role_key() in ('super_admin', 'hr'))
  with check (current_role_key() in ('super_admin', 'hr'));

create policy "hr and super admin manage onboarding documents" on hr_onboarding_documents
  for all to authenticated
  using (current_role_key() in ('super_admin', 'hr'))
  with check (current_role_key() in ('super_admin', 'hr'));

create policy "hr and super admin manage warning forms" on hr_warning_forms
  for all to authenticated
  using (current_role_key() in ('super_admin', 'hr'))
  with check (current_role_key() in ('super_admin', 'hr'));

create policy "hr and super admin manage coe documents" on hr_coe_documents
  for all to authenticated
  using (current_role_key() in ('super_admin', 'hr'))
  with check (current_role_key() in ('super_admin', 'hr'));

create policy "hr and super admin manage activity log" on hr_activity_log
  for all to authenticated
  using (current_role_key() in ('super_admin', 'hr'))
  with check (current_role_key() in ('super_admin', 'hr'));

-- ── Clock In/Out, Corrections, PTO ──
-- Available to every authenticated user for their own rows (self-service);
-- HR/Super Admin can see and manage everyone's.

create table pto_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  pto_type text not null check (pto_type in ('vacation', 'sick', 'personal', 'unpaid')),
  start_date date not null,
  end_date date not null,
  hours_requested numeric not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'cancelled')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table timecard_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  work_date date not null,
  check_in time,
  check_out time,
  meal_start time,
  meal_end time,
  notes text,
  unique (profile_id, work_date)
);

create table timecard_corrections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  work_date date not null,
  corrected_check_in time,
  corrected_check_out time,
  corrected_meal_start time,
  corrected_meal_end time,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table pto_requests enable row level security;
alter table timecard_entries enable row level security;
alter table timecard_corrections enable row level security;

create policy "self or hr/super admin manage pto requests" on pto_requests
  for all to authenticated
  using (profile_id = auth.uid() or current_role_key() in ('super_admin', 'hr'))
  with check (profile_id = auth.uid() or current_role_key() in ('super_admin', 'hr'));

create policy "self or hr/super admin manage timecard entries" on timecard_entries
  for all to authenticated
  using (profile_id = auth.uid() or current_role_key() in ('super_admin', 'hr'))
  with check (profile_id = auth.uid() or current_role_key() in ('super_admin', 'hr'));

create policy "self or hr/super admin manage timecard corrections" on timecard_corrections
  for all to authenticated
  using (profile_id = auth.uid() or current_role_key() in ('super_admin', 'hr'))
  with check (profile_id = auth.uid() or current_role_key() in ('super_admin', 'hr'));

-- ── Careers portal integration ──
-- hwalun-corp (the public site, same Supabase project) already inserts into
-- this table from its /careers page using the anon key, and uploads resumes
-- into a "resumes" storage bucket. Manual step: add a SELECT policy on that
-- existing bucket for current_role_key() in ('super_admin','hr') so HR can
-- generate signed URLs to view submitted resumes (Storage → resumes bucket →
-- Policies → New policy, "For full customization" template).

create table career_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  department text not null,
  message text,
  resume_path text not null,
  status text not null default 'new' check (status in ('new', 'reviewed', 'converted', 'archived')),
  created_at timestamptz not null default now()
);

alter table career_applications enable row level security;

create policy "public can submit applications" on career_applications
  for insert to anon
  with check (true);

create policy "hr and super admin manage applications" on career_applications
  for all to authenticated
  using (current_role_key() in ('super_admin', 'hr'))
  with check (current_role_key() in ('super_admin', 'hr'));

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
