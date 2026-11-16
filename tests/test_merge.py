import os
import uuid

import psycopg
import pytest

from loader import load, merge

DATABASE_URL = os.environ["DATABASE_URL"]

TEST_DEPT_ID = 9000
TEST_EMP_IDS = list(range(9100, 9200))
BATCH_PREFIXES = ("dept-", "emp-", "abs-")


@pytest.fixture()
def conn():
    with psycopg.connect(DATABASE_URL, autocommit=True) as c:
        yield c


@pytest.fixture()
def cleanup(conn):
    """Тесты пишут в общие таблицы — после себя убираем и возвращаем состояние снимка."""
    with conn.cursor() as cur:
        cur.execute(
            "select fingerprint, rows_count from audit.snapshot_state where entity = 'absences'"
        )
        prev = cur.fetchone()

    yield

    with conn.cursor() as cur:
        cur.execute("delete from master.absences where employee_id = any(%s)", (TEST_EMP_IDS,))
        cur.execute("delete from master.employees where bi_id = any(%s)", (TEST_EMP_IDS,))
        cur.execute("delete from master.departments where bi_id = %s", (TEST_DEPT_ID,))
        for prefix in BATCH_PREFIXES:
            cur.execute(
                "delete from audit.merge_log where batch_id like %s", (prefix + "%",)
            )
            cur.execute(
                "delete from staging.incoming_batches where batch_id like %s", (prefix + "%",)
            )
        cur.execute("delete from audit.snapshot_state where entity = 'absences'")
        if prev:
            cur.execute(
                "insert into audit.snapshot_state (entity, fingerprint, rows_count)"
                " values ('absences', %s, %s)",
                prev,
            )


def _employees():
    return [
        {
            "bi_id": i,
            "full_name": f"Тест {i}",
            "dept_id": 1,
            "position": "Специалист",
            "schedule_type": "office",
            "planned_arrival": "09:00",
            "planned_departure": "18:00",
            "is_active": True,
            "has_scud": True,
            "updated_at": "2026-01-01T00:00:00+03:00",
        }
        for i in TEST_EMP_IDS
    ]


def test_merge_is_idempotent(conn, cleanup):
    suffix = uuid.uuid4().hex[:6]
    dept = {"bi_id": TEST_DEPT_ID, "name": f"Тестовый {suffix}", "parent_id": None}
    status, rows_in, applied = load(conn, "departments", [dept], f"dept-{suffix}")
    assert status == "merged"
    assert applied == 1

    again = merge(conn, "departments", f"dept-{suffix}")
    assert again[0] == "skipped"
    assert again[2] == 0


def test_absences_snapshot_rejected_when_smaller(conn, cleanup):
    suffix = uuid.uuid4().hex[:6]
    load(conn, "employees", _employees(), f"emp-{suffix}")

    # Чистим состояние снимка, чтобы тест не зависел от сида.
    with conn.cursor() as cur:
        cur.execute("delete from audit.snapshot_state where entity = 'absences'")

    full = [
        {
            "employee_id": i,
            "date_key": "2026-02-01",
            "absence_type": "vacation",
            "is_approved": True,
        }
        for i in TEST_EMP_IDS
    ]
    status, _, applied = load(conn, "absences", full, f"abs-full-{suffix}")
    assert status == "merged"
    assert applied == len(full)

    partial = full[:40]
    status, _, applied = load(conn, "absences", partial, f"abs-part-{suffix}")
    assert status == "rejected_partial"
    assert applied == 0

    status, _, _ = load(conn, "absences", full, f"abs-same-{suffix}")
    assert status == "skipped_same"


def test_absences_deduplicate_within_batch(conn, cleanup):
    suffix = uuid.uuid4().hex[:6]
    load(conn, "employees", _employees()[:2], f"emp-{suffix}")

    with conn.cursor() as cur:
        cur.execute("delete from audit.snapshot_state where entity = 'absences'")

    rows = [
        {"employee_id": TEST_EMP_IDS[0], "date_key": "2026-02-02",
         "absence_type": "vacation", "is_approved": True},
        {"employee_id": TEST_EMP_IDS[0], "date_key": "2026-02-02",
         "absence_type": "sick", "is_approved": False},
        {"employee_id": TEST_EMP_IDS[1], "date_key": "2026-02-02",
         "absence_type": "sick", "is_approved": True},
    ]
    status, _, applied = load(conn, "absences", rows, f"abs-dup-{suffix}")
    assert status == "merged"
    assert applied == 2

    with conn.cursor() as cur:
        cur.execute(
            "select count(*) from master.absences where employee_id = any(%s)",
            (TEST_EMP_IDS[:2],),
        )
        assert cur.fetchone()[0] == 2
