"""Отправка батчей в staging и запуск merge. Всё локально, сеть не используется."""
import json
import os
import uuid

import psycopg

DATABASE_URL = os.environ["DATABASE_URL"]


def _connect():
    return psycopg.connect(DATABASE_URL, autocommit=True)


def put_batch(conn, entity: str, items: list[dict], batch_id: str | None = None) -> str:
    batch_id = batch_id or f"{entity}-{uuid.uuid4().hex[:12]}"
    with conn.cursor() as cur:
        cur.execute(
            "insert into staging.incoming_batches (batch_id, entity, items)"
            " values (%s, %s, %s::jsonb) on conflict (batch_id) do nothing",
            (batch_id, entity, json.dumps(items, ensure_ascii=False)),
        )
    return batch_id


def merge(conn, entity: str, batch_id: str) -> tuple[str, int, int]:
    with conn.cursor() as cur:
        cur.execute("select * from master.merge_batch(%s, %s)", (entity, batch_id))
        status, rows_in, rows_applied, _note = cur.fetchone()
    return status, rows_in, rows_applied


def load(conn, entity: str, items: list[dict], batch_id: str | None = None):
    bid = put_batch(conn, entity, items, batch_id)
    return merge(conn, entity, bid)
