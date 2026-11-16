create table if not exists master.departments (
  bi_id int primary key,
  name text not null,
  parent_id int references master.departments (bi_id)
);

create table if not exists master.employees (
  bi_id int primary key,
  full_name text not null,
  dept_id int references master.departments (bi_id),
  position text,
  schedule_type text not null default 'office'
    check (schedule_type in ('office', 'remote', 'field', 'shift')),
  planned_arrival time not null default '09:00',
  planned_departure time not null default '18:00',
  is_active boolean not null default true,
  has_scud boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists master.events (
  bi_id bigint primary key,
  employee_id int not null references master.employees (bi_id),
  direction text not null check (direction in ('IN', 'OUT')),
  ts timestamptz not null
);

create index if not exists events_employee_ts_idx on master.events (employee_id, ts desc);
create index if not exists events_ts_idx on master.events (ts);

create table if not exists master.absences (
  employee_id int not null references master.employees (bi_id),
  date_key date not null,
  absence_type text not null,
  is_approved boolean not null default false,
  primary key (employee_id, date_key)
);

create table if not exists master.calendar (
  date_key date primary key,
  is_workday boolean not null
);

insert into master.calendar (date_key, is_workday)
select d::date, extract(isodow from d) < 6
from generate_series('2024-01-01'::date, '2028-12-31'::date, interval '1 day') d
on conflict do nothing;

-- Служебные значения: дата «сегодня» для демо, версия сида и т. п.
create table if not exists master.meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
