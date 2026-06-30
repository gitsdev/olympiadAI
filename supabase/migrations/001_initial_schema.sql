-- OlympiadAI — Initial schema
-- Run this via Supabase SQL editor or supabase db push

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ── Enums ──────────────────────────────────────────────────────────────
create type board_type     as enum ('CBSE', 'ICSE');
create type subject_type   as enum ('Mathematics', 'Science', 'English', 'General Knowledge', 'Cyber');
create type difficulty_type as enum ('Easy', 'Medium', 'Hard', 'HOTS', 'Adaptive');
create type question_type   as enum ('MCQ', 'MultipleCorrect', 'FillBlanks', 'TrueFalse', 'Reasoning', 'HOTS', 'Olympiad');
create type user_role       as enum ('student', 'parent', 'teacher', 'school_admin', 'platform_admin');
create type resource_type   as enum ('video', 'article', 'practice', 'worksheet', 'ncert', 'other');

-- ── Profiles (mirrors auth.users) ─────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null,
  role        user_role not null default 'student',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Students ──────────────────────────────────────────────────────────
create table students (
  id              uuid primary key default uuid_generate_v4(),
  profile_id      uuid not null unique references profiles(id) on delete cascade,
  board           board_type not null default 'CBSE',
  class_level     smallint not null check (class_level between 1 and 10),
  subjects        subject_type[] not null default '{}',
  streak_days     int not null default 0,
  readiness_score numeric(5,2) not null default 0,
  total_points    int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Parents ───────────────────────────────────────────────────────────
create table parents (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid not null unique references profiles(id) on delete cascade,
  student_ids uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- ── Curriculum ────────────────────────────────────────────────────────
create table boards (
  id           uuid primary key default uuid_generate_v4(),
  name         board_type not null unique,
  display_name text not null
);

create table classes (
  id           uuid primary key default uuid_generate_v4(),
  board_id     uuid not null references boards(id),
  level        smallint not null,
  display_name text not null,
  unique (board_id, level)
);

create table subjects (
  id          uuid primary key default uuid_generate_v4(),
  name        subject_type not null unique,
  color_token text not null
);

create table chapters (
  id          uuid primary key default uuid_generate_v4(),
  subject_id  uuid not null references subjects(id),
  class_id    uuid not null references classes(id),
  name        text not null,
  order_index smallint not null default 0
);

create table topics (
  id          uuid primary key default uuid_generate_v4(),
  chapter_id  uuid not null references chapters(id),
  name        text not null,
  order_index smallint not null default 0
);

-- ── Knowledge graph ───────────────────────────────────────────────────
create table knowledge_nodes (
  id            uuid primary key default uuid_generate_v4(),
  topic_id      uuid references topics(id),
  label         text not null,
  description   text,
  prerequisites uuid[] not null default '{}',
  class_level   smallint not null,
  board         board_type not null,
  subject       subject_type not null,
  embedding     vector(1536),
  created_at    timestamptz not null default now()
);

create table knowledge_edges (
  id           uuid primary key default uuid_generate_v4(),
  from_node_id uuid not null references knowledge_nodes(id) on delete cascade,
  to_node_id   uuid not null references knowledge_nodes(id) on delete cascade,
  weight       numeric(3,2) not null default 1.0,
  unique (from_node_id, to_node_id)
);

-- ── Resources ─────────────────────────────────────────────────────────
create table resources (
  id                 uuid primary key default uuid_generate_v4(),
  title              text not null,
  url                text not null,
  source_name        text not null,
  resource_type      resource_type not null,
  subject            subject_type not null,
  class_level        smallint not null,
  board              board_type not null,
  chapter_name       text,
  topic_name         text,
  ai_summary         text,
  duration_seconds   int,
  embedding          vector(1536),
  created_at         timestamptz not null default now()
);

-- ── Concepts ──────────────────────────────────────────────────────────
create table concepts (
  id               uuid primary key default uuid_generate_v4(),
  title            text not null,
  definition       text not null,
  formula          text,
  examples         text[] not null default '{}',
  common_mistakes  text[] not null default '{}',
  subject          subject_type not null,
  class_level      smallint not null,
  board            board_type not null,
  chapter_name     text,
  topic_name       text,
  difficulty       difficulty_type not null default 'Medium',
  embedding        vector(1536),
  created_at       timestamptz not null default now()
);

-- ── Questions ─────────────────────────────────────────────────────────
create table questions (
  id                       uuid primary key default uuid_generate_v4(),
  question_text            text not null,
  question_type            question_type not null default 'MCQ',
  subject                  subject_type not null,
  class_level              smallint not null,
  board                    board_type not null,
  chapter_name             text,
  topic_name               text,
  difficulty               difficulty_type not null,
  explanation              text not null,
  correct_answer_index     smallint,
  estimated_time_seconds   int not null default 60,
  embedding                vector(1536),
  created_at               timestamptz not null default now()
);

create table question_options (
  id           uuid primary key default uuid_generate_v4(),
  question_id  uuid not null references questions(id) on delete cascade,
  option_text  text not null,
  option_index smallint not null,
  is_correct   boolean not null default false,
  unique (question_id, option_index)
);

-- ── Mock tests ────────────────────────────────────────────────────────
create table mock_tests (
  id                  uuid primary key default uuid_generate_v4(),
  student_id          uuid references students(id) on delete set null,
  title               text not null,
  subject             subject_type not null,
  class_level         smallint not null,
  board               board_type not null,
  topic_name          text,
  difficulty          difficulty_type not null default 'Medium',
  question_count      smallint not null default 10,
  time_limit_minutes  smallint not null default 15,
  is_adaptive         boolean not null default false,
  created_at          timestamptz not null default now()
);

create table mock_test_questions (
  id            uuid primary key default uuid_generate_v4(),
  mock_test_id  uuid not null references mock_tests(id) on delete cascade,
  question_id   uuid not null references questions(id),
  order_index   smallint not null,
  unique (mock_test_id, order_index)
);

-- ── Attempts ──────────────────────────────────────────────────────────
create table test_attempts (
  id                              uuid primary key default uuid_generate_v4(),
  student_id                      uuid not null references students(id) on delete cascade,
  mock_test_id                    uuid references mock_tests(id) on delete set null,
  subject                         subject_type not null,
  topic_name                      text,
  score                           numeric(5,2) not null default 0,
  accuracy                        numeric(5,2) not null default 0,
  avg_time_per_question_seconds   int not null default 0,
  total_time_seconds              int not null default 0,
  questions_attempted             smallint not null default 0,
  questions_correct               smallint not null default 0,
  readiness_score_after           numeric(5,2) not null default 0,
  started_at                      timestamptz not null default now(),
  completed_at                    timestamptz
);

create table attempt_answers (
  id                    uuid primary key default uuid_generate_v4(),
  attempt_id            uuid not null references test_attempts(id) on delete cascade,
  question_id           uuid not null references questions(id),
  selected_option_index smallint,
  is_correct            boolean not null default false,
  time_taken_seconds    int not null default 0,
  created_at            timestamptz not null default now()
);

-- ── Performance ───────────────────────────────────────────────────────
create table performance_metrics (
  id              uuid primary key default uuid_generate_v4(),
  student_id      uuid not null references students(id) on delete cascade,
  subject         subject_type not null,
  topic_name      text not null,
  mastery_score   numeric(5,2) not null default 0,
  accuracy_rate   numeric(5,2) not null default 0,
  attempts_count  int not null default 0,
  last_attempt_at timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (student_id, subject, topic_name)
);

-- ── Study plans ───────────────────────────────────────────────────────
create table study_plans (
  id            uuid primary key default uuid_generate_v4(),
  student_id    uuid not null references students(id) on delete cascade,
  plan_date     date not null,
  items         jsonb not null default '[]',
  total_minutes int not null default 0,
  created_at    timestamptz not null default now(),
  unique (student_id, plan_date)
);

-- ── Gamification ──────────────────────────────────────────────────────
create table achievements (
  id          uuid primary key default uuid_generate_v4(),
  student_id  uuid not null references students(id) on delete cascade,
  badge_key   text not null,
  earned_at   timestamptz not null default now(),
  unique (student_id, badge_key)
);

-- ── AI conversations ──────────────────────────────────────────────────
create table ai_conversations (
  id          uuid primary key default uuid_generate_v4(),
  student_id  uuid not null references students(id) on delete cascade,
  messages    jsonb not null default '[]',
  subject     subject_type,
  topic_name  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Vector search function ────────────────────────────────────────────
create or replace function search_knowledge(
  query_embedding vector(1536),
  match_count     int default 9,
  student_class   smallint default 7,
  student_board   board_type default 'CBSE'
)
returns table (
  id         uuid,
  title      text,
  content    text,
  similarity float,
  type       text
)
language sql stable as $$
  (
    select
      c.id,
      c.title,
      c.definition as content,
      1 - (c.embedding <=> query_embedding) as similarity,
      'concept' as type
    from concepts c
    where c.class_level = student_class
      and c.board = student_board
      and c.embedding is not null
    order by c.embedding <=> query_embedding
    limit match_count / 2
  )
  union all
  (
    select
      r.id,
      r.title,
      coalesce(r.ai_summary, r.title) as content,
      1 - (r.embedding <=> query_embedding) as similarity,
      case r.resource_type
        when 'video' then 'video'
        when 'practice' then 'practice'
        else 'source'
      end as type
    from resources r
    where r.class_level = student_class
      and r.board = student_board
      and r.embedding is not null
    order by r.embedding <=> query_embedding
    limit match_count / 2
  )
  order by similarity desc
  limit match_count;
$$;

-- ── Readiness score function ──────────────────────────────────────────
create or replace function calculate_readiness_score(p_student_id uuid)
returns numeric language sql stable as $$
  select coalesce(
    round(
      (avg(pm.mastery_score) * 0.5 +
       avg(pm.accuracy_rate) * 0.3 +
       least(s.streak_days, 30) / 30.0 * 20)::numeric,
      2
    ),
    0
  )
  from students s
  left join performance_metrics pm on pm.student_id = s.id
  where s.id = p_student_id
  group by s.streak_days;
$$;

-- ── Auto-update triggers ──────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_profiles_updated_at  before update on profiles  for each row execute procedure update_updated_at();
create trigger trg_students_updated_at  before update on students  for each row execute procedure update_updated_at();
create trigger trg_metrics_updated_at   before update on performance_metrics for each row execute procedure update_updated_at();
create trigger trg_conv_updated_at      before update on ai_conversations for each row execute procedure update_updated_at();

-- ── Auto-create profile on signup ─────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Row Level Security ────────────────────────────────────────────────
alter table profiles          enable row level security;
alter table students          enable row level security;
alter table parents           enable row level security;
alter table study_plans       enable row level security;
alter table test_attempts     enable row level security;
alter table attempt_answers   enable row level security;
alter table performance_metrics enable row level security;
alter table achievements      enable row level security;
alter table ai_conversations  enable row level security;
alter table mock_tests        enable row level security;

-- Profiles: user can read/update own row
create policy "own profile" on profiles
  for all using (auth.uid() = id);

-- Students: user can read/update own row
create policy "own student row" on students
  for all using (
    profile_id = auth.uid()
  );

-- Parents: own row + can read linked students
create policy "own parent row" on parents
  for all using (profile_id = auth.uid());

-- Study plans: own only
create policy "own study plan" on study_plans
  for all using (
    student_id in (select id from students where profile_id = auth.uid())
  );

-- Test attempts: own only
create policy "own test attempts" on test_attempts
  for all using (
    student_id in (select id from students where profile_id = auth.uid())
  );

-- Attempt answers: via attempt ownership
create policy "own attempt answers" on attempt_answers
  for all using (
    attempt_id in (
      select ta.id from test_attempts ta
      join students s on s.id = ta.student_id
      where s.profile_id = auth.uid()
    )
  );

-- Performance metrics: own only
create policy "own performance metrics" on performance_metrics
  for all using (
    student_id in (select id from students where profile_id = auth.uid())
  );

-- Achievements: own only
create policy "own achievements" on achievements
  for all using (
    student_id in (select id from students where profile_id = auth.uid())
  );

-- AI conversations: own only
create policy "own ai conversations" on ai_conversations
  for all using (
    student_id in (select id from students where profile_id = auth.uid())
  );

-- Mock tests: own + public (student_id is null = platform test)
create policy "own or public mock tests" on mock_tests
  for select using (
    student_id is null
    or student_id in (select id from students where profile_id = auth.uid())
  );

-- Curriculum tables: public read
create policy "public read boards"     on boards    for select using (true);
create policy "public read classes"    on classes   for select using (true);
create policy "public read subjects"   on subjects  for select using (true);
create policy "public read chapters"   on chapters  for select using (true);
create policy "public read topics"     on topics    for select using (true);
create policy "public read kn"         on knowledge_nodes for select using (true);
create policy "public read ke"         on knowledge_edges for select using (true);
create policy "public read resources"  on resources  for select using (true);
create policy "public read concepts"   on concepts   for select using (true);
create policy "public read questions"  on questions  for select using (true);
create policy "public read q_options"  on question_options for select using (true);

-- ── Indexes ───────────────────────────────────────────────────────────
create index idx_students_profile on students(profile_id);
create index idx_perf_student     on performance_metrics(student_id);
create index idx_attempts_student on test_attempts(student_id);
create index idx_plans_date       on study_plans(student_id, plan_date);
create index idx_convs_student    on ai_conversations(student_id);

-- pgvector HNSW indexes for fast ANN search
create index idx_concepts_emb   on concepts   using hnsw (embedding vector_cosine_ops);
create index idx_resources_emb  on resources  using hnsw (embedding vector_cosine_ops);
create index idx_questions_emb  on questions  using hnsw (embedding vector_cosine_ops);
create index idx_kn_emb         on knowledge_nodes using hnsw (embedding vector_cosine_ops);
