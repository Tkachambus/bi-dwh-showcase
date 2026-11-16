import os

import psycopg
import pytest

DATABASE_URL = os.environ["DATABASE_URL"]


@pytest.fixture(scope="module")
def conn():
    with psycopg.connect(DATABASE_URL, autocommit=True) as c:
        yield c


def scalar(conn, sql, params=None):
    with conn.cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchone()[0]


def rows(conn, sql, params=None):
    with conn.cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchall()


def test_no_duplicate_keys(conn):
    assert scalar(conn, """
        select count(*) from (
          select employee_id, date_key from dm.mv_attendance_day
          group by 1, 2 having count(*) > 1
        ) t
    """) == 0


def test_late_requires_entry_and_non_negative_minutes(conn):
    assert scalar(conn, """
        select count(*) from dm.mv_attendance_day
        where is_late and first_in is null
    """) == 0
    assert scalar(conn, """
        select count(*) from dm.mv_attendance_day
        where late_minutes is not null and late_minutes < 0
    """) == 0


def test_remote_and_field_are_never_late(conn):
    assert scalar(conn, """
        select count(*) from dm.mv_attendance_day
        where is_late and schedule_type in ('remote', 'field')
    """) == 0


def test_no_scud_employees_are_outside_metrics(conn):
    assert scalar(conn, """
        select count(*) from dm.mv_attendance_day
        where not has_scud and (is_late or absence_type is not null)
    """) == 0


def test_duration_is_not_negative(conn):
    assert scalar(conn, """
        select count(*) from dm.mv_attendance_day where duration_sec < 0
    """) == 0


def _python_discipline(conn, dept_id, date_from, date_to):
    """Повторяет формулу dm.dept_period на тех же строках витрины."""
    row = rows(conn, """
        with recursive sub as (
          select bi_id from master.departments where bi_id = %s
          union all
          select d.bi_id from master.departments d join sub s on d.parent_id = s.bi_id
        )
        select m.is_workday,
               m.has_scud,
               m.schedule_type,
               m.first_in is null as no_entry,
               m.is_late,
               (m.absence_type is not null and m.absence_approved) as approved
        from dm.mv_attendance_day m
        where m.dept_id in (select bi_id from sub)
          and m.date_key between %s and %s
    """, (dept_id, date_from, date_to))

    planned = late = absence = 0
    for is_workday, has_scud, schedule, no_entry, is_late, approved in row:
        if not has_scud:
            continue
        if is_workday and schedule in ("office", "shift") and not approved:
            planned += 1
            if no_entry:
                absence += 1
        if is_late:
            late += 1
    if planned == 0:
        return None
    return round((planned - late - absence) * 100.0 / planned, 1)


def test_discipline_matches_python(conn):
    today = scalar(conn, "select max(date_key) from dm.mv_attendance_day")
    date_from = scalar(conn, "select min(date_key) from dm.mv_attendance_day")
    dept_ids = [r[0] for r in rows(conn, "select bi_id from master.departments order by bi_id")]

    sql_values = {
        r[0]: r[1]
        for r in rows(conn, """
            select dept_id, discipline from dm.dept_period(%s, %s)
        """, (date_from, today))
    }

    checked = 0
    for dept_id in dept_ids:
        py = _python_discipline(conn, dept_id, date_from, today)
        sql = sql_values.get(dept_id)
        if py is None:
            assert sql is None, f"dept {dept_id}: expected null, got {sql}"
        else:
            assert sql is not None, f"dept {dept_id}: expected {py}, got null"
            assert abs(float(sql) - py) <= 0.1, f"dept {dept_id}: sql={sql} py={py}"
            checked += 1
    assert checked > 0


def test_discipline_is_null_without_planned_days(conn):
    values = [
        r[0] for r in rows(conn, """
            select discipline from dm.dept_period('2020-01-01', '2020-01-02')
        """)
    ]
    assert values and all(v is None for v in values)
