/**
 * Собирает компактный снапшот из Postgres.
 * Один и тот же файл читает SSR-страница и статическая сборка GitHub Pages.
 *
 *   DATABASE_URL=postgresql://pulse:pulse@localhost:55432/pulse npm run snapshot
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://pulse:pulse@localhost:55432/pulse';

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const outFile = path.join(import.meta.dirname, '..', 'public', 'data', 'snapshot.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });

async function one(sql) {
  const { rows } = await pool.query(sql);
  return rows[0];
}

async function many(sql) {
  const { rows } = await pool.query(sql);
  return rows;
}

const meta = await many("select key, value from master.meta");
const metaMap = Object.fromEntries(meta.map((r) => [r.key, r.value]));

const bounds = await one(`
  select min(date_key)::text as date_from, max(date_key)::text as date_to
  from dm.mv_attendance_day
`);

const today =
  metaMap.today ||
  (await one(`
    select max((ts at time zone 'Europe/Moscow')::date)::text as today
    from master.events
  `))?.today ||
  bounds.date_to;

const departments = (await many(`
  select bi_id as id, name, parent_id as "parentId"
  from master.departments
  order by bi_id
`)).map((d) => ({ ...d, id: Number(d.id), parentId: d.parentId == null ? null : Number(d.parentId) }));

const employees = (await many(`
  select bi_id as id,
         full_name as "fullName",
         dept_id as "deptId",
         coalesce(position, '') as position,
         schedule_type as "scheduleType",
         to_char(planned_arrival, 'HH24:MI') as "plannedArrival",
         to_char(planned_departure, 'HH24:MI') as "plannedDeparture",
         is_active as "isActive",
         has_scud as "hasScud"
  from master.employees
  where is_active
  order by bi_id
`)).map((e) => ({
  ...e,
  id: Number(e.id),
  deptId: Number(e.deptId),
}));

const calendar = (await many(`
  select date_key::text as date, is_workday
  from master.calendar
  where date_key between (select min(date_key) from dm.mv_attendance_day)
                    and (select max(date_key) from dm.mv_attendance_day)
  order by date_key
`)).map((r) => [r.date, r.is_workday ? 1 : 0]);

const days = (await many(`
  select employee_id,
         dept_id,
         date_key::text as date,
         to_char(first_in at time zone 'Europe/Moscow', 'HH24:MI') as first_in,
         to_char(last_out at time zone 'Europe/Moscow', 'HH24:MI') as last_out,
         duration_sec,
         is_late,
         late_minutes,
         is_early_leave,
         absence_type,
         absence_approved,
         has_scud,
         schedule_type,
         is_workday
  from dm.mv_attendance_day
  order by employee_id, date_key
`)).map((r) => [
  Number(r.employee_id),
  Number(r.dept_id),
  r.date,
  r.first_in,
  r.last_out,
  r.duration_sec == null ? null : Number(r.duration_sec),
  r.is_late ? 1 : 0,
  r.late_minutes == null ? null : Number(r.late_minutes),
  r.is_early_leave ? 1 : 0,
  r.absence_type,
  r.absence_approved ? 1 : 0,
  r.has_scud ? 1 : 0,
  r.schedule_type,
  r.is_workday ? 1 : 0,
]);

const officeNow = (await many(`
  select employee_id, to_char(ts at time zone 'Europe/Moscow', 'HH24:MI') as ts
  from dm.v_office_now
  order by employee_id
`)).map((r) => ({ employeeId: Number(r.employee_id), ts: r.ts }));

const snapshot = {
  version: 1,
  generatedAt: new Date().toISOString(),
  today,
  dateFrom: bounds.date_from,
  dateTo: bounds.date_to,
  departments,
  employees,
  calendar,
  days,
  officeNow,
};

fs.writeFileSync(outFile, JSON.stringify(snapshot));
const size = fs.statSync(outFile).size;
console.log(
  `snapshot: ${departments.length} depts, ${employees.length} employees, ` +
  `${days.length} days, ${officeNow.length} in office, ` +
  `${(size / 1024 / 1024).toFixed(2)} MB`,
);

await pool.end();
