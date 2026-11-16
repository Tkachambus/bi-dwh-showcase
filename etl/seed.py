"""Детерминированная синтетика СКУД. Никаких реальных данных и имён.

Модель:
- 12 департаментов на 5 уровнях: 3 управления → департаменты → отделы → подотделы;
- 250 сотрудников, графики office/remote/field/shift = 78/12/6/4%;
- 4% без СКУД, 4% неактивных;
- 180 календарных дней, события только по рабочим дням;
- опоздания 18%, ранние уходы 6%, отсутствия 2% (70% согласованы).
"""
import hashlib
import os
import random
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import psycopg

from loader import load

SEED = int(os.environ.get("SEED", "42"))
TZ = ZoneInfo("Europe/Moscow")
DAYS = 180
EMPLOYEES = 250

# (bi_id, name, parent_id) — ровно 12 узлов, 5 уровней вместе с корнем «Все».
DEPARTMENTS = [
    (1, "Управление операций", None),
    (2, "Управление коммерции", None),
    (3, "Управление аналитики", None),
    (4, "Департамент продаж", 1),
    (5, "Департамент сервиса", 1),
    (6, "Департамент данных", 2),
    (7, "Департамент поддержки", 3),
    (8, "Отдел смен", 4),
    (9, "Отдел сопровождения", 4),
    (10, "Отдел внедрения", 5),
    (11, "Подотдел ночной смены", 8),
    (12, "Подотдел выездной", 8),
]

# Куда сажаем сотрудников: промежуточные узлы тоже имеют людей.
DEPT_WEIGHTS = [
    (4, 12), (5, 12),
    (6, 10), (7, 8),
    (8, 45), (9, 40), (10, 38),
    (11, 45), (12, 40),
]

SCHEDULES = ["office", "remote", "field", "shift"]
SCHEDULE_WEIGHTS = [0.78, 0.12, 0.06, 0.04]
ABSENCE_TYPES = ["vacation", "sick", "remote"]
POSITIONS = {
    "office": ["Специалист", "Старший специалист", "Ведущий специалист"],
    "remote": ["Аналитик", "Старший аналитик", "Методолог"],
    "field": ["Инженер", "Сервисный инженер", "Техник"],
    "shift": ["Оператор", "Старший оператор", "Начальник смены"],
}


def seed_today() -> date:
    """Дата «сегодня». По умолчанию — фактическая, но на выходных берём пятницу,
    иначе демо открывается с пустым «в офисе сейчас»."""
    raw = os.environ.get("TODAY", "").strip()
    if raw:
        day = date.fromisoformat(raw)
    else:
        day = datetime.now(TZ).date()
    while day.isoweekday() >= 6:
        day -= timedelta(days=1)
    return day


def at(day: date, hh: int, mm: int) -> datetime:
    return datetime.combine(day, time(hh, mm), TZ)


def build_departments():
    return [
        {"bi_id": bi_id, "name": name, "parent_id": parent_id}
        for bi_id, name, parent_id in DEPARTMENTS
    ]


def build_employees(rnd: random.Random):
    dept_ids = [d for d, w in DEPT_WEIGHTS for _ in range(w)]
    rnd.shuffle(dept_ids)

    items = []
    for i in range(1, EMPLOYEES + 1):
        schedule = rnd.choices(SCHEDULES, weights=SCHEDULE_WEIGHTS)[0]
        if schedule == "shift":
            arrival = time(8 if i % 2 == 0 else 9, 0)
            departure = time(17 if i % 2 == 0 else 18, 0)
        else:
            arrival = time(9, rnd.randint(0, 15))
            departure = time(18, 0)

        # 231–240 — активные без СКУД, 241–250 — неактивные.
        has_scud = not (231 <= i <= 240)
        is_active = not (241 <= i <= 250)

        items.append(
            {
                "bi_id": i,
                "full_name": f"Сотрудник {i:03d}",
                "dept_id": dept_ids[i - 1],
                "position": rnd.choice(POSITIONS[schedule]),
                "schedule_type": schedule,
                "planned_arrival": arrival.isoformat(),
                "planned_departure": departure.isoformat(),
                "is_active": is_active,
                "has_scud": has_scud,
                "updated_at": datetime.now(TZ).isoformat(),
            }
        )
    return items


def event_id(day: date, employee_id: int, direction: str) -> int:
    """Стабильный id: повторный сид не плодит дубли, а новые даты получают новые id."""
    return day.toordinal() * 1_000_000 + employee_id * 2 + (1 if direction == "OUT" else 0)


def build_events_and_absences(rnd: random.Random, employees, today: date):
    events = []
    absences = []
    seen_absences = set()

    scud_employees = [e for e in employees if e["is_active"] and e["has_scud"]]

    for offset in range(DAYS - 1, -1, -1):
        day = today - timedelta(days=offset)
        if day.isoweekday() >= 6:
            continue

        for emp in scud_employees:
            emp_id = emp["bi_id"]
            schedule = emp["schedule_type"]

            # 2% дней — запись об отсутствии; 70% согласованы.
            if rnd.random() < 0.02:
                key = (emp_id, day)
                if key not in seen_absences:
                    seen_absences.add(key)
                    absences.append(
                        {
                            "employee_id": emp_id,
                            "date_key": day.isoformat(),
                            "absence_type": rnd.choice(ABSENCE_TYPES),
                            "is_approved": rnd.random() < 0.70,
                        }
                    )
                continue

            # 5% — прогул без записи (несогласованное отсутствие).
            if rnd.random() < 0.05:
                continue

            arrival_h, arrival_m = map(int, emp["planned_arrival"].split(":")[:2])
            departure_h, departure_m = map(int, emp["planned_departure"].split(":")[:2])

            late = rnd.random() < 0.18
            if late:
                in_dt = at(day, arrival_h, arrival_m) + timedelta(minutes=rnd.randint(6, 60))
            else:
                in_dt = at(day, arrival_h, arrival_m) + timedelta(minutes=rnd.randint(-10, 4))

            early = rnd.random() < 0.06
            if early:
                out_dt = at(day, departure_h, departure_m) - timedelta(minutes=rnd.randint(6, 60))
            else:
                out_dt = at(day, departure_h, departure_m) + timedelta(minutes=rnd.randint(0, 50))

            duration_h = 8 if schedule != "shift" else 8
            if out_dt <= in_dt + timedelta(hours=1):
                out_dt = in_dt + timedelta(hours=duration_h, minutes=rnd.randint(0, 40))

            events.append(
                {
                    "bi_id": event_id(day, emp_id, "IN"),
                    "employee_id": emp_id,
                    "direction": "IN",
                    "ts": in_dt.isoformat(),
                }
            )

            # Сегодня часть сотрудников ещё в офисе — OUT не пишем.
            if day == today and rnd.random() < 0.45:
                continue

            events.append(
                {
                    "bi_id": event_id(day, emp_id, "OUT"),
                    "employee_id": emp_id,
                    "direction": "OUT",
                    "ts": out_dt.isoformat(),
                }
            )

    events.sort(key=lambda x: x["bi_id"])
    absences.sort(key=lambda x: (x["employee_id"], x["date_key"]))
    return events, absences


def main():
    rnd = random.Random(SEED)
    today = seed_today()

    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as conn:
        departments = build_departments()
        load(conn, "departments", departments)

        employees = build_employees(rnd)
        load(conn, "employees", employees)

        events, absences = build_events_and_absences(rnd, employees, today)
        for start in range(0, len(events), 5000):
            load(conn, "events", events[start:start + 5000])

        load(conn, "absences", absences)

        with conn.cursor() as cur:
            cur.execute(
                "insert into master.meta (key, value, updated_at) values"
                " ('today', %s, now()), ('seed', %s, now()), ('seed_version', 'skud-1', now())"
                " on conflict (key) do update set value = excluded.value, updated_at = now()",
                (today.isoformat(), str(SEED)),
            )
            cur.execute("select dm.refresh_attendance()")

        digest = hashlib.sha1(
            f"{SEED}|{today}|{len(events)}|{len(absences)}".encode()
        ).hexdigest()[:12]
        print(
            "seed done:",
            {
                "today": today.isoformat(),
                "departments": len(departments),
                "employees": len(employees),
                "events": len(events),
                "absences": len(absences),
                "digest": digest,
            },
            flush=True,
        )


if __name__ == "__main__":
    main()
