-- Schema database "Scuola" (Postgres / Neon)
-- Eseguire con: npm run db:init

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  username_lower text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Orario settimanale: un blocco = materia + giorno + ora inizio/fine
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- 1 = lunedi
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);
create index if not exists lessons_user_day_idx on lessons (user_id, weekday, start_time);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'done')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists project_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  event_date date not null,
  event_time time,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists project_events_user_date_idx on project_events (user_id, event_date);

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  folder_id uuid references folders(id) on delete set null,
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  mime text not null default 'application/octet-stream',
  size integer not null,
  data bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists files_user_idx on files (user_id);
create index if not exists files_subject_idx on files (subject_id);
create index if not exists files_project_idx on files (project_id);

create table if not exists homework (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  title text not null,
  notes text,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
-- per database creati con una versione precedente dello schema
 alter table homework add column if not exists due_date date;
create index if not exists homework_user_idx on homework (user_id, done);
