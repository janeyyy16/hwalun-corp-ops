-- Run in the Supabase SQL editor (same project as hwa-lun-corporation).
-- Safe to re-run in full any time — every statement is idempotent (tables use
-- IF NOT EXISTS, policies are DROP-then-CREATE, columns use ADD COLUMN IF NOT
-- EXISTS), so pasting the whole file again after pulling new changes won't
-- error even if earlier sections were already applied.

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

drop policy if exists "authenticated can read roles" on roles;
create policy "authenticated can read roles"
  on roles for select
  to authenticated
  using (true);

drop policy if exists "users can read own profile" on profiles;
create policy "users can read own profile"
  on profiles for select
  to authenticated
  using (id = auth.uid());

-- Admin needs to view every employee's profile from User Management too
-- (not just start/hr) — renamed from the old "hr and super admin ..." policy.
drop policy if exists "hr and super admin can read all profiles" on profiles;
drop policy if exists "hr, admin, and super admin can read all profiles" on profiles;
create policy "hr, admin, and super admin can read all profiles"
  on profiles for select
  to authenticated
  using (current_role_key() in ('super_admin', 'hr', 'admin'));

-- No insert/update/delete policies on purpose: employee accounts are only
-- ever created through the Worker's /api/employees route, which uses the
-- Supabase service-role key (bypasses RLS) after checking the caller's role.

-- ── Profile Settings (self-service) ──
-- Employees edit their own basic info through the update_own_profile() RPC
-- below rather than a plain UPDATE policy — it's SECURITY DEFINER but scoped
-- to auth.uid() and only ever touches these specific columns, so there's no
-- way for a caller to reach role_id/email even though RLS itself still has
-- no UPDATE policy on profiles.

alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists address text;
alter table profiles add column if not exists start_date date;
alter table profiles add column if not exists date_of_birth date;
alter table profiles add column if not exists emergency_contact_name text;
alter table profiles add column if not exists emergency_contact_phone text;

-- Start Date is deliberately excluded here — it drives PTO tenure, so only
-- update_employee_profile() (super_admin/hr/admin, further down) can change
-- it. Employees see it on their own Profile Settings as a read-only field.
-- Postgres treats a changed parameter list as a new overload rather than a
-- replacement, so the old 8-arg signature (with p_start_date) is dropped
-- explicitly first.
drop function if exists update_own_profile(text, text, text, text, date, date, text, text);
create or replace function update_own_profile(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_address text,
  p_date_of_birth date,
  p_emergency_contact_name text,
  p_emergency_contact_phone text
)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles
  set
    first_name = p_first_name,
    last_name = p_last_name,
    full_name = coalesce(
      nullif(trim(both ' ' from coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')), ''),
      full_name
    ),
    phone = p_phone,
    address = p_address,
    date_of_birth = p_date_of_birth,
    emergency_contact_name = p_emergency_contact_name,
    emergency_contact_phone = p_emergency_contact_phone
  where id = auth.uid()
$$;

-- Lets super_admin/hr/admin view and correct another employee's basic info
-- (same field set as update_own_profile, e.g. Start Date for PTO tenure)
-- from User Management, without a broader UPDATE policy on profiles that
-- could let them touch role_id or email. Not callable by regular employees
-- on anyone but themselves (they use update_own_profile instead).
create or replace function update_employee_profile(
  p_profile_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_address text,
  p_start_date date,
  p_date_of_birth date,
  p_emergency_contact_name text,
  p_emergency_contact_phone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_role_key() not in ('super_admin', 'hr', 'admin') then
    raise exception 'Not authorized to edit other employees'' profiles.';
  end if;
  update profiles
  set
    first_name = p_first_name,
    last_name = p_last_name,
    full_name = coalesce(
      nullif(trim(both ' ' from coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')), ''),
      full_name
    ),
    phone = p_phone,
    address = p_address,
    start_date = p_start_date,
    date_of_birth = p_date_of_birth,
    emergency_contact_name = p_emergency_contact_name,
    emergency_contact_phone = p_emergency_contact_phone
  where id = p_profile_id;
end;
$$;

-- ── HR & Recruitment module ──
-- Storage buckets and their policies are created further down (see
-- "Storage buckets & policies") once current_role_key() and every table
-- that references profiles/candidates already exists.

create table if not exists hr_candidates (
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

create table if not exists hr_onboarding_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  category text not null,
  file_name text not null,
  storage_path text not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists hr_warning_forms (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  reason text not null,
  description text not null,
  issued_by uuid references profiles(id),
  issued_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists hr_coe_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  job_title text not null,
  start_date date not null,
  purpose text,
  issued_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists hr_activity_log (
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

drop policy if exists "hr and super admin manage candidates" on hr_candidates;
create policy "hr and super admin manage candidates" on hr_candidates
  for all to authenticated
  using (current_role_key() in ('super_admin', 'hr'))
  with check (current_role_key() in ('super_admin', 'hr'));

drop policy if exists "hr and super admin manage onboarding documents" on hr_onboarding_documents;
create policy "hr and super admin manage onboarding documents" on hr_onboarding_documents
  for all to authenticated
  using (current_role_key() in ('super_admin', 'hr'))
  with check (current_role_key() in ('super_admin', 'hr'));

drop policy if exists "hr and super admin manage warning forms" on hr_warning_forms;
create policy "hr and super admin manage warning forms" on hr_warning_forms
  for all to authenticated
  using (current_role_key() in ('super_admin', 'hr'))
  with check (current_role_key() in ('super_admin', 'hr'));

drop policy if exists "hr and super admin manage coe documents" on hr_coe_documents;
create policy "hr and super admin manage coe documents" on hr_coe_documents
  for all to authenticated
  using (current_role_key() in ('super_admin', 'hr'))
  with check (current_role_key() in ('super_admin', 'hr'));

-- Widened to include admin: they can't reach HR & Recruitment's own Activity
-- Log tab, but need to see (and generate, via User Management edits) entries.
drop policy if exists "hr and super admin manage activity log" on hr_activity_log;
drop policy if exists "hr, admin, and super admin manage activity log" on hr_activity_log;
create policy "hr, admin, and super admin manage activity log" on hr_activity_log
  for all to authenticated
  using (current_role_key() in ('super_admin', 'hr', 'admin'))
  with check (current_role_key() in ('super_admin', 'hr', 'admin'));

-- ── Clock In/Out, Corrections, PTO ──
-- Available to every authenticated user for their own rows (self-service);
-- HR/Super Admin can see and manage everyone's.

create table if not exists pto_requests (
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

create table if not exists timecard_entries (
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

create table if not exists timecard_corrections (
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

drop policy if exists "self or hr/super admin manage pto requests" on pto_requests;
create policy "self or hr/super admin manage pto requests" on pto_requests
  for all to authenticated
  using (profile_id = auth.uid() or current_role_key() in ('super_admin', 'hr'))
  with check (profile_id = auth.uid() or current_role_key() in ('super_admin', 'hr'));

drop policy if exists "self or hr/super admin manage timecard entries" on timecard_entries;
create policy "self or hr/super admin manage timecard entries" on timecard_entries
  for all to authenticated
  using (profile_id = auth.uid() or current_role_key() in ('super_admin', 'hr'))
  with check (profile_id = auth.uid() or current_role_key() in ('super_admin', 'hr'));

drop policy if exists "self or hr/super admin manage timecard corrections" on timecard_corrections;
create policy "self or hr/super admin manage timecard corrections" on timecard_corrections
  for all to authenticated
  using (profile_id = auth.uid() or current_role_key() in ('super_admin', 'hr'))
  with check (profile_id = auth.uid() or current_role_key() in ('super_admin', 'hr'));

-- ── Careers portal integration ──
-- hwalun-corp (the public site, same Supabase project) already inserts into
-- this table from its /careers page using the anon key, and uploads resumes
-- into a "resumes" storage bucket. The read policy for that bucket is added
-- further down (see "Storage buckets & policies").

create table if not exists career_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  department text not null,
  message text,
  resume_path text not null,
  status text not null default 'new' check (status in ('new', 'reviewed', 'converted', 'rejected')),
  created_at timestamptz not null default now()
);

-- hwalun-corp's own migration already created this table (without a status
-- column) before this file ever ran here, so the CREATE TABLE above was a
-- no-op — patch the existing table instead.
alter table career_applications add column if not exists status text not null default 'new';

-- "archived" was renamed to "rejected" — migrate any rows saved under the old name.
update career_applications set status = 'rejected' where status = 'archived';

-- Re-run drop-then-add (not "if not exists") so the constraint definition
-- stays in sync if the allowed status values ever change again.
alter table career_applications drop constraint if exists career_applications_status_check;
alter table career_applications
  add constraint career_applications_status_check
  check (status in ('new', 'reviewed', 'converted', 'rejected'));

alter table career_applications enable row level security;

drop policy if exists "public can submit applications" on career_applications;
create policy "public can submit applications" on career_applications
  for insert to anon
  with check (true);

drop policy if exists "hr and super admin manage applications" on career_applications;
create policy "hr and super admin manage applications" on career_applications
  for all to authenticated
  using (current_role_key() in ('super_admin', 'hr'))
  with check (current_role_key() in ('super_admin', 'hr'));

-- ── Storage buckets & policies ──
-- "resumes" already exists (created by hwalun-corp's own migration, which
-- also already grants public/anon insert from the careers page) — we only
-- add the missing read policy so HR can view submitted resumes. The other
-- two buckets are ours and are created here too, so no manual dashboard
-- step is needed for any of this.

insert into storage.buckets (id, name, public)
values
  ('candidate-cvs', 'candidate-cvs', false),
  ('onboarding-documents', 'onboarding-documents', false)
on conflict (id) do nothing;

drop policy if exists "hr and super admin read resumes" on storage.objects;
create policy "hr and super admin read resumes" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and current_role_key() in ('super_admin', 'hr'));

drop policy if exists "hr and super admin manage candidate cvs" on storage.objects;
create policy "hr and super admin manage candidate cvs" on storage.objects
  for all to authenticated
  using (bucket_id = 'candidate-cvs' and current_role_key() in ('super_admin', 'hr'))
  with check (bucket_id = 'candidate-cvs' and current_role_key() in ('super_admin', 'hr'));

drop policy if exists "hr and super admin manage onboarding documents storage" on storage.objects;
create policy "hr and super admin manage onboarding documents storage" on storage.objects
  for all to authenticated
  using (bucket_id = 'onboarding-documents' and current_role_key() in ('super_admin', 'hr'))
  with check (bucket_id = 'onboarding-documents' and current_role_key() in ('super_admin', 'hr'));

-- ── Internal messaging ──
-- Any authenticated user can message any other user (internal company chat,
-- not gated by role). Direct (1:1) and group threads share the same shape.

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table conversations add column if not exists is_announcement boolean not null default false;

create table if not exists conversation_participants (
  conversation_id uuid not null references conversations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, profile_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- Security definer so the RLS policies below can check membership without
-- the conversation_participants policy recursing into itself.
create or replace function is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = p_conversation_id and profile_id = auth.uid()
  )
$$;

-- profiles' own SELECT policies only let a caller read their own row (or
-- everyone's if hr/super_admin) — too narrow for messaging, where any
-- authenticated user needs to see any other user's display name. This
-- exposes just id + full_name (never phone/address/DOB/etc.) to everyone.
create or replace function list_profile_names()
returns table (id uuid, full_name text)
language sql
security definer
set search_path = public
stable
as $$
  select id, full_name from profiles
$$;

alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table messages enable row level security;

drop policy if exists "participants can read their conversations" on conversations;
create policy "participants can read their conversations" on conversations
  for select to authenticated
  -- created_by check lets the creator read the row back (e.g. via
  -- .select().single() right after insert) before their own participant
  -- row exists yet. is_announcement is always readable by everyone.
  using (is_conversation_participant(id) or created_by = auth.uid() or is_announcement);

drop policy if exists "authenticated can start conversations" on conversations;
create policy "authenticated can start conversations" on conversations
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "participants can read conversation participants" on conversation_participants;
create policy "participants can read conversation participants" on conversation_participants
  for select to authenticated
  using (profile_id = auth.uid() or is_conversation_participant(conversation_id));

drop policy if exists "participants can add conversation participants" on conversation_participants;
create policy "participants can add conversation participants" on conversation_participants
  for insert to authenticated
  with check (profile_id = auth.uid() or is_conversation_participant(conversation_id));

drop policy if exists "participants can update their own membership" on conversation_participants;
create policy "participants can update their own membership" on conversation_participants
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "participants can read conversation messages" on messages;
create policy "participants can read conversation messages" on messages
  for select to authenticated
  using (is_conversation_participant(conversation_id));

drop policy if exists "participants can send conversation messages" on messages;
create policy "participants can send conversation messages" on messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and is_conversation_participant(conversation_id)
    -- Only admin/super_admin can post into the #announcement channel;
    -- everyone else can still read it, just not send into it.
    and (
      current_role_key() in ('super_admin', 'admin')
      or not exists (select 1 from conversations c where c.id = conversation_id and c.is_announcement)
    )
  );

-- ── #announcement channel ──
-- One shared, company-wide channel every employee is a member of. Posting
-- is restricted to admin/super_admin by the messages insert policy above;
-- everyone else is read-only. New hires are auto-added via the trigger below.

insert into conversations (is_group, is_announcement, title, created_by)
select true, true, '#announcement', null
where not exists (select 1 from conversations where is_announcement = true);

insert into conversation_participants (conversation_id, profile_id)
select c.id, p.id
from conversations c
cross join profiles p
where c.is_announcement = true
on conflict do nothing;

create or replace function add_new_profile_to_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into conversation_participants (conversation_id, profile_id)
  select id, new.id from conversations where is_announcement = true
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists add_profile_to_announcement on profiles;
create trigger add_profile_to_announcement
  after insert on profiles
  for each row execute function add_new_profile_to_announcement();

-- ── Message reactions ──
-- One reaction per person per message (primary key enforces this); clicking
-- the same emoji again removes it, clicking a different one replaces it.

create table if not exists message_reactions (
  message_id uuid not null references messages(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);

alter table message_reactions enable row level security;

drop policy if exists "participants can read message reactions" on message_reactions;
create policy "participants can read message reactions" on message_reactions
  for select to authenticated
  using (exists (select 1 from messages m where m.id = message_id and is_conversation_participant(m.conversation_id)));

drop policy if exists "participants can manage own reactions" on message_reactions;
create policy "participants can manage own reactions" on message_reactions
  for all to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and exists (select 1 from messages m where m.id = message_id and is_conversation_participant(m.conversation_id))
  );

-- Live message + reaction delivery, and live "seen" updates.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table message_reactions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_participants'
  ) then
    alter publication supabase_realtime add table conversation_participants;
  end if;
end $$;

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
