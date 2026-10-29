create extension if not exists pgcrypto with schema extensions;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'admissions', 'communications')),
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id integer primary key check (id = 1),
  school_name text not null default 'The Little Harvard Academy',
  motto text not null default 'Knowledge · Discipline · Excellence',
  headline text not null default 'A bright beginning. A brilliant future.',
  introduction text not null default 'A caring learning community where every child is known, challenged and encouraged to thrive.',
  phone text not null default '+254 742 676 542',
  email text not null default 'ochiengvicky21@gmail.com',
  address text not null default 'P.O. Box 40300, Kenya',
  admissions_open boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (
  id, school_name, motto, headline, introduction, phone, email, address, admissions_open
) values (
  1,
  'The Little Harvard Academy',
  'Knowledge · Discipline · Excellence',
  'A bright beginning. A brilliant future.',
  'A caring learning community where every child is known, challenged and encouraged to thrive.',
  '+254 742 676 542',
  'ochiengvicky21@gmail.com',
  'P.O. Box 40300, Kenya',
  true
) on conflict (id) do nothing;

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('news', 'events', 'notices')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  publish_date date not null default current_date,
  published boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.public_submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('admission', 'contact', 'visit', 'newsletter')),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone text check (phone is null or char_length(phone) <= 40),
  student_name text check (student_name is null or char_length(student_name) <= 120),
  grade text check (grade is null or char_length(grade) <= 60),
  department text check (department is null or char_length(department) <= 80),
  subject text check (subject is null or char_length(subject) <= 160),
  message text check (message is null or char_length(message) <= 3000),
  preferred_visit_date date,
  status text not null default 'New' check (status in ('New', 'Handled')),
  reply text check (reply is null or char_length(reply) <= 5000),
  replied_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint admission_required_fields check (
    kind <> 'admission' or (student_name is not null and grade is not null and phone is not null)
  ),
  constraint visit_required_fields check (
    kind <> 'visit' or (phone is not null and preferred_visit_date is not null)
  )
);

create index if not exists site_content_published_date_idx
  on public.site_content (published, publish_date desc);
create index if not exists site_content_kind_date_idx
  on public.site_content (kind, publish_date desc);
create index if not exists public_submissions_created_at_idx
  on public.public_submissions (created_at desc);
create index if not exists public_submissions_kind_status_idx
  on public.public_submissions (kind, status, created_at desc);

create or replace function public.has_site_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = any (allowed_roles)
  );
$$;

create or replace function public.site_role_for_user(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.user_roles where user_id = target_user_id;
$$;

revoke all on function public.has_site_role(text[]) from public, anon;
revoke all on function public.site_role_for_user(uuid) from public, anon, authenticated;
grant execute on function public.has_site_role(text[]) to anon, authenticated;

create or replace function public.set_site_content_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.kind := old.kind;
  end if;
  return new;
end;
$$;

drop trigger if exists set_site_content_audit_fields on public.site_content;
create trigger set_site_content_audit_fields
before insert or update on public.site_content
for each row execute function public.set_site_content_audit_fields();

create or replace function public.set_site_settings_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_site_settings_updated_at on public.site_settings;
create trigger set_site_settings_updated_at
before update on public.site_settings
for each row execute function public.set_site_settings_updated_at();

create or replace function public.protect_public_submission_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'New';
    new.reply := null;
    new.replied_at := null;
    new.handled_by := null;
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists protect_public_submission_fields on public.public_submissions;
create trigger protect_public_submission_fields
before insert on public.public_submissions
for each row execute function public.protect_public_submission_fields();

alter table public.user_roles enable row level security;
alter table public.site_settings enable row level security;
alter table public.site_content enable row level security;
alter table public.public_submissions enable row level security;

drop policy if exists "Staff can read their own role" on public.user_roles;
create policy "Staff can read their own role"
on public.user_roles for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Anyone can read school settings" on public.site_settings;
create policy "Anyone can read school settings"
on public.site_settings for select to anon, authenticated
using (true);

drop policy if exists "Administrators can update school settings" on public.site_settings;
create policy "Administrators can update school settings"
on public.site_settings for update to authenticated
using ((select public.has_site_role(array['admin'])))
with check ((select public.has_site_role(array['admin'])));

drop policy if exists "Administrators can insert school settings" on public.site_settings;
create policy "Administrators can insert school settings"
on public.site_settings for insert to authenticated
with check ((select public.has_site_role(array['admin'])));

drop policy if exists "Anyone can read published school content" on public.site_content;
create policy "Anyone can read published school content"
on public.site_content for select to anon, authenticated
using (published or (select public.has_site_role(array['admin', 'editor', 'communications'])));

drop policy if exists "Editors and communications staff can create content" on public.site_content;
create policy "Editors and communications staff can create content"
on public.site_content for insert to authenticated
with check ((select public.has_site_role(array['admin', 'editor', 'communications'])));

drop policy if exists "Editors and communications staff can update content" on public.site_content;
create policy "Editors and communications staff can update content"
on public.site_content for update to authenticated
using ((select public.has_site_role(array['admin', 'editor', 'communications'])))
with check ((select public.has_site_role(array['admin', 'editor', 'communications'])));

drop policy if exists "Administrators can delete content" on public.site_content;
create policy "Administrators can delete content"
on public.site_content for delete to authenticated
using ((select public.has_site_role(array['admin'])));

drop policy if exists "Public can submit enquiries" on public.public_submissions;

drop policy if exists "Staff can read assigned enquiries" on public.public_submissions;
create policy "Staff can read assigned enquiries"
on public.public_submissions for select to authenticated
using (
  (select public.has_site_role(array['admin']))
  or (
    kind in ('admission', 'visit')
    and (select public.has_site_role(array['admissions']))
  )
  or (
    kind in ('contact', 'visit', 'newsletter')
    and (select public.has_site_role(array['communications']))
  )
);

drop policy if exists "Staff can update assigned enquiry status" on public.public_submissions;
create policy "Staff can update assigned enquiry status"
on public.public_submissions for update to authenticated
using (
  (select public.has_site_role(array['admin']))
  or (
    kind in ('admission', 'visit')
    and (select public.has_site_role(array['admissions']))
  )
  or (
    kind in ('contact', 'visit', 'newsletter')
    and (select public.has_site_role(array['communications']))
  )
)
with check (
  (select public.has_site_role(array['admin']))
  or (
    kind in ('admission', 'visit')
    and (select public.has_site_role(array['admissions']))
  )
  or (
    kind in ('contact', 'visit', 'newsletter')
    and (select public.has_site_role(array['communications']))
  )
);

drop policy if exists "Administrators can delete enquiries" on public.public_submissions;
create policy "Administrators can delete enquiries"
on public.public_submissions for delete to authenticated
using ((select public.has_site_role(array['admin'])));

revoke all on public.user_roles, public.site_settings, public.site_content, public.public_submissions from anon, authenticated;
grant select on public.user_roles to authenticated;
grant select on public.site_settings to anon, authenticated;
grant update (school_name, motto, headline, introduction, phone, email, address, admissions_open)
  on public.site_settings to authenticated;
grant insert (id, school_name, motto, headline, introduction, phone, email, address, admissions_open)
  on public.site_settings to authenticated;
grant select on public.site_content to anon, authenticated;
grant insert (kind, title, body, publish_date, published)
  on public.site_content to authenticated;
grant update (title, body, publish_date, published)
  on public.site_content to authenticated;
grant delete on public.site_content to authenticated;
grant select on public.public_submissions to authenticated;
grant update (status) on public.public_submissions to authenticated;
grant delete on public.public_submissions to authenticated;
grant all on public.public_submissions to service_role;
grant all on public.site_content, public.site_settings, public.user_roles to service_role;

insert into public.site_content (id, kind, title, body, publish_date, published)
values
  ('00000000-0000-4000-8000-000000000001', 'news', 'Welcome to a new school year', 'We look forward to welcoming our learners back for a year of discovery, friendship and achievement.', '2026-10-01', true),
  ('00000000-0000-4000-8000-000000000002', 'news', 'Learning through curiosity', 'Our classrooms bring questions to life through hands-on projects, teamwork and thoughtful teaching.', '2026-09-10', true),
  ('00000000-0000-4000-8000-000000000003', 'news', 'School community day', 'Thank you to all the families who joined us to celebrate the creativity and spirit of our learners.', '2026-08-20', true),
  ('00000000-0000-4000-8000-000000000004', 'events', 'Open Day & Campus Tours', 'Meet our teachers, explore the campus and learn about admissions.', '2027-01-16', true),
  ('00000000-0000-4000-8000-000000000005', 'events', 'Parent–Teacher Meetings', 'A chance to discuss learner progress and goals for the new term.', '2027-02-05', true),
  ('00000000-0000-4000-8000-000000000006', 'events', 'Annual Sports Day', 'A day of teamwork, friendly competition and family fun.', '2027-03-19', true),
  ('00000000-0000-4000-8000-000000000007', 'notices', 'Applications are open', 'Enquire now about available places for the 2027 school year.', '2026-10-01', true),
  ('00000000-0000-4000-8000-000000000008', 'notices', 'Term dates and calendar', 'Contact the school office to request the latest term calendar.', '2026-10-01', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'site_settings'
  ) then
    alter publication supabase_realtime add table public.site_settings;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'site_content'
  ) then
    alter publication supabase_realtime add table public.site_content;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'public_submissions'
  ) then
    alter publication supabase_realtime add table public.public_submissions;
  end if;
end;
$$;
