create or replace view dm.v_dept_tree as
with recursive tree as (
  select d.bi_id, d.name, d.parent_id, 1 as lvl, d.name::text as path
  from master.departments d where d.parent_id is null
  union all
  select d.bi_id, d.name, d.parent_id, t.lvl + 1, t.path || ' / ' || d.name
  from master.departments d join tree t on d.parent_id = t.bi_id
)
select t.bi_id, t.name, t.parent_id, t.lvl, t.path,
       (select count(*) from master.employees e
         where e.dept_id = t.bi_id and e.is_active) as headcount
from tree t;

-- Замыкание «предок → потомок»: по нему агрегаты считаются по всему поддереву,
-- а не только по прямым сотрудникам департамента.
create or replace view dm.v_dept_closure as
with recursive c as (
  select bi_id as ancestor_id, bi_id as descendant_id
  from master.departments
  union all
  select c.ancestor_id, d.bi_id
  from c join master.departments d on d.parent_id = c.descendant_id
)
select * from c;

create or replace function dm.dept_period(p_from date, p_to date)
returns table (
  dept_id int,
  planned_days bigint,
  late_days bigint,
  absence_days bigint,
  discipline_absence_days bigint,
  discipline numeric,
  worked_hours numeric,
  plan_hours numeric,
  headcount bigint,
  attendance_employees bigint,
  approved_absence_days bigint
)
language sql stable as $$
with emp as (
  select e.bi_id, e.dept_id, e.schedule_type, e.has_scud
  from master.employees e
  where e.is_active
),
base as (
  select c.ancestor_id as dept_id,
         e.bi_id as employee_id,
         m.date_key, m.is_workday, m.first_in, m.duration_sec,
         m.is_late, m.absence_type, m.absence_approved,
         e.schedule_type, e.has_scud
  from dm.v_dept_closure c
  join emp e on e.dept_id = c.descendant_id
  join dm.mv_attendance_day m on m.employee_id = e.bi_id
  where m.date_key between p_from and p_to
),
agg as (
  select b.dept_id,
         count(*) filter (
           where b.is_workday and b.has_scud
             and b.schedule_type in ('office', 'shift')
             and not (b.absence_type is not null and b.absence_approved)
         ) as planned_days,
         count(*) filter (where b.has_scud and b.is_late) as late_days,
         count(*) filter (
           where b.is_workday and b.has_scud and b.first_in is null
             and not (b.absence_type is not null and b.absence_approved)
         ) as absence_days,
         count(*) filter (
           where b.is_workday and b.has_scud
             and b.schedule_type in ('office', 'shift')
             and b.first_in is null
             and not (b.absence_type is not null and b.absence_approved)
         ) as discipline_absence_days,
         sum(coalesce(b.duration_sec, 0)) filter (where b.has_scud) as worked_sec,
         count(distinct b.employee_id) as headcount,
         count(distinct b.employee_id) filter (where b.first_in is not null) as attendance_employees,
         count(*) filter (
           where b.has_scud and b.absence_type is not null and b.absence_approved
         ) as approved_absence_days
  from base b
  group by b.dept_id
)
select d.bi_id as dept_id,
       coalesce(a.planned_days, 0)::bigint as planned_days,
       coalesce(a.late_days, 0)::bigint as late_days,
       coalesce(a.absence_days, 0)::bigint as absence_days,
       coalesce(a.discipline_absence_days, 0)::bigint as discipline_absence_days,
       case when coalesce(a.planned_days, 0) > 0
            then round(
              (a.planned_days - a.late_days - a.discipline_absence_days)
              * 100.0 / a.planned_days, 1)
       end as discipline,
       round(coalesce(a.worked_sec, 0) / 3600.0, 1) as worked_hours,
       round(coalesce(a.planned_days, 0) * 8.0, 1) as plan_hours,
       coalesce(a.headcount, 0)::bigint as headcount,
       coalesce(a.attendance_employees, 0)::bigint as attendance_employees,
       coalesce(a.approved_absence_days, 0)::bigint as approved_absence_days
from master.departments d
left join agg a on a.dept_id = d.bi_id
$$;

-- Совместимость со спекой: представление за последние 30 дней.
create or replace view dm.v_dept_period as
select * from dm.dept_period(
  coalesce((select value::date from master.meta where key = 'today'), current_date) - 29,
  coalesce((select value::date from master.meta where key = 'today'), current_date)
);
