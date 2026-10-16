-- OlympiadIQ — Email OTP verification at signup
-- New signups get a 6-digit code by email (sent via Brevo, see
-- src/lib/email-verification.ts) and can't use the app until they enter it.
--
-- Existing users are marked verified: the column is added with DEFAULT true so
-- every current row is backfilled, then the default flips to false for new rows.

alter table profiles
  add column if not exists email_verified boolean not null default true,
  add column if not exists email_verified_at timestamptz;

update profiles set email_verified_at = coalesce(email_verified_at, created_at)
  where email_verified and email_verified_at is null;

alter table profiles alter column email_verified set default false;

-- Accounts created under Supabase's own "Confirm email" flow that never clicked
-- the link can't sign in at all. Treat them as existing users too, so they can
-- log in now that verification is handled by our OTP flow.
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;

-- One active code per user. Only a hash of the code is stored. Accessed only
-- through the service role — RLS on with no policies blocks anon/authenticated.
create table if not exists email_verification_codes (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  code_hash          text not null,
  expires_at         timestamptz not null,
  attempts           int not null default 0,
  last_sent_at       timestamptz not null default now(),
  window_started_at  timestamptz not null default now(),
  sends_in_window    int not null default 1
);

alter table email_verification_codes enable row level security;
