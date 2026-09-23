-- OlympiadIQ — Olympiad Battle: friend invites (email-based, async 1v1)
-- Additive only. Adds the invitations table, a `finished_at` marker so an
-- async PvP battle knows when each side has submitted, and reworks the
-- battle RLS policies so a non-creator participant (the invitee) can read
-- their own battles/participants/questions/answers and write their own row —
-- see the header comment in 008_fix_battle_rls_recursion.sql for why the
-- Phase 1 policies were deliberately creator-only, and the plan doc for why
-- a SECURITY DEFINER helper (not a direct cross-table subquery) is required
-- here to avoid reintroducing that recursion.

-- ── Invitations ──────────────────────────────────────────────────────────
create type battle_invitation_status as enum ('pending', 'accepted', 'declined', 'cancelled', 'expired');

create table battle_invitations (
  id                  uuid primary key default uuid_generate_v4(),
  inviter_student_id  uuid not null references students(id) on delete cascade,
  invitee_email       text not null,
  invitee_student_id  uuid references students(id) on delete set null,
  subject             subject_type not null,
  difficulty          difficulty_type not null,
  class_level         smallint not null,
  board               board_type not null,
  question_count      smallint not null,
  status              battle_invitation_status not null default 'pending',
  battle_id           uuid references battles(id) on delete set null,
  created_at          timestamptz not null default now(),
  responded_at        timestamptz,
  expires_at          timestamptz not null default (now() + interval '7 days')
);
create index idx_battle_invitations_invitee_email on battle_invitations(lower(invitee_email));
create index idx_battle_invitations_inviter        on battle_invitations(inviter_student_id);

alter table battle_invitations enable row level security;

create policy "inviter sees own sent invitations" on battle_invitations
  for select using (inviter_student_id in (select id from students where profile_id = auth.uid()));
create policy "invitee sees own received invitations" on battle_invitations
  for select using (lower(invitee_email) = lower((select email from profiles where id = auth.uid())));
create policy "create own invitations" on battle_invitations
  for insert with check (inviter_student_id in (select id from students where profile_id = auth.uid()));
create policy "inviter can cancel own invitations" on battle_invitations
  for update using (inviter_student_id in (select id from students where profile_id = auth.uid()));
create policy "invitee can respond to own invitations" on battle_invitations
  for update using (lower(invitee_email) = lower((select email from profiles where id = auth.uid())));

-- ── Per-participant "have they submitted their run yet" marker ─────────
-- null = hasn't submitted. AI-battle participant rows get this set too (at
-- finishAiBattle time, for both rows) purely for consistency — AI battles
-- never actually wait on anyone since they resolve in one atomic call.
alter table battle_participants add column if not exists finished_at timestamptz;

-- ── SECURITY DEFINER membership check ───────────────────────────────────
-- Bypasses RLS internally when Postgres evaluates it, so referencing it from
-- a policy never re-triggers that same table's policy (unlike a direct
-- cross-table subquery, which caused the Phase 1 recursion bug).
create or replace function is_battle_participant(p_battle_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable as $$
  select exists (
    select 1 from battle_participants bp
    join students s on s.id = bp.student_id
    where bp.battle_id = p_battle_id and s.profile_id = auth.uid()
  );
$$;
revoke all on function is_battle_participant(uuid) from public;
grant execute on function is_battle_participant(uuid) to authenticated;

-- ── battles: allow any participant to read, not just the creator ───────
-- The created_by clause stays alongside is_battle_participant(): right after
-- a battle is inserted (by its creator) its own battle_participants rows
-- don't exist yet, and .insert().select() is itself subject to this SELECT
-- policy, so created_by is still needed for that split second.
drop policy if exists "own battles" on battles;
create policy "own or participant battles" on battles
  for select using (
    created_by in (select id from students where profile_id = auth.uid())
    or is_battle_participant(id)
  );

-- ── battle_participants: any participant can see all rows of their battle,
-- but can only ever directly write their OWN row. Cross-participant writes
-- (finalizing a battle, backfilling the opponent's result) go through the
-- service client inside a trusted server action instead — see
-- src/actions/battle.ts submitPvpBattleAnswers — not through loosened RLS.
drop policy if exists "own battle participants" on battle_participants;
create policy "participant battle_participants select" on battle_participants
  for select using (is_battle_participant(battle_id));

create policy "own participant row update" on battle_participants
  for update using (student_id in (select id from students where profile_id = auth.uid()));

-- ── battle_questions / battle_answers: same participant-based visibility ─
drop policy if exists "own battle questions" on battle_questions;
create policy "participant battle_questions select" on battle_questions
  for select using (is_battle_participant(battle_id));

drop policy if exists "own battle answers select" on battle_answers;
create policy "participant battle_answers select" on battle_answers
  for select using (is_battle_participant(battle_id));

create policy "own participant battle_answers insert" on battle_answers
  for insert with check (
    participant_id in (
      select bp.id from battle_participants bp
      join students s on s.id = bp.student_id
      where s.profile_id = auth.uid()
    )
  );
