-- OlympiadIQ — Olympiad Battle (Phase 1: AI Battle)
-- Additive only. Schema is shaped for the full eventual feature (live
-- student-vs-student battles, matchmaking, private battle codes, admin
-- config editors) even though Phase 1 only ever writes mode='ai' battles.
-- Run this in the Supabase SQL editor (same as prior migrations).

-- ── Enums ──────────────────────────────────────────────────────────────
-- 'ai' is the only mode Phase 1 writes. pvp_random (matchmaking) /
-- pvp_private (room-code join) are reserved so a later phase needs no
-- enum migration — it just starts inserting these values.
create type battle_mode   as enum ('ai', 'pvp_random', 'pvp_private');
create type battle_status as enum ('pending', 'active', 'completed', 'cancelled');
create type battle_result as enum ('win', 'loss', 'draw');

-- ── Battles ───────────────────────────────────────────────────────────
create table battles (
  id                        uuid primary key default uuid_generate_v4(),
  mode                      battle_mode not null default 'ai',
  status                    battle_status not null default 'pending',
  subject                   subject_type not null,
  class_level               smallint not null,
  board                     board_type not null,
  difficulty                difficulty_type not null,
  question_count            smallint not null default 10,
  -- Snapshotted from battle_config at creation time so a later admin edit
  -- never retroactively changes an in-flight or historical battle.
  time_per_question_seconds int not null,
  created_by                uuid not null references students(id) on delete cascade,
  -- Reserved for the private-battle join flow (later phase); always null now.
  room_code                 text unique,
  started_at                timestamptz,
  completed_at              timestamptz,
  cancelled_at              timestamptz,
  created_at                timestamptz not null default now()
);

-- ── Participants (one row per side; is_ai=true row has student_id=null) ──
-- Participant-based (not a student_a/student_b design) so a live PvP
-- battle just inserts a second is_ai=false row — no schema rewrite needed.
create table battle_participants (
  id                 uuid primary key default uuid_generate_v4(),
  battle_id          uuid not null references battles(id) on delete cascade,
  student_id         uuid references students(id) on delete cascade,
  is_ai              boolean not null default false,
  ai_difficulty_key  difficulty_type, -- null for humans; drives the AI profile used
  score              int not null default 0,
  correct_count      smallint not null default 0,
  incorrect_count    smallint not null default 0,
  timeout_count      smallint not null default 0,
  total_time_seconds int not null default 0,
  rating_before      int,       -- null for AI (AI has no persistent rating)
  rating_after       int,
  rating_delta       int,
  result             battle_result,
  joined_at          timestamptz not null default now(),
  check (is_ai = (student_id is null))
);
create unique index idx_battle_participants_student_unique
  on battle_participants(battle_id, student_id) where student_id is not null;

alter table battles
  add column winner_participant_id uuid references battle_participants(id) on delete set null;

-- ── Questions (snapshotted per battle so edits/deletes to the source
-- `questions` row never change a battle's history after the fact) ──────
create table battle_questions (
  id                    uuid primary key default uuid_generate_v4(),
  battle_id             uuid not null references battles(id) on delete cascade,
  question_id           uuid references questions(id) on delete set null,
  order_index           smallint not null,
  question_text         text not null,
  options               jsonb not null, -- [{"index":0,"text":"..."}, ...]
  correct_option_index  smallint not null,
  explanation           text not null,
  topic_name            text,
  difficulty            difficulty_type not null,
  time_limit_seconds    int not null,
  unique (battle_id, order_index)
);

-- ── Answers (one row per participant per question) ──────────────────────
create table battle_answers (
  id                     uuid primary key default uuid_generate_v4(),
  battle_id              uuid not null references battles(id) on delete cascade,
  battle_question_id     uuid not null references battle_questions(id) on delete cascade,
  participant_id         uuid not null references battle_participants(id) on delete cascade,
  selected_option_index  smallint,      -- null = no answer / timeout
  is_correct             boolean not null default false,
  time_taken_seconds     numeric(6,2) not null default 0,
  points_awarded         int not null default 0,
  answered_at            timestamptz not null default now(),
  unique (battle_question_id, participant_id)
);

-- ── Denormalized per-student battle stats (rating/W-L-D/streak) ────────
-- Same idea as students.streak_days / students.readiness_score: a fast-read
-- aggregate, recomputed transactionally on every completed battle.
create table student_battle_stats (
  student_id         uuid primary key references students(id) on delete cascade,
  rating             int not null default 1000,
  wins               int not null default 0,
  losses             int not null default 0,
  draws              int not null default 0,
  -- Streak = consecutive wins only (no "loss streak" concept anywhere —
  -- matches the product's encouraging-language principle). A loss or draw
  -- resets current_streak to 0.
  current_streak     int not null default 0,
  best_win_streak    int not null default 0,
  battles_played     int not null default 0,
  last_battle_at     timestamptz,
  updated_at         timestamptz not null default now()
);

-- ── Admin-configurable battle settings (multi-row key/value so a later
-- phase can add new config categories without another migration) ───────
create table battle_config (
  key         text primary key,
  category    text not null, -- 'scoring' | 'timer' | 'ai_difficulty' | 'rating' | 'achievements'
  label       text not null,
  description text,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references profiles(id) on delete set null
);

insert into battle_config (key, category, label, description, value) values
  ('timer', 'timer', 'Question timers',
   'Per-difficulty time limit and default question count for a battle.',
   '{"seconds_by_difficulty":{"Easy":30,"Medium":45,"Hard":60,"HOTS":90,"Adaptive":45},"default_question_count":10,"allowed_question_counts":[5,10,15]}'::jsonb),
  ('scoring', 'scoring', 'Scoring rules',
   'Points per correct answer, time bonus, and streak bonus during a battle.',
   '{"points_correct":100,"points_incorrect":0,"time_bonus_max":50,"streak_bonus_per_correct":10,"streak_bonus_min_run":3,"max_streak_bonus":50}'::jsonb),
  ('rating', 'rating', 'Rating (Elo) rules',
   'Elo-style rating update applied to the student after each AI battle.',
   '{"starting_rating":1000,"k_factor_provisional":40,"k_factor_established":20,"provisional_games":10,"floor":100,"ai_effective_rating_by_difficulty":{"Easy":900,"Medium":1000,"Hard":1150,"HOTS":1300,"Adaptive":1050}}'::jsonb),
  ('ai_difficulty', 'ai_difficulty', 'AI opponent behaviour',
   'Accuracy and answer-speed profile used to simulate the AI opponent per difficulty.',
   '{"Easy":{"accuracy":0.55,"avg_answer_seconds":16,"stddev_seconds":6},"Medium":{"accuracy":0.65,"avg_answer_seconds":20,"stddev_seconds":7},"Hard":{"accuracy":0.75,"avg_answer_seconds":26,"stddev_seconds":9},"HOTS":{"accuracy":0.7,"avg_answer_seconds":40,"stddev_seconds":14},"Adaptive":{"accuracy":0.65,"avg_answer_seconds":22,"stddev_seconds":8}}'::jsonb),
  ('achievements', 'achievements', 'Battle achievement thresholds',
   'Win-streak/rating/veteran thresholds mapped to achievements.badge_key values.',
   '{"first_win_key":"battle_first_win","perfect_score_key":"battle_perfect_score","win_streak_keys":{"3":"battle_win_streak_3","5":"battle_win_streak_5","10":"battle_win_streak_10"},"rating_keys":{"1200":"battle_rating_1200","1400":"battle_rating_1400"},"veteran_keys":{"10":"battle_veteran_10","50":"battle_veteran_50"}}'::jsonb)
on conflict (key) do nothing;

create trigger trg_battle_config_updated_at
  before update on battle_config for each row execute procedure update_updated_at();
create trigger trg_battle_stats_updated_at
  before update on student_battle_stats for each row execute procedure update_updated_at();

-- Reuse the existing last-active trigger — student_id is null on the AI
-- row, which the function already tolerates (WHERE id = null matches nothing).
create trigger trg_battle_participants_touch_active
  after insert or update on battle_participants
  for each row execute procedure touch_student_last_active();

-- ── Indexes ───────────────────────────────────────────────────────────
create index idx_battles_created_by         on battles(created_by);
create index idx_battles_status             on battles(status);
create index idx_battles_created_at         on battles(created_at desc);
create index idx_battle_participants_battle  on battle_participants(battle_id);
create index idx_battle_participants_student on battle_participants(student_id);
create index idx_battle_questions_battle     on battle_questions(battle_id, order_index);
create index idx_battle_answers_battle       on battle_answers(battle_id);
create index idx_battle_answers_participant  on battle_answers(participant_id);

-- ── Row Level Security ───────────────────────────────────────────────────
alter table battles              enable row level security;
alter table battle_participants  enable row level security;
alter table battle_questions     enable row level security;
alter table battle_answers       enable row level security;
alter table student_battle_stats enable row level security;
alter table battle_config        enable row level security;
-- battle_config: no policies — service-role only, same as admin_settings.

-- Phase 1 only ever has one human per battle (the creator) — visibility is
-- keyed off `created_by` alone. Deliberately NOT "created_by OR (id in
-- battle_participants where student_id = mine)": that OR-clause subqueries
-- battle_participants, whose own policy below subqueries battles right
-- back, which Postgres detects as infinite recursion (RLS re-evaluates
-- each table's policy while evaluating the other's). When Phase 2 adds a
-- second human participant, add visibility via a SECURITY DEFINER helper
-- function instead of a direct cross-table subquery, to avoid reintroducing
-- this cycle.
create policy "own battles" on battles
  for select using (created_by in (select id from students where profile_id = auth.uid()));
create policy "create own battles" on battles
  for insert with check (created_by in (select id from students where profile_id = auth.uid()));
create policy "update own battles" on battles
  for update using (created_by in (select id from students where profile_id = auth.uid()));

-- Keyed off battles.created_by (not a battle_participants self-join — see
-- the comment on "own battles" above for why). This still correctly
-- exposes both rows, including the AI's (student_id null), to the human
-- participant, since both rows share battle_id and every Phase 1 battle
-- has exactly one human: its creator.
create policy "own battle participants" on battle_participants
  for select using (
    battle_id in (select id from battles where created_by in (select id from students where profile_id = auth.uid()))
  );
create policy "insert own battle participants" on battle_participants
  for insert with check (
    battle_id in (select id from battles where created_by in (select id from students where profile_id = auth.uid()))
  );
create policy "update own battle participants" on battle_participants
  for update using (
    battle_id in (select id from battles where created_by in (select id from students where profile_id = auth.uid()))
  );

create policy "own battle questions" on battle_questions
  for select using (
    battle_id in (select id from battles where created_by in (select id from students where profile_id = auth.uid()))
  );
create policy "insert own battle questions" on battle_questions
  for insert with check (
    battle_id in (select id from battles where created_by in (select id from students where profile_id = auth.uid()))
  );

create policy "own battle answers select" on battle_answers
  for select using (
    battle_id in (select id from battles where created_by in (select id from students where profile_id = auth.uid()))
  );
create policy "own battle answers insert" on battle_answers
  for insert with check (
    battle_id in (select id from battles where created_by in (select id from students where profile_id = auth.uid()))
  );

create policy "own battle stats" on student_battle_stats
  for all using (student_id in (select id from students where profile_id = auth.uid()));
