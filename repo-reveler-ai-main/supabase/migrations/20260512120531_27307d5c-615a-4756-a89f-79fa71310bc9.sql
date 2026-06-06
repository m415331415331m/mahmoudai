-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- GitHub connections
create table public.github_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  github_username text,
  github_user_id text,
  avatar_url text,
  access_token text not null,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now()
);
alter table public.github_connections enable row level security;
create policy "own gh select" on public.github_connections for select using (auth.uid() = user_id);
create policy "own gh insert" on public.github_connections for insert with check (auth.uid() = user_id);
create policy "own gh update" on public.github_connections for update using (auth.uid() = user_id);
create policy "own gh delete" on public.github_connections for delete using (auth.uid() = user_id);

-- API Keys (AI providers etc.)
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  label text,
  key_value text not null,
  created_at timestamptz not null default now()
);
alter table public.api_keys enable row level security;
create policy "own keys select" on public.api_keys for select using (auth.uid() = user_id);
create policy "own keys insert" on public.api_keys for insert with check (auth.uid() = user_id);
create policy "own keys update" on public.api_keys for update using (auth.uid() = user_id);
create policy "own keys delete" on public.api_keys for delete using (auth.uid() = user_id);

-- Agent permissions
create table public.agent_permissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  read_files boolean not null default true,
  write_files boolean not null default false,
  execute_builds boolean not null default false,
  deploy_projects boolean not null default false,
  access_github boolean not null default false,
  run_terminal boolean not null default false,
  install_packages boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.agent_permissions enable row level security;
create policy "own perms select" on public.agent_permissions for select using (auth.uid() = user_id);
create policy "own perms insert" on public.agent_permissions for insert with check (auth.uid() = user_id);
create policy "own perms update" on public.agent_permissions for update using (auth.uid() = user_id);