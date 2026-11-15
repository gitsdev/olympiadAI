-- OlympiadIQ — Credit Wallet System
-- Prepaid credits (1 credit = ₹1) bought through Razorpay and spent on
-- credit-based features. Additive only: new tables, functions and one new
-- trigger on profiles. Does not alter any existing column or policy.
-- Safe to re-run in the Supabase SQL editor.
--
-- Access model
--   * Students may SELECT only their own wallet, transactions and purchases
--     (RLS). They have no insert/update/delete path at all.
--   * Every balance change goes through credit_apply() (SECURITY DEFINER),
--     which locks the wallet row, enforces idempotency and writes the ledger
--     entry in the same transaction. The functions are executable only by
--     service_role, i.e. by server code that has already authenticated and
--     authorised the caller.
--   * The ledger (credit_transactions) is append-only: a trigger rejects
--     UPDATE and DELETE for every role.
--   * Wallet balances can only change inside credit_apply(): a trigger
--     rejects direct balance writes, even from the service role.
--
-- Eligibility: a "student" is a profiles row with role = 'student' — the
-- same mechanism the rest of the app uses. Admins and parents never get
-- welcome credits.

-- ── Wallets ─────────────────────────────────────────────────────────────
create table if not exists credit_wallets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  balance     bigint not null default 0 check (balance >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Ledger ──────────────────────────────────────────────────────────────
-- user_id is nullable + ON DELETE SET NULL so deleting an account never
-- deletes financial history.
create table if not exists credit_transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,
  transaction_type  text not null
    check (transaction_type in ('welcome', 'purchase', 'usage', 'refund', 'admin_adjustment')),
  amount            bigint not null check (amount <> 0),
  balance_after     bigint not null check (balance_after >= 0),
  feature_key       text,
  reference_id      text,
  idempotency_key   text not null unique,
  description       text,
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  -- Additions are positive, deductions negative. Refunds and admin
  -- adjustments can go either way (a usage reversal adds, a purchase
  -- refund removes).
  constraint credit_tx_sign check (
    (transaction_type in ('welcome', 'purchase') and amount > 0)
    or (transaction_type = 'usage' and amount < 0)
    or transaction_type in ('refund', 'admin_adjustment')
  )
);

create index if not exists idx_credit_tx_user_created on credit_transactions(user_id, created_at desc);
create index if not exists idx_credit_tx_created      on credit_transactions(created_at desc);
create index if not exists idx_credit_tx_type         on credit_transactions(transaction_type);
create index if not exists idx_credit_tx_feature      on credit_transactions(feature_key) where feature_key is not null;
create index if not exists idx_credit_tx_reference    on credit_transactions(reference_id) where reference_id is not null;
-- At most one welcome grant per user, ever.
create unique index if not exists uq_credit_tx_welcome_once
  on credit_transactions(user_id) where transaction_type = 'welcome';

-- ── Purchases ───────────────────────────────────────────────────────────
create table if not exists credit_purchases (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users(id) on delete set null,
  credits              bigint not null check (credits > 0),
  amount_paise         bigint not null check (amount_paise > 0),
  currency             text not null default 'INR' check (currency = 'INR'),
  razorpay_order_id    text not null unique,
  razorpay_payment_id  text unique,
  status               text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  refunded_credits     bigint not null default 0 check (refunded_credits >= 0),
  refunded_paise       bigint not null default 0 check (refunded_paise >= 0),
  created_at           timestamptz not null default now(),
  paid_at              timestamptz,
  updated_at           timestamptz not null default now(),
  metadata             jsonb not null default '{}',
  constraint credit_purchase_refund_bounds check (refunded_paise <= amount_paise and refunded_credits <= credits)
);

create index if not exists idx_credit_purchases_user    on credit_purchases(user_id, created_at desc);
create index if not exists idx_credit_purchases_status  on credit_purchases(status, created_at desc);
create index if not exists idx_credit_purchases_created on credit_purchases(created_at desc);

-- ── Feature pricing (admin-configurable; no prices hardcoded) ───────────
create table if not exists feature_credit_costs (
  id           uuid primary key default gen_random_uuid(),
  feature_key  text not null unique check (feature_key ~ '^[a-z][a-z0-9_]{1,49}$'),
  feature_name text not null check (length(trim(feature_name)) between 1 and 80),
  -- NULL = not priced yet. A feature only charges when it is enabled AND
  -- has a positive cost; otherwise it stays free.
  credit_cost  integer check (credit_cost is null or credit_cost >= 0),
  is_enabled   boolean not null default false,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references profiles(id) on delete set null
);

insert into feature_credit_costs (feature_key, feature_name) values
  ('ai_tutor',      'AI Tutor'),
  ('mock_test',     'Mock Tests'),
  ('friend_battle', 'Battle with Friends'),
  ('brain_booster', 'Brain Booster Games')
on conflict (feature_key) do nothing;

-- ── Credit admins ───────────────────────────────────────────────────────
-- Not a separate admin system: a user must ALREADY be a platform_admin
-- (profiles.role) to reach any credit admin screen. This table only scopes
-- money-moving powers among platform admins:
--   admin       — view everything, edit feature pricing, manual adjustments
--   super_admin — everything above + purchase refunds + managing this table
create table if not exists credit_admins (
  user_id    uuid primary key references profiles(id) on delete cascade,
  role       text not null check (role in ('super_admin', 'admin')),
  created_at timestamptz not null default now()
);

-- Existing platform admins start as credit super admins.
insert into credit_admins (user_id, role)
select id, 'super_admin' from profiles where role = 'platform_admin'
on conflict (user_id) do nothing;

-- ── Webhook events (dedupe + replay protection) ─────────────────────────
create table if not exists credit_webhook_events (
  id            uuid primary key default gen_random_uuid(),
  event_id      text not null unique,
  event_type    text not null,
  processed     boolean not null default false,
  processed_at  timestamptz,
  attempts      integer not null default 0,
  last_error    text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_credit_webhook_created on credit_webhook_events(created_at desc);

-- ── updated_at triggers ─────────────────────────────────────────────────
drop trigger if exists trg_credit_wallets_updated_at on credit_wallets;
create trigger trg_credit_wallets_updated_at before update on credit_wallets
  for each row execute procedure update_updated_at();
drop trigger if exists trg_credit_purchases_updated_at on credit_purchases;
create trigger trg_credit_purchases_updated_at before update on credit_purchases
  for each row execute procedure update_updated_at();
drop trigger if exists trg_feature_credit_costs_updated_at on feature_credit_costs;
create trigger trg_feature_credit_costs_updated_at before update on feature_credit_costs
  for each row execute procedure update_updated_at();

-- ── Guards: append-only ledger, balance only via credit_apply() ─────────
create or replace function credit_tx_immutable()
returns trigger language plpgsql as $$
begin
  -- ON DELETE SET NULL from auth.users is the one permitted change.
  if tg_op = 'UPDATE'
     and new.user_id is null and old.user_id is not null
     and (to_jsonb(new) - 'user_id') = (to_jsonb(old) - 'user_id') then
    return new;
  end if;
  raise exception 'credit_transactions is append-only' using errcode = '42501';
end;
$$;

drop trigger if exists trg_credit_tx_immutable on credit_transactions;
create trigger trg_credit_tx_immutable before update or delete on credit_transactions
  for each row execute procedure credit_tx_immutable();

create or replace function credit_wallet_guard()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT' and new.balance <> 0)
     or (tg_op = 'UPDATE' and new.balance is distinct from old.balance) then
    if coalesce(current_setting('credits.in_apply', true), '') <> 'on' then
      raise exception 'wallet balances change only through credit_apply()' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_credit_wallet_guard on credit_wallets;
create trigger trg_credit_wallet_guard before insert or update on credit_wallets
  for each row execute procedure credit_wallet_guard();

-- ── Core: the only way to change a balance ──────────────────────────────
-- Locks the wallet row (SELECT … FOR UPDATE), so concurrent calls for one
-- user are serialised; the idempotency check runs under that lock, so a
-- repeated key returns the original transaction instead of applying twice.
-- Raises INSUFFICIENT_CREDITS rather than letting a balance go negative.
create or replace function credit_apply(
  p_user_id uuid,
  p_type text,
  p_amount bigint,
  p_idempotency_key text,
  p_feature_key text default null,
  p_reference_id text default null,
  p_description text default null,
  p_metadata jsonb default '{}'
)
returns table (transaction_id uuid, balance bigint, duplicate boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_balance bigint;
  v_existing credit_transactions%rowtype;
  v_tx_id uuid;
begin
  if p_user_id is null then raise exception 'INVALID_USER'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 1 and 200 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  -- Ensure the wallet exists, then lock it.
  insert into credit_wallets (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select w.balance into v_balance from credit_wallets w where w.user_id = p_user_id for update;

  select * into v_existing from credit_transactions t where t.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.user_id is distinct from p_user_id then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return query select v_existing.id, v_balance, true;
    return;
  end if;

  if v_balance + p_amount < 0 then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  perform set_config('credits.in_apply', 'on', true);
  update credit_wallets w set balance = v_balance + p_amount where w.user_id = p_user_id;
  perform set_config('credits.in_apply', 'off', true);

  insert into credit_transactions (
    user_id, transaction_type, amount, balance_after, feature_key,
    reference_id, idempotency_key, description, metadata
  ) values (
    p_user_id, p_type, p_amount, v_balance + p_amount, p_feature_key,
    p_reference_id, p_idempotency_key, p_description, coalesce(p_metadata, '{}')
  ) returning id into v_tx_id;

  return query select v_tx_id, v_balance + p_amount, false;
end;
$$;

-- ── Welcome credits ─────────────────────────────────────────────────────
create or replace function credit_is_eligible_student(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_user_id and role = 'student');
$$;

-- Returns 'granted', 'already_granted' or 'not_eligible'.
create or replace function credit_grant_welcome(p_user_id uuid, p_amount bigint default 25)
returns text language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if not credit_is_eligible_student(p_user_id) then
    return 'not_eligible';
  end if;
  if exists (select 1 from credit_transactions where user_id = p_user_id and transaction_type = 'welcome') then
    return 'already_granted';
  end if;
  select * into r from credit_apply(
    p_user_id, 'welcome', p_amount, 'welcome:' || p_user_id::text,
    null, null, 'Welcome credits', jsonb_build_object('source', 'welcome')
  );
  return case when r.duplicate then 'already_granted' else 'granted' end;
end;
$$;

-- Fires when a student profile is created (signup) or an account becomes a
-- student. Never blocks signup: any failure is logged as a warning and the
-- grant can be repaired later by re-running credit_grant_welcome().
create or replace function credit_profile_welcome_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'student' and (tg_op = 'INSERT' or old.role is distinct from new.role) then
    begin
      perform credit_grant_welcome(new.id);
    exception when others then
      raise warning 'welcome credits not granted for %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_credit_welcome on profiles;
create trigger trg_profiles_credit_welcome
  after insert or update of role on profiles
  for each row execute procedure credit_profile_welcome_trigger();

-- ── Feature deduction ───────────────────────────────────────────────────
-- Returns jsonb with a stable shape the app maps to API responses:
--   { ok: true,  status: 'charged'|'duplicate'|'free', cost, balance, transaction_id }
--   { ok: false, error: 'INSUFFICIENT_CREDITS'|'FEATURE_NOT_FOUND'|'NOT_ELIGIBLE', cost, balance }
-- 'free' = the feature is disabled for charging or not priced, so the
-- feature may start without consuming credits.
create or replace function credit_deduct(
  p_user_id uuid,
  p_feature_key text,
  p_idempotency_key text,
  p_reference_id text default null,
  p_metadata jsonb default '{}'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_feature feature_credit_costs%rowtype;
  v_balance bigint;
  r record;
begin
  select * into v_feature from feature_credit_costs where feature_key = p_feature_key;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'FEATURE_NOT_FOUND');
  end if;

  select coalesce((select balance from credit_wallets where user_id = p_user_id), 0) into v_balance;

  if not v_feature.is_enabled or coalesce(v_feature.credit_cost, 0) = 0 then
    return jsonb_build_object('ok', true, 'status', 'free', 'cost', 0, 'balance', v_balance, 'transaction_id', null);
  end if;

  if not credit_is_eligible_student(p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'NOT_ELIGIBLE', 'cost', v_feature.credit_cost, 'balance', v_balance);
  end if;

  begin
    select * into r from credit_apply(
      p_user_id, 'usage', -v_feature.credit_cost::bigint, 'usage:' || p_idempotency_key,
      p_feature_key, p_reference_id, v_feature.feature_name,
      coalesce(p_metadata, '{}') || jsonb_build_object('unit_cost', v_feature.credit_cost)
    );
  exception when raise_exception then
    if sqlerrm = 'INSUFFICIENT_CREDITS' then
      select coalesce((select balance from credit_wallets where user_id = p_user_id), 0) into v_balance;
      return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_CREDITS',
        'cost', v_feature.credit_cost, 'balance', v_balance);
    end if;
    raise;
  end;

  return jsonb_build_object(
    'ok', true,
    'status', case when r.duplicate then 'duplicate' else 'charged' end,
    'cost', v_feature.credit_cost, 'balance', r.balance, 'transaction_id', r.transaction_id
  );
end;
$$;

-- Reverses a usage charge when the feature failed BEFORE it started.
-- Idempotent (one reversal per usage transaction) and time-boxed so a
-- completed session cannot be refunded later through this path — late
-- corrections go through admin adjustments instead.
create or replace function credit_reverse_usage(
  p_user_id uuid,
  p_usage_transaction_id uuid,
  p_reason text,
  p_max_age_minutes integer default 60
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_usage credit_transactions%rowtype;
  r record;
begin
  select * into v_usage from credit_transactions where id = p_usage_transaction_id;
  if not found or v_usage.user_id is distinct from p_user_id or v_usage.transaction_type <> 'usage' then
    return jsonb_build_object('ok', false, 'error', 'USAGE_NOT_FOUND');
  end if;
  if v_usage.created_at < now() - make_interval(mins => p_max_age_minutes) then
    return jsonb_build_object('ok', false, 'error', 'REVERSAL_WINDOW_CLOSED');
  end if;
  select * into r from credit_apply(
    p_user_id, 'refund', -v_usage.amount, 'reversal:' || v_usage.id::text,
    v_usage.feature_key, v_usage.id::text, 'Refund: ' || coalesce(v_usage.description, v_usage.feature_key),
    jsonb_build_object('reason', left(coalesce(p_reason, ''), 500), 'reversed_transaction_id', v_usage.id)
  );
  return jsonb_build_object('ok', true, 'status', case when r.duplicate then 'duplicate' else 'reversed' end,
    'balance', r.balance, 'transaction_id', r.transaction_id);
end;
$$;

-- ── Purchase fulfilment ─────────────────────────────────────────────────
-- Called by both the Checkout verify route and the webhook, only after the
-- caller has verified a Razorpay signature. Locks the purchase row, checks
-- the paid amount/currency match the server-created order, then credits
-- the wallet exactly once (idempotency key = order id).
create or replace function credit_fulfil_purchase(
  p_order_id text,
  p_payment_id text,
  p_amount_paise bigint,
  p_currency text,
  p_source text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_p credit_purchases%rowtype;
  r record;
begin
  select * into v_p from credit_purchases where razorpay_order_id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'PURCHASE_NOT_FOUND');
  end if;

  if v_p.status in ('paid', 'refunded', 'partially_refunded') then
    return jsonb_build_object('ok', true, 'status', 'already_paid', 'user_id', v_p.user_id,
      'credits', v_p.credits, 'balance', (select balance from credit_wallets where user_id = v_p.user_id),
      'payment_mismatch', v_p.razorpay_payment_id is distinct from p_payment_id);
  end if;

  if p_amount_paise is distinct from v_p.amount_paise or upper(coalesce(p_currency, '')) <> v_p.currency then
    update credit_purchases
       set metadata = metadata || jsonb_build_object('amount_mismatch', jsonb_build_object(
             'payment_id', p_payment_id, 'amount_paise', p_amount_paise, 'currency', p_currency, 'at', now()))
     where id = v_p.id;
    return jsonb_build_object('ok', false, 'error', 'AMOUNT_MISMATCH');
  end if;

  if v_p.user_id is null then
    return jsonb_build_object('ok', false, 'error', 'PURCHASE_ORPHANED');
  end if;

  update credit_purchases
     set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = now(),
         metadata = metadata || jsonb_build_object('fulfilled_by', p_source)
   where id = v_p.id;

  select * into r from credit_apply(
    v_p.user_id, 'purchase', v_p.credits, 'purchase:' || p_order_id,
    null, v_p.id::text, v_p.credits || ' credits purchased',
    jsonb_build_object('razorpay_order_id', p_order_id, 'razorpay_payment_id', p_payment_id,
                       'amount_paise', v_p.amount_paise, 'source', p_source)
  );

  return jsonb_build_object('ok', true, 'status', 'paid', 'user_id', v_p.user_id,
    'credits', v_p.credits, 'balance', r.balance, 'transaction_id', r.transaction_id);
end;
$$;

-- A failed attempt only marks a still-pending purchase; Razorpay allows a
-- retry on the same order, and a later capture still fulfils it.
create or replace function credit_mark_purchase_failed(p_order_id text, p_payment_id text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  update credit_purchases
     set status = 'failed',
         metadata = metadata || jsonb_build_object('last_failure', jsonb_build_object(
           'payment_id', p_payment_id, 'reason', left(coalesce(p_reason, ''), 300), 'at', now()))
   where razorpay_order_id = p_order_id and status = 'pending'
  returning status into v_status;
  return jsonb_build_object('ok', true, 'updated', v_status is not null);
end;
$$;

-- Records a Razorpay refund against a purchase as a reversal ledger entry.
-- Idempotent per Razorpay refund id. Removes at most the credits the
-- student still holds (balances never go negative); any shortfall —
-- credits already spent — is recorded in metadata for the admin.
create or replace function credit_record_purchase_refund(
  p_order_id text,
  p_refund_id text,
  p_refund_paise bigint,
  p_admin_id uuid default null,
  p_reason text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_p credit_purchases%rowtype;
  v_credits bigint;
  v_balance bigint;
  v_remove bigint;
  v_tx_id uuid;
  r record;
begin
  if p_refund_paise is null or p_refund_paise <= 0 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  end if;

  select * into v_p from credit_purchases where razorpay_order_id = p_order_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'PURCHASE_NOT_FOUND'); end if;

  -- Already recorded? (same refund id seen via admin route and webhook)
  if exists (select 1 from credit_transactions where idempotency_key = 'purchase_refund:' || p_refund_id)
     or (v_p.metadata -> 'refund_ids') ? p_refund_id then
    return jsonb_build_object('ok', true, 'status', 'duplicate');
  end if;

  if v_p.status not in ('paid', 'partially_refunded') then
    return jsonb_build_object('ok', false, 'error', 'NOT_REFUNDABLE');
  end if;
  if v_p.refunded_paise + p_refund_paise > v_p.amount_paise then
    return jsonb_build_object('ok', false, 'error', 'REFUND_EXCEEDS_PAYMENT');
  end if;

  v_credits := least(v_p.credits - v_p.refunded_credits, p_refund_paise / 100);

  if v_p.user_id is not null and v_credits > 0 then
    insert into credit_wallets (user_id) values (v_p.user_id) on conflict (user_id) do nothing;
    select balance into v_balance from credit_wallets where user_id = v_p.user_id for update;
    v_remove := least(v_credits, v_balance);
    if v_remove > 0 then
      select * into r from credit_apply(
        v_p.user_id, 'refund', -v_remove, 'purchase_refund:' || p_refund_id,
        null, v_p.id::text, 'Purchase refund',
        jsonb_build_object('razorpay_order_id', p_order_id, 'razorpay_refund_id', p_refund_id,
          'refund_paise', p_refund_paise, 'credits_requested', v_credits, 'credits_removed', v_remove,
          'shortfall', v_credits - v_remove, 'admin_id', p_admin_id, 'reason', left(coalesce(p_reason, ''), 500))
      );
      v_tx_id := r.transaction_id;
      v_balance := r.balance;
    end if;
  end if;

  update credit_purchases
     set refunded_paise = refunded_paise + p_refund_paise,
         refunded_credits = refunded_credits + v_credits,
         status = case when refunded_paise + p_refund_paise >= amount_paise then 'refunded' else 'partially_refunded' end,
         metadata = jsonb_set(metadata, '{refund_ids}',
           coalesce(metadata -> 'refund_ids', '[]'::jsonb) || to_jsonb(p_refund_id))
   where id = v_p.id;

  return jsonb_build_object('ok', true, 'status', 'recorded', 'credits_removed', coalesce(v_remove, 0),
    'shortfall', v_credits - coalesce(v_remove, 0), 'balance', v_balance, 'transaction_id', v_tx_id);
end;
$$;

-- ── Admin adjustment ────────────────────────────────────────────────────
create or replace function credit_admin_adjust(
  p_user_id uuid,
  p_amount bigint,
  p_reason text,
  p_admin_id uuid,
  p_idempotency_key text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    return jsonb_build_object('ok', false, 'error', 'REASON_REQUIRED');
  end if;
  if p_amount is null or p_amount = 0 then
    return jsonb_build_object('ok', false, 'error', 'INVALID_AMOUNT');
  end if;
  if not exists (select 1 from profiles where id = p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'USER_NOT_FOUND');
  end if;
  begin
    select * into r from credit_apply(
      p_user_id, 'admin_adjustment', p_amount, 'admin:' || p_idempotency_key, null, null,
      left(trim(p_reason), 500), jsonb_build_object('admin_id', p_admin_id, 'reason', left(trim(p_reason), 500))
    );
  exception when raise_exception then
    if sqlerrm = 'INSUFFICIENT_CREDITS' then
      return jsonb_build_object('ok', false, 'error', 'INSUFFICIENT_CREDITS',
        'balance', coalesce((select balance from credit_wallets where user_id = p_user_id), 0));
    end if;
    raise;
  end;
  return jsonb_build_object('ok', true, 'status', case when r.duplicate then 'duplicate' else 'adjusted' end,
    'balance', r.balance, 'transaction_id', r.transaction_id);
end;
$$;

-- ── Purchase bookkeeping ────────────────────────────────────────────────
create or replace function credit_create_purchase(
  p_user_id uuid,
  p_credits bigint,
  p_amount_paise bigint,
  p_order_id text,
  p_metadata jsonb default '{}'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_credits <= 0 or p_amount_paise <> p_credits * 100 then
    raise exception 'INVALID_AMOUNT';
  end if;
  insert into credit_purchases (user_id, credits, amount_paise, razorpay_order_id, metadata)
  values (p_user_id, p_credits, p_amount_paise, p_order_id, coalesce(p_metadata, '{}'))
  returning id into v_id;
  return v_id;
end;
$$;

-- Pending orders a user opened recently (to cap order spam).
create or replace function credit_recent_pending_count(p_user_id uuid, p_minutes integer default 60)
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from credit_purchases
   where user_id = p_user_id and status = 'pending'
     and created_at > now() - make_interval(mins => p_minutes);
$$;

-- Purchases still awaiting confirmation — input to reconciliation, which
-- asks Razorpay directly whether each order was paid. Failed purchases are
-- included too: Razorpay allows a retry on the same order.
create or replace function credit_list_unsettled_purchases(
  p_user_id uuid default null,
  p_min_age_seconds integer default 30,
  p_max_age_hours integer default 72,
  p_limit integer default 50
)
returns table (id uuid, user_id uuid, razorpay_order_id text, credits bigint, amount_paise bigint, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.user_id, p.razorpay_order_id, p.credits, p.amount_paise, p.status, p.created_at
    from credit_purchases p
   where p.status in ('pending', 'failed')
     and (p_user_id is null or p.user_id = p_user_id)
     and p.created_at < now() - make_interval(secs => p_min_age_seconds)
     and p.created_at > now() - make_interval(hours => p_max_age_hours)
   order by p.created_at
   limit greatest(1, least(p_limit, 500));
$$;

-- Webhook dedupe. Returns 'process' (first delivery, or a retry of one that
-- failed) or 'duplicate' (already processed successfully).
create or replace function credit_webhook_begin(p_event_id text, p_event_type text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_processed boolean;
begin
  insert into credit_webhook_events (event_id, event_type, attempts)
  values (p_event_id, p_event_type, 1)
  on conflict (event_id) do nothing;
  if found then return 'process'; end if;

  select processed into v_processed from credit_webhook_events where event_id = p_event_id for update;
  if v_processed then return 'duplicate'; end if;
  update credit_webhook_events set attempts = attempts + 1 where event_id = p_event_id;
  return 'process';
end;
$$;

create or replace function credit_webhook_finish(p_event_id text, p_error text default null)
returns void language sql security definer set search_path = public as $$
  update credit_webhook_events
     set processed = (p_error is null),
         processed_at = case when p_error is null then now() else processed_at end,
         last_error = left(p_error, 500)
   where event_id = p_event_id;
$$;

-- ── Reporting ───────────────────────────────────────────────────────────
create or replace function credit_user_summary(p_user_id uuid)
returns table (
  balance bigint, purchased bigint, welcome bigint, consumed bigint,
  refunded bigint, adjusted bigint, transaction_count bigint
)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select w.balance from credit_wallets w where w.user_id = p_user_id), 0),
    coalesce(sum(amount) filter (where transaction_type = 'purchase'), 0),
    coalesce(sum(amount) filter (where transaction_type = 'welcome'), 0),
    -- Net consumption: usage charges minus reversals of those charges.
    coalesce(-sum(amount) filter (where transaction_type = 'usage'), 0)
      - coalesce(sum(amount) filter (where transaction_type = 'refund' and feature_key is not null), 0),
    coalesce(-sum(amount) filter (where transaction_type = 'refund' and feature_key is null), 0),
    coalesce(sum(amount) filter (where transaction_type = 'admin_adjustment'), 0),
    count(*)
  from credit_transactions where user_id = p_user_id;
$$;

create or replace function credit_admin_overview()
returns table (
  credits_purchased bigint, credits_consumed bigint, promotional_issued bigint,
  wallets bigint, pending_purchases bigint, successful_purchases bigint,
  revenue_paise bigint, refunded_paise bigint, outstanding_balance bigint
)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(amount) from credit_transactions where transaction_type = 'purchase'), 0),
    coalesce((select -sum(amount) from credit_transactions where transaction_type = 'usage'), 0)
      - coalesce((select sum(amount) from credit_transactions where transaction_type = 'refund' and feature_key is not null), 0),
    coalesce((select sum(amount) from credit_transactions
               where transaction_type = 'welcome' or (transaction_type = 'admin_adjustment' and amount > 0)), 0),
    (select count(*) from credit_wallets),
    (select count(*) from credit_purchases where status = 'pending'),
    (select count(*) from credit_purchases where status in ('paid', 'refunded', 'partially_refunded')),
    coalesce((select sum(amount_paise) from credit_purchases where status in ('paid', 'refunded', 'partially_refunded')), 0),
    coalesce((select sum(refunded_paise) from credit_purchases), 0),
    coalesce((select sum(balance) from credit_wallets), 0);
$$;

create or replace function credit_admin_list_wallets(
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  user_id uuid, full_name text, email text, role text, balance bigint,
  purchased bigint, welcome bigint, consumed bigint, last_activity timestamptz, total_count bigint
)
language sql stable security definer set search_path = public as $$
  with base as (
    select p.id, p.full_name, p.email, p.role::text as role, coalesce(w.balance, 0) as balance
      from profiles p
      left join credit_wallets w on w.user_id = p.id
     where (w.user_id is not null or p.role = 'student')
       and (p_search is null or p_search = ''
            or p.full_name ilike '%' || p_search || '%'
            or p.email ilike '%' || p_search || '%')
  ), agg as (
    select t.user_id,
           coalesce(sum(amount) filter (where transaction_type = 'purchase'), 0) as purchased,
           coalesce(sum(amount) filter (where transaction_type = 'welcome'), 0) as welcome,
           coalesce(-sum(amount) filter (where transaction_type = 'usage'), 0)
             - coalesce(sum(amount) filter (where transaction_type = 'refund' and feature_key is not null), 0) as consumed,
           max(created_at) as last_activity
      from credit_transactions t
     where t.user_id in (select id from base)
     group by t.user_id
  )
  select b.id, b.full_name, b.email, b.role, b.balance,
         coalesce(a.purchased, 0), coalesce(a.welcome, 0), coalesce(a.consumed, 0),
         a.last_activity, count(*) over ()
    from base b left join agg a on a.user_id = b.id
   order by a.last_activity desc nulls last, b.full_name
   limit greatest(1, least(p_page_size, 5000))
  offset (greatest(p_page, 1) - 1) * greatest(1, least(p_page_size, 5000));
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table credit_wallets        enable row level security;
alter table credit_transactions   enable row level security;
alter table credit_purchases      enable row level security;
alter table feature_credit_costs  enable row level security;
alter table credit_admins         enable row level security;
alter table credit_webhook_events enable row level security;

drop policy if exists "own wallet" on credit_wallets;
create policy "own wallet" on credit_wallets
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own credit transactions" on credit_transactions;
create policy "own credit transactions" on credit_transactions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own credit purchases" on credit_purchases;
create policy "own credit purchases" on credit_purchases
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "read feature credit costs" on feature_credit_costs;
create policy "read feature credit costs" on feature_credit_costs
  for select to authenticated using (true);

drop policy if exists "own credit admin row" on credit_admins;
create policy "own credit admin row" on credit_admins
  for select to authenticated using (user_id = auth.uid());

-- credit_webhook_events: no policies (service role only).

-- Defence in depth on top of RLS: clients get read-only table privileges.
revoke insert, update, delete, truncate on
  credit_wallets, credit_transactions, credit_purchases,
  feature_credit_costs, credit_admins, credit_webhook_events
  from anon, authenticated;
revoke all on credit_webhook_events from anon, authenticated;

-- Functions: server (service_role) only. Postgres grants EXECUTE to PUBLIC
-- by default, so revoke that first.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'credit_apply(uuid, text, bigint, text, text, text, text, jsonb)',
    'credit_is_eligible_student(uuid)',
    'credit_grant_welcome(uuid, bigint)',
    'credit_deduct(uuid, text, text, text, jsonb)',
    'credit_reverse_usage(uuid, uuid, text, integer)',
    'credit_fulfil_purchase(text, text, bigint, text, text)',
    'credit_mark_purchase_failed(text, text, text)',
    'credit_record_purchase_refund(text, text, bigint, uuid, text)',
    'credit_admin_adjust(uuid, bigint, text, uuid, text)',
    'credit_create_purchase(uuid, bigint, bigint, text, jsonb)',
    'credit_recent_pending_count(uuid, integer)',
    'credit_list_unsettled_purchases(uuid, integer, integer, integer)',
    'credit_webhook_begin(text, text)',
    'credit_webhook_finish(text, text)',
    'credit_user_summary(uuid)',
    'credit_admin_overview()',
    'credit_admin_list_wallets(text, integer, integer)',
    'credit_profile_welcome_trigger()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
