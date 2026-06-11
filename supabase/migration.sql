create extension if not exists pgcrypto;

create table if not exists workstreams (
  id text primary key,
  name text not null,
  color text not null,
  icon text not null
);

create table if not exists tasks (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text not null default '',
  workstream_id text references workstreams(id) on delete set null,
  status text not null check (status in ('backlog','todo','doing','blocked','done')),
  priority text not null check (priority in ('P0','P1','P2')),
  sprint_day int check (sprint_day between 1 and 7),
  due_date date,
  owner text not null default 'Founder',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sort_order int not null default 0
);

create table if not exists milestones (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  target_date date not null,
  phase text not null check (phase in ('pilot','bulgaria','eu','us','insurance')),
  status text not null check (status in ('pending','hit','missed','at_risk')),
  description text not null default ''
);

create table if not exists kpis (
  id text primary key default gen_random_uuid()::text,
  key text unique not null,
  label text not null,
  unit text not null,
  category text not null check (category in ('product','commercial','financial','clinical_safety')),
  target_y1 numeric not null,
  sort_order int not null default 0
);

create table if not exists kpi_entries (
  id text primary key default gen_random_uuid()::text,
  kpi_id text not null references kpis(id) on delete cascade,
  date date not null,
  value numeric not null,
  note text not null default ''
);

create table if not exists clinics (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  city text not null,
  country text not null,
  contact_name text not null default '',
  contact_email text not null default '',
  phone text not null default '',
  stage text not null check (stage in ('lead','contacted','demo','pilot','paying','churned')),
  mrr numeric not null default 0,
  vets_count int not null default 0,
  notes text not null default '',
  last_touch date,
  next_action text not null default '',
  next_action_date date
);

create table if not exists investors (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  firm text not null default '',
  type text not null check (type in ('angel','preseed','seed','series_a')),
  country text not null,
  stage text not null check (stage in ('research','contacted','meeting','dd','term_sheet','committed','passed')),
  check_min numeric not null default 0,
  check_max numeric not null default 0,
  warm_intro_via text not null default '',
  last_touch date,
  next_action text not null default '',
  notes text not null default ''
);

create table if not exists risks (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  category text not null check (category in ('market','execution','regulatory','safety','funding','competition','technical')),
  likelihood int not null check (likelihood between 1 and 5),
  impact int not null check (impact between 1 and 5),
  mitigation text not null default '',
  owner text not null default 'Founder',
  status text not null check (status in ('open','mitigating','closed')),
  review_date date not null
);

create table if not exists documents (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  type text not null check (type in ('strategy','legal','pitch','financial','clinical','other')),
  url text not null default '',
  content_md text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists decisions (
  id text primary key default gen_random_uuid()::text,
  date date not null,
  title text not null,
  context text not null default '',
  decision text not null default '',
  alternatives text not null default '',
  owner text not null default 'Founder'
);

create table if not exists weekly_updates (
  id text primary key default gen_random_uuid()::text,
  week_start date not null,
  wins text not null default '',
  problems text not null default '',
  metrics_note text not null default '',
  next_week text not null default ''
);

alter table workstreams enable row level security;
alter table tasks enable row level security;
alter table milestones enable row level security;
alter table kpis enable row level security;
alter table kpi_entries enable row level security;
alter table clinics enable row level security;
alter table investors enable row level security;
alter table risks enable row level security;
alter table documents enable row level security;
alter table decisions enable row level security;
alter table weekly_updates enable row level security;

do $$
declare t text;
begin
  foreach t in array array['workstreams','tasks','milestones','kpis','kpi_entries','clinics','investors','risks','documents','decisions','weekly_updates']
  loop
    execute format('drop policy if exists "mission_control_all_authenticated" on %I', t);
    execute format('create policy "mission_control_all_authenticated" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
