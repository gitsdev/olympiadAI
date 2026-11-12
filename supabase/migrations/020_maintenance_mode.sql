-- OlympiadIQ — Site maintenance mode
-- Single-row flag toggled from /admin/dashboard. When enabled, the proxy
-- (src/lib/supabase/middleware.ts) sends every non-admin request to
-- /maintenance (pages) or a 503 (API). Platform admins are unaffected.
--
-- Access model:
--   * Anyone (anon + authenticated) may SELECT — the proxy reads the flag
--     with the anon key before it knows who the visitor is. The row holds
--     nothing sensitive.
--   * No insert/update/delete policies — writes go through the
--     requireAdmin()-gated server action using the service role.

create table if not exists site_status (
  id                  smallint primary key default 1 check (id = 1),
  maintenance_mode    boolean not null default false,
  maintenance_message text,
  updated_at          timestamptz not null default now(),
  updated_by          uuid references profiles(id) on delete set null
);
insert into site_status (id) values (1) on conflict (id) do nothing;

alter table site_status enable row level security;

drop policy if exists "public read site status" on site_status;
create policy "public read site status" on site_status
  for select to anon, authenticated using (true);

drop trigger if exists trg_site_status_updated_at on site_status;
create trigger trg_site_status_updated_at
  before update on site_status
  for each row execute procedure update_updated_at();
