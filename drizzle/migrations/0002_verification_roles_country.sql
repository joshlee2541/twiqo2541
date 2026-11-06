-- Twiqo roles, verification and country support (additive)

create type public.app_role as enum ('founder', 'admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.is_twiqo_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'founder')
  )
$$;

create policy "Users can view own roles"
  on public.user_roles for select to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all roles"
  on public.user_roles for select to authenticated
  using (public.is_twiqo_admin());

-- Country chosen by the user (ISO 3166-1 alpha-2)
alter table public.profiles add column if not exists country text;
comment on column public.profiles.country is 'ISO 3166-1 alpha-2 country code chosen by the user (optional, user-selected)';

-- Verification applications
create table public.verification_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  full_legal_name text not null,
  username text not null,
  country text not null,
  category text not null,
  reason text not null,
  website_url text,
  social_links text[],
  status text not null default 'pending' check (status in ('pending','info_requested','approved','rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- one pending application per user
create unique index verification_applications_one_pending
  on public.verification_applications (user_id) where status = 'pending';

grant select, insert, update on public.verification_applications to authenticated;
grant all on public.verification_applications to service_role;

alter table public.verification_applications enable row level security;

create policy "Users can view own applications"
  on public.verification_applications for select to authenticated
  using (auth.uid() = user_id or public.is_twiqo_admin());

create policy "Users can submit own applications"
  on public.verification_applications for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending');

create policy "Users can withdraw own pending application"
  on public.verification_applications for update to authenticated
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'pending');

-- Supporting documents (paths point at the private vibelink-verification bucket)
create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.verification_applications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

grant select, insert, delete on public.verification_documents to authenticated;
grant all on public.verification_documents to service_role;

alter table public.verification_documents enable row level security;

create policy "Users can view own documents"
  on public.verification_documents for select to authenticated
  using (auth.uid() = user_id or public.is_twiqo_admin());

create policy "Users can attach own documents"
  on public.verification_documents for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can remove own documents"
  on public.verification_documents for delete to authenticated
  using (auth.uid() = user_id);

-- Every verification decision is recorded here
create table public.verification_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  action text not null,
  target_user_id uuid references public.profiles(id),
  application_id uuid references public.verification_applications(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

grant select on public.verification_audit_logs to authenticated;
grant all on public.verification_audit_logs to service_role;

alter table public.verification_audit_logs enable row level security;

create policy "Users can view own audit entries"
  on public.verification_audit_logs for select to authenticated
  using (auth.uid() = actor_id or public.is_twiqo_admin());

-- Private bucket for identity documents: owners manage their own folder,
-- admins can read any verification document.
create policy "Users upload own verification documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'vibelink-verification' and (storage.foldername(name))[1] = (auth.uid())::text);

create policy "Users view own verification documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'vibelink-verification' and ((storage.foldername(name))[1] = (auth.uid())::text or public.is_twiqo_admin()));

create policy "Users delete own verification documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'vibelink-verification' and (storage.foldername(name))[1] = (auth.uid())::text);
