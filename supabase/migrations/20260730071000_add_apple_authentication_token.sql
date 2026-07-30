alter table wallet_passes
  add column if not exists apple_authentication_token text;

update wallet_passes
set apple_authentication_token = id::text
where apple_authentication_token is null;

alter table wallet_passes
  alter column apple_authentication_token set not null;

create unique index if not exists wallet_passes_apple_authentication_token_key
  on wallet_passes(apple_authentication_token);
