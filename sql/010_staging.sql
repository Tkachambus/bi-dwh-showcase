create table if not exists staging.incoming_batches (
  batch_id    text primary key,
  entity      text not null,
  items       jsonb not null,
  rows_count  int not null generated always as (jsonb_array_length(items)) stored,
  received_at timestamptz not null default now()
);

create table if not exists audit.merge_log (
  id bigserial primary key,
  batch_id text not null unique,
  entity text not null,
  status text not null,
  rows_in int,
  rows_applied int,
  note text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists audit.snapshot_state (
  entity text primary key,
  fingerprint text not null,
  rows_count int not null,
  applied_at timestamptz not null default now()
);
