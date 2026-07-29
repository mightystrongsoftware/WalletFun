create table if not exists wallet_passes (
  id uuid primary key default gen_random_uuid(),
  serial_number text not null unique,
  first_name text not null,
  last_name text not null,
  status text not null check (status in ('created', 'updated', 'voided')),
  update_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pass_updates (
  id uuid primary key default gen_random_uuid(),
  pass_id uuid not null references wallet_passes(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists device_registrations (
  device_library_identifier text not null,
  pass_type_identifier text not null,
  serial_number text not null,
  push_token text not null,
  created_at timestamptz not null default now(),
  primary key (device_library_identifier, pass_type_identifier, serial_number)
);

