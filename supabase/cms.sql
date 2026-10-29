create table if not exists public.site_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('document', 'gallery', 'staff')),
  page_key text check (page_key in (
    'home', 'about', 'academics', 'admissions', 'contact', 'downloads',
    'facilities', 'faq', 'gallery', 'news', 'staff', 'student-life'
  )),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  object_path text not null unique,
  file_name text not null,
  content_type text not null,
  file_size bigint not null check (file_size between 1 and 10485760),
  person_name text,
  position text,
  department text,
  email text,
  phone text,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_asset_details check (
    kind <> 'staff' or (
      nullif(btrim(person_name), '') is not null
      and nullif(btrim(position), '') is not null
    )
  ),
  constraint gallery_asset_page check (
    (kind = 'gallery' and page_key is not null)
    or (kind <> 'gallery' and page_key is null)
  )
);

create table if not exists public.site_sections (
  id uuid primary key default gen_random_uuid(),
  page_key text not null check (page_key in (
    'home', 'about', 'academics', 'admissions', 'contact', 'downloads',
    'facilities', 'faq', 'gallery', 'news', 'staff', 'student-life'
  )),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  sort_order integer not null default 0,
  published boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant execute on function public.has_site_role(text[]) to anon, authenticated;

create index if not exists site_assets_public_kind_idx
  on public.site_assets (kind, published, sort_order, created_at desc);
create index if not exists site_sections_public_page_idx
  on public.site_sections (page_key, published, sort_order, created_at);

alter table public.site_assets enable row level security;
alter table public.site_sections enable row level security;

drop policy if exists "Anyone can read published site assets" on public.site_assets;
create policy "Anyone can read published site assets"
on public.site_assets for select to anon, authenticated
using (published or (select public.has_site_role(array['admin', 'editor'])));

drop policy if exists "Editors can manage site assets" on public.site_assets;
create policy "Editors can manage site assets"
on public.site_assets for insert to authenticated
with check ((select public.has_site_role(array['admin', 'editor'])));

drop policy if exists "Editors can update site assets" on public.site_assets;
create policy "Editors can update site assets"
on public.site_assets for update to authenticated
using ((select public.has_site_role(array['admin', 'editor'])))
with check ((select public.has_site_role(array['admin', 'editor'])));

drop policy if exists "Administrators can delete site assets" on public.site_assets;
create policy "Administrators can delete site assets"
on public.site_assets for delete to authenticated
using ((select public.has_site_role(array['admin'])));

drop policy if exists "Anyone can read published page sections" on public.site_sections;
create policy "Anyone can read published page sections"
on public.site_sections for select to anon, authenticated
using (published or (select public.has_site_role(array['admin', 'editor'])));

drop policy if exists "Editors can manage page sections" on public.site_sections;
create policy "Editors can manage page sections"
on public.site_sections for insert to authenticated
with check ((select public.has_site_role(array['admin', 'editor'])));

drop policy if exists "Editors can update page sections" on public.site_sections;
create policy "Editors can update page sections"
on public.site_sections for update to authenticated
using ((select public.has_site_role(array['admin', 'editor'])))
with check ((select public.has_site_role(array['admin', 'editor'])));

drop policy if exists "Administrators can delete page sections" on public.site_sections;
create policy "Administrators can delete page sections"
on public.site_sections for delete to authenticated
using ((select public.has_site_role(array['admin'])));

revoke all on public.site_assets, public.site_sections from anon, authenticated;
grant select on public.site_assets, public.site_sections to anon, authenticated;
grant insert (kind, page_key, title, description, object_path, file_name, content_type, file_size,
  person_name, position, department, email, phone, sort_order, published)
  on public.site_assets to authenticated;
grant update (kind, page_key, title, description, object_path, file_name, content_type, file_size,
  person_name, position, department, email, phone, sort_order, published)
  on public.site_assets to authenticated;
grant delete on public.site_assets to authenticated;
grant insert (page_key, title, body, sort_order, published)
  on public.site_sections to authenticated;
grant update (page_key, title, body, sort_order, published)
  on public.site_sections to authenticated;
grant delete on public.site_sections to authenticated;
grant all on public.site_assets, public.site_sections to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-site',
  'public-site',
  true,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view public school uploads" on storage.objects;
create policy "Anyone can view public school uploads"
on storage.objects for select to anon, authenticated
using (bucket_id = 'public-site');

drop policy if exists "Editors can upload school content" on storage.objects;
create policy "Editors can upload school content"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'public-site'
  and (select public.has_site_role(array['admin', 'editor']))
);

drop policy if exists "Editors can update school uploads" on storage.objects;
create policy "Editors can update school uploads"
on storage.objects for update to authenticated
using (
  bucket_id = 'public-site'
  and (select public.has_site_role(array['admin', 'editor']))
)
with check (
  bucket_id = 'public-site'
  and (select public.has_site_role(array['admin', 'editor']))
);

drop policy if exists "Administrators can delete school uploads" on storage.objects;
create policy "Administrators can delete school uploads"
on storage.objects for delete to authenticated
using (
  bucket_id = 'public-site'
  and (select public.has_site_role(array['admin']))
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_assets'
    ) then
      alter publication supabase_realtime add table public.site_assets;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_sections'
    ) then
      alter publication supabase_realtime add table public.site_sections;
    end if;
  end if;
end;
$$;
