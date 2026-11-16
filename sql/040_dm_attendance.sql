-- Полная сетка «сотрудник × день» за 180 дней до даты today из master.meta.
-- В отличие от событийной витрины, здесь есть и дни без событий: это нужно,
-- чтобы несогласованные отсутствия и плановые дни считались в одном месте.
create or replace view dm.v_attendance_day as
with bounds as (
  select coalesce(
    (select value::date from master.meta where key = 'today'),
    (select max((ts at time zone 'Europe/Moscow')::date) from master.events),
    current_date
  ) as today
),
dates as (
  select c.date_key, c.is_workday
  from master.calendar c, bounds b
  where c.date_key between b.today - 179 and b.today
),
ev as (
  select employee_id,
         (ts at time zone 'Europe/Moscow')::date as date_key,
         direction,
         ts
  from master.events
),
agg as (
  select employee_id, date_key,
         min(ts) filter (where direction = 'IN')  as first_in,
         max(ts) filter (where direction = 'OUT') as last_out
  from ev
  group by employee_id, date_key
)
select e.bi_id as employee_id,
       e.dept_id,
       d.date_key,
       a.first_in,
       a.last_out,
       case when a.first_in is not null and a.last_out is not null
            then least(greatest(extract(epoch from (a.last_out - a.first_in))::int, 0), 16 * 3600)
       end as duration_sec,
       e.planned_arrival,
       e.planned_departure,
       coalesce(
         a.first_in is not null
         and e.has_scud
         and e.schedule_type in ('office', 'shift')
         and (a.first_in at time zone 'Europe/Moscow')::time
             > e.planned_arrival + interval '5 minutes',
         false) as is_late,
       case when a.first_in is not null
            then greatest(0, extract(epoch from (
              (a.first_in at time zone 'Europe/Moscow')::time - e.planned_arrival
            ))::int / 60)
       end as late_minutes,
       coalesce(
         a.last_out is not null
         and e.has_scud
         and e.schedule_type in ('office', 'shift')
         and (a.last_out at time zone 'Europe/Moscow')::time
             < e.planned_departure - interval '5 minutes',
         false) as is_early_leave,
       ab.absence_type,
       coalesce(ab.is_approved, false) as absence_approved,
       e.has_scud,
       e.schedule_type,
       d.is_workday
from master.employees e
cross join dates d
left join agg a on a.employee_id = e.bi_id and a.date_key = d.date_key
left join master.absences ab
       on ab.employee_id = e.bi_id and ab.date_key = d.date_key
where e.is_active;

drop materialized view if exists dm.mv_attendance_day;

create materialized view dm.mv_attendance_day as
select * from dm.v_attendance_day;

create unique index mv_attendance_day_pk on dm.mv_attendance_day (employee_id, date_key);
create index mv_attendance_day_date_idx on dm.mv_attendance_day (date_key);
create index mv_attendance_day_dept_idx on dm.mv_attendance_day (dept_id, date_key);

create or replace function dm.refresh_attendance() returns void
language sql as $$ refresh materialized view concurrently dm.mv_attendance_day; $$;

-- «В офисе сейчас» считается относительно даты today из master.meta,
-- а не фактического времени сервера: демо не должно пустеть на выходных.
create or replace view dm.v_office_now as
with today as (
  select coalesce(
    (select value::date from master.meta where key = 'today'),
    (select max((ts at time zone 'Europe/Moscow')::date) from master.events),
    current_date
  ) as date_key
),
last_ev as (
  select distinct on (m.employee_id) m.employee_id, m.direction, m.ts
  from master.events m, today t
  where (m.ts at time zone 'Europe/Moscow')::date = t.date_key
  order by m.employee_id, m.ts desc
)
select e.bi_id as employee_id,
       e.full_name,
       e.dept_id,
       d.name as department,
       l.ts
from last_ev l
join master.employees e on e.bi_id = l.employee_id
left join master.departments d on d.bi_id = e.dept_id
where l.direction = 'IN' and e.is_active;
