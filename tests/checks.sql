-- Четыре проверочных запроса, которые дублируются в pytest.

-- 1. В витрине нет дублей по ключу
select count(*) as dup_keys from (
  select employee_id, date_key
  from dm.mv_attendance_day
  group by 1, 2
  having count(*) > 1
) t;

-- 2. Опоздание не может быть у дня без входа, минуты не отрицательные
select count(*) as bad_late
from dm.mv_attendance_day
where (is_late and first_in is null) or late_minutes < 0;

-- 3. remote/field никогда не опаздывают
select count(*) as remote_late
from dm.mv_attendance_day
where is_late and schedule_type in ('remote', 'field');

-- 4. Сотрудники без СКУД не попадают в опоздания и отсутствия
select count(*) as no_scud_metrics
from dm.mv_attendance_day
where not has_scud and (is_late or absence_type is not null);
