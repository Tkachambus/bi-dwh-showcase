create or replace function master.merge_batch(p_entity text, p_batch_id text)
returns table (status text, rows_in int, rows_applied int, note text)
language plpgsql as $$
declare
  v_items jsonb;
  v_rows int;
  v_applied int := 0;
  v_fp text;
  v_prev audit.snapshot_state%rowtype;
begin
  select b.items, b.rows_count into v_items, v_rows
  from staging.incoming_batches b where b.batch_id = p_batch_id;

  if v_items is null then
    return query select 'missing'::text, 0, 0, 'batch not found'::text;
    return;
  end if;

  if exists (select 1 from audit.merge_log where batch_id = p_batch_id) then
    return query select 'skipped'::text, v_rows, 0, 'already merged'::text;
    return;
  end if;

  insert into audit.merge_log (batch_id, entity, status, rows_in)
  values (p_batch_id, p_entity, 'running', v_rows);

  if p_entity = 'departments' then
    insert into master.departments (bi_id, name, parent_id)
    select x.bi_id, x.name, x.parent_id
    from jsonb_to_recordset(v_items) as x(bi_id int, name text, parent_id int)
    on conflict (bi_id) do update set name = excluded.name,
                                      parent_id = excluded.parent_id;
    get diagnostics v_applied = row_count;

  elsif p_entity = 'employees' then
    insert into master.employees (bi_id, full_name, dept_id, position, schedule_type,
                                  planned_arrival, planned_departure, is_active,
                                  has_scud, updated_at)
    select x.bi_id, x.full_name, x.dept_id, x.position, x.schedule_type,
           x.planned_arrival, x.planned_departure, x.is_active, x.has_scud, x.updated_at
    from jsonb_to_recordset(v_items) as x(bi_id int, full_name text, dept_id int,
           position text, schedule_type text, planned_arrival time,
           planned_departure time, is_active boolean, has_scud boolean,
           updated_at timestamptz)
    on conflict (bi_id) do update
      set full_name = excluded.full_name,
          dept_id = excluded.dept_id,
          position = excluded.position,
          schedule_type = excluded.schedule_type,
          planned_arrival = excluded.planned_arrival,
          planned_departure = excluded.planned_departure,
          is_active = excluded.is_active,
          has_scud = excluded.has_scud,
          updated_at = excluded.updated_at
      where excluded.updated_at >= master.employees.updated_at;
    get diagnostics v_applied = row_count;

  elsif p_entity = 'events' then
    insert into master.events (bi_id, employee_id, direction, ts)
    select x.bi_id, x.employee_id, x.direction, x.ts
    from jsonb_to_recordset(v_items) as x(bi_id bigint, employee_id int,
           direction text, ts timestamptz)
    on conflict (bi_id) do nothing;
    get diagnostics v_applied = row_count;

  elsif p_entity = 'absences' then
    -- Дедупликация внутри батча: у сотрудника может быть только одна запись
    -- на день, иначе on conflict ... do update падает на повторной строке.
    select md5(coalesce(string_agg(
             format('%s|%s|%s|%s', x.employee_id, x.date_key, x.absence_type, x.is_approved),
             ';' order by x.employee_id, x.date_key), ''))
      into v_fp
    from (
      select distinct on (employee_id, date_key)
             employee_id, date_key, absence_type, is_approved
      from jsonb_to_recordset(v_items) as t(employee_id int, date_key date,
             absence_type text, is_approved boolean)
      order by employee_id, date_key, absence_type, is_approved
    ) x;

    select * into v_prev from audit.snapshot_state where entity = 'absences';

    if v_prev.fingerprint is not null and v_prev.fingerprint = v_fp then
      update audit.merge_log set status = 'skipped_same', finished_at = now(),
             note = 'identical snapshot' where batch_id = p_batch_id;
      return query select 'skipped_same'::text, v_rows, 0, 'identical snapshot'::text;
      return;
    end if;

    if v_prev.rows_count is not null and v_rows < v_prev.rows_count * 0.9 then
      update audit.merge_log set status = 'rejected_partial', finished_at = now(),
             note = format('snapshot %s rows < 90%% of %s', v_rows, v_prev.rows_count)
       where batch_id = p_batch_id;
      return query select 'rejected_partial'::text, v_rows, 0,
                          'snapshot smaller than 90%'::text;
      return;
    end if;

    insert into master.absences (employee_id, date_key, absence_type, is_approved)
    select distinct on (x.employee_id, x.date_key)
           x.employee_id, x.date_key, x.absence_type, x.is_approved
    from jsonb_to_recordset(v_items) as x(employee_id int, date_key date,
           absence_type text, is_approved boolean)
    order by x.employee_id, x.date_key, x.absence_type, x.is_approved
    on conflict (employee_id, date_key) do update
      set absence_type = excluded.absence_type,
          is_approved = excluded.is_approved;
    get diagnostics v_applied = row_count;

    insert into audit.snapshot_state (entity, fingerprint, rows_count)
    values ('absences', v_fp, v_rows)
    on conflict (entity) do update set fingerprint = excluded.fingerprint,
                                       rows_count = excluded.rows_count,
                                       applied_at = now();
  else
    update audit.merge_log set status = 'rejected_unknown', finished_at = now()
     where batch_id = p_batch_id;
    return query select 'rejected_unknown'::text, v_rows, 0, 'unknown entity'::text;
    return;
  end if;

  update audit.merge_log set status = 'merged', rows_applied = v_applied,
         finished_at = now() where batch_id = p_batch_id;

  return query select 'merged'::text, v_rows, v_applied, null::text;

exception when others then
  update audit.merge_log set status = 'failed', note = sqlerrm,
         finished_at = now() where batch_id = p_batch_id;
  raise;
end;
$$;
