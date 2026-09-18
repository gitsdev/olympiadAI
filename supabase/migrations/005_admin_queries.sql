-- OlympiadIQ — Administrator Area: read-only aggregation functions
-- Additive only. These do the heavy filtering/aggregation/pagination inside
-- Postgres so the admin UI never pulls full tables into the browser.
--
-- SECURITY: these functions read across ALL students, bypassing the
-- "own row only" RLS policies from 001_initial_schema.sql by relying on the
-- caller being the service-role client. They are plain SECURITY INVOKER
-- functions (the default) — when called by an ordinary authenticated user,
-- normal RLS still applies to the underlying tables, so this is defense in
-- depth, not the primary boundary. The primary boundary is application code:
-- every admin server action calls requireAdmin() and only ever invokes these
-- via createServiceClient(). We additionally revoke EXECUTE from anon/
-- authenticated so a browser client can never call them directly at all.

-- ── Students: filtered, paginated, aggregated list ─────────────────────
create or replace function admin_list_students(
  p_search text default null,
  p_class_level int default null,
  p_board board_type default null,
  p_account_status text default null,
  p_activity text default null, -- 'today' | 'week' | 'inactive_7' | 'inactive_30'
  p_registered_from timestamptz default null,
  p_registered_to timestamptz default null,
  p_test_count_min int default null,
  p_test_count_max int default null,
  p_score_min numeric default null,
  p_score_max numeric default null,
  p_sort text default 'created_at_desc',
  p_page int default 1,
  p_page_size int default 20
)
returns table (
  student_id uuid,
  profile_id uuid,
  full_name text,
  email text,
  class_level smallint,
  board board_type,
  registered_at timestamptz,
  last_active_at timestamptz,
  account_status text,
  mock_tests_taken bigint,
  avg_score numeric,
  ai_sessions bigint,
  overall_progress numeric,
  total_count bigint
)
language sql stable as $$
  with agg as (
    select
      s.id as student_id,
      s.profile_id,
      p.full_name,
      p.email,
      s.class_level,
      s.board,
      p.created_at as registered_at,
      s.last_active_at,
      s.account_status,
      coalesce(ta.cnt, 0)      as mock_tests_taken,
      coalesce(ta.avg_score, 0) as avg_score,
      coalesce(ac.cnt, 0)      as ai_sessions,
      coalesce(pm.avg_mastery, 0) as overall_progress
    from students s
    join profiles p on p.id = s.profile_id
    left join (
      select student_id, count(*) as cnt, avg(score) as avg_score
      from test_attempts
      where completed_at is not null
      group by student_id
    ) ta on ta.student_id = s.id
    left join (
      select student_id, count(*) as cnt from ai_conversations group by student_id
    ) ac on ac.student_id = s.id
    left join (
      select student_id, avg(mastery_score) as avg_mastery from performance_metrics group by student_id
    ) pm on pm.student_id = s.id
  )
  select agg.*, count(*) over() as total_count
  from agg
  where (
      p_search is null or p_search = ''
      or agg.full_name ilike '%' || p_search || '%'
      or agg.email ilike '%' || p_search || '%'
      or agg.student_id::text = p_search
      or exists (
        select 1 from parents par
        join profiles pp on pp.id = par.profile_id
        where agg.student_id = any(par.student_ids)
          and (pp.full_name ilike '%' || p_search || '%' or pp.email ilike '%' || p_search || '%')
      )
    )
    and (p_class_level is null or agg.class_level = p_class_level)
    and (p_board is null or agg.board = p_board)
    and (p_account_status is null or agg.account_status = p_account_status)
    and (p_registered_from is null or agg.registered_at >= p_registered_from)
    and (p_registered_to is null or agg.registered_at <= p_registered_to)
    and (p_test_count_min is null or agg.mock_tests_taken >= p_test_count_min)
    and (p_test_count_max is null or agg.mock_tests_taken <= p_test_count_max)
    and (p_score_min is null or agg.avg_score >= p_score_min)
    and (p_score_max is null or agg.avg_score <= p_score_max)
    and (
      p_activity is null
      or (p_activity = 'today' and agg.last_active_at >= date_trunc('day', now()))
      or (p_activity = 'week' and agg.last_active_at >= now() - interval '7 days')
      or (p_activity = 'inactive_7' and (agg.last_active_at is null or agg.last_active_at < now() - interval '7 days'))
      or (p_activity = 'inactive_30' and (agg.last_active_at is null or agg.last_active_at < now() - interval '30 days'))
    )
  order by
    case when p_sort = 'name_asc' then agg.full_name end asc nulls last,
    case when p_sort = 'last_active_desc' then agg.last_active_at end desc nulls last,
    case when p_sort = 'score_desc' then agg.avg_score end desc nulls last,
    case when p_sort = 'tests_desc' then agg.mock_tests_taken end desc nulls last,
    case when p_sort = 'created_at_desc' or p_sort is null then agg.registered_at end desc nulls last
  limit p_page_size offset greatest(0, (p_page - 1)) * p_page_size;
$$;

-- ── Single student: overview stats for the 360° header/cards ───────────
create or replace function admin_student_stats(p_student_id uuid)
returns table (
  mock_tests_taken bigint,
  avg_score numeric,
  best_score numeric,
  ai_sessions bigint,
  questions_attempted bigint,
  total_test_time_seconds bigint,
  overall_progress numeric,
  last_mock_test_at timestamptz,
  last_ai_session_at timestamptz
)
language sql stable as $$
  select
    (select count(*) from test_attempts where student_id = p_student_id and completed_at is not null),
    (select coalesce(avg(score), 0) from test_attempts where student_id = p_student_id and completed_at is not null),
    (select coalesce(max(score), 0) from test_attempts where student_id = p_student_id and completed_at is not null),
    (select count(*) from ai_conversations where student_id = p_student_id),
    (select coalesce(sum(questions_attempted), 0) from test_attempts where student_id = p_student_id and completed_at is not null),
    (select coalesce(sum(total_time_seconds), 0) from test_attempts where student_id = p_student_id and completed_at is not null),
    (select coalesce(avg(mastery_score), 0) from performance_metrics where student_id = p_student_id),
    (select max(completed_at) from test_attempts where student_id = p_student_id),
    (select max(updated_at) from ai_conversations where student_id = p_student_id);
$$;

-- ── Single student: subject-level progress ──────────────────────────────
create or replace function admin_student_subject_progress(p_student_id uuid)
returns table (
  subject subject_type,
  questions_attempted bigint,
  questions_correct bigint,
  accuracy numeric,
  tests_completed bigint,
  avg_score numeric,
  progress_pct numeric
)
language sql stable as $$
  select
    ta.subject,
    coalesce(sum(ta.questions_attempted), 0),
    coalesce(sum(ta.questions_correct), 0),
    case when sum(ta.questions_attempted) > 0
      then round(100.0 * sum(ta.questions_correct) / sum(ta.questions_attempted), 1)
      else 0 end,
    count(*) filter (where ta.completed_at is not null),
    coalesce(avg(ta.score) filter (where ta.completed_at is not null), 0),
    coalesce((select avg(pm.mastery_score) from performance_metrics pm
              where pm.student_id = p_student_id and pm.subject = ta.subject), 0)
  from test_attempts ta
  where ta.student_id = p_student_id
  group by ta.subject
  order by ta.subject;
$$;

-- ── Single student: topic/chapter drilldown (best-effort join to the
-- existing curriculum hierarchy by matching subject + class + topic name,
-- the same denormalized convention the rest of the app already uses) ────
create or replace function admin_student_topic_progress(p_student_id uuid)
returns table (
  subject subject_type,
  chapter_name text,
  topic_name text,
  mastery_score numeric,
  accuracy_rate numeric,
  attempts_count int,
  last_attempt_at timestamptz
)
language sql stable as $$
  select
    pm.subject,
    coalesce(c.name, 'Other'),
    pm.topic_name,
    pm.mastery_score,
    pm.accuracy_rate,
    pm.attempts_count,
    pm.last_attempt_at
  from performance_metrics pm
  join students s on s.id = pm.student_id
  left join subjects subj on subj.name = pm.subject
  left join boards b on b.name = s.board
  left join classes cl on cl.board_id = b.id and cl.level = s.class_level
  left join chapters c on c.subject_id = subj.id and c.class_id = cl.id
  left join topics t on t.chapter_id = c.id and t.name = pm.topic_name
  where pm.student_id = p_student_id
  order by pm.subject, c.order_index nulls last, pm.topic_name;
$$;

-- ── Single student: recent activity timeline (union of real events only) ─
create or replace function admin_student_activity(p_student_id uuid, p_limit int default 30)
returns table (
  activity_type text,
  occurred_at timestamptz,
  subject subject_type,
  topic_name text,
  detail jsonb
)
language sql stable as $$
  with combined as (
    (
      select
        case when mock_test_id is not null then 'mock_test' else 'practice' end as activity_type,
        coalesce(completed_at, started_at) as occurred_at,
        subject as subject,
        topic_name as topic_name,
        jsonb_build_object('score', score, 'accuracy', accuracy, 'attempt_id', id) as detail
      from test_attempts
      where student_id = p_student_id
      order by coalesce(completed_at, started_at) desc
      limit p_limit
    )
    union all
    (
      select
        'ai_tutor' as activity_type,
        updated_at as occurred_at,
        subject as subject,
        topic_name as topic_name,
        jsonb_build_object('conversation_id', id, 'message_count', jsonb_array_length(messages)) as detail
      from ai_conversations
      where student_id = p_student_id
      order by updated_at desc
      limit p_limit
    )
  )
  select activity_type, occurred_at, subject, topic_name, detail
  from combined
  order by occurred_at desc
  limit p_limit;
$$;

-- ── Mock tests: platform-wide attempt list ──────────────────────────────
create or replace function admin_list_test_attempts(
  p_student_id uuid default null,
  p_class_level int default null,
  p_subject subject_type default null,
  p_mock_test_id uuid default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_score_min numeric default null,
  p_score_max numeric default null,
  p_status text default null, -- 'completed' | 'in_progress' | 'abandoned'
  p_sort text default 'date_desc',
  p_page int default 1,
  p_page_size int default 20
)
returns table (
  attempt_id uuid,
  student_id uuid,
  student_name text,
  test_title text,
  subject subject_type,
  class_level smallint,
  started_at timestamptz,
  completed_at timestamptz,
  score numeric,
  accuracy numeric,
  questions_attempted smallint,
  questions_correct smallint,
  total_time_seconds int,
  status text,
  total_count bigint
)
language sql stable as $$
  with base as (
    select
      ta.id as attempt_id,
      ta.student_id,
      p.full_name as student_name,
      coalesce(mt.title, ta.topic_name, 'Practice · ' || ta.subject::text) as test_title,
      ta.subject,
      s.class_level,
      ta.started_at,
      ta.completed_at,
      ta.score,
      ta.accuracy,
      ta.questions_attempted,
      ta.questions_correct,
      ta.total_time_seconds,
      case
        when ta.completed_at is not null then 'completed'
        when ta.started_at < now() - make_interval(mins => coalesce(mt.time_limit_minutes, 30) * 3) then 'abandoned'
        else 'in_progress'
      end as status
    from test_attempts ta
    join students s on s.id = ta.student_id
    join profiles p on p.id = s.profile_id
    left join mock_tests mt on mt.id = ta.mock_test_id
  )
  select base.*, count(*) over() as total_count
  from base
  where (p_student_id is null or base.student_id = p_student_id)
    and (p_class_level is null or base.class_level = p_class_level)
    and (p_subject is null or base.subject = p_subject)
    and (p_date_from is null or coalesce(base.completed_at, base.started_at) >= p_date_from)
    and (p_date_to is null or coalesce(base.completed_at, base.started_at) <= p_date_to)
    and (p_score_min is null or base.score >= p_score_min)
    and (p_score_max is null or base.score <= p_score_max)
    and (p_status is null or base.status = p_status)
  order by
    case when p_sort = 'score_desc' then base.score end desc nulls last,
    case when p_sort = 'student_asc' then base.student_name end asc nulls last,
    case when p_sort = 'date_desc' or p_sort is null then coalesce(base.completed_at, base.started_at) end desc
  limit p_page_size offset greatest(0, (p_page - 1)) * p_page_size;
$$;

-- ── AI Tutor: per-student usage aggregation ──────────────────────────────
create or replace function admin_list_ai_tutor_usage(
  p_search text default null,
  p_sort text default 'last_session_desc',
  p_page int default 1,
  p_page_size int default 20
)
returns table (
  student_id uuid,
  student_name text,
  email text,
  sessions bigint,
  messages bigint,
  last_session_at timestamptz,
  subjects text[],
  total_count bigint
)
language sql stable as $$
  with agg as (
    select
      s.id as student_id,
      p.full_name as student_name,
      p.email,
      count(ac.id) as sessions,
      coalesce(sum(jsonb_array_length(ac.messages)), 0) as messages,
      max(ac.updated_at) as last_session_at,
      array_remove(array_agg(distinct ac.subject::text), null) as subjects
    from students s
    join profiles p on p.id = s.profile_id
    join ai_conversations ac on ac.student_id = s.id
    group by s.id, p.full_name, p.email
  )
  select agg.*, count(*) over() as total_count
  from agg
  where p_search is null or p_search = ''
    or agg.student_name ilike '%' || p_search || '%'
    or agg.email ilike '%' || p_search || '%'
  order by
    case when p_sort = 'sessions_desc' then agg.sessions end desc nulls last,
    case when p_sort = 'messages_desc' then agg.messages end desc nulls last,
    case when p_sort = 'last_session_desc' or p_sort is null then agg.last_session_at end desc nulls last
  limit p_page_size offset greatest(0, (p_page - 1)) * p_page_size;
$$;

-- ── AI Tutor: platform analytics ─────────────────────────────────────────
create or replace function admin_ai_tutor_analytics(p_from timestamptz, p_to timestamptz)
returns table (
  subject subject_type,
  session_count bigint
)
language sql stable as $$
  select subject, count(*) as session_count
  from ai_conversations
  where subject is not null
    and created_at between p_from and p_to
  group by subject
  order by session_count desc;
$$;

-- ── Dashboard: headline stats for the selected date range ───────────────
create or replace function admin_dashboard_stats(p_from timestamptz, p_to timestamptz)
returns table (
  total_students bigint,
  new_registrations bigint,
  active_students bigint,
  mock_tests_taken bigint,
  avg_score numeric,
  ai_sessions bigint
)
language sql stable as $$
  select
    (select count(*) from students),
    (select count(*) from profiles where role = 'student' and created_at between p_from and p_to),
    (select count(*) from students where last_active_at between p_from and p_to),
    (select count(*) from test_attempts where completed_at between p_from and p_to),
    (select coalesce(avg(score), 0) from test_attempts where completed_at between p_from and p_to),
    (select count(*) from ai_conversations where created_at between p_from and p_to);
$$;

-- ── Dashboard: daily time series for charts ──────────────────────────────
create or replace function admin_activity_series(p_from timestamptz, p_to timestamptz)
returns table (
  day date,
  registrations bigint,
  active_students bigint,
  mock_tests bigint,
  avg_score numeric,
  ai_sessions bigint
)
language sql stable as $$
  with days as (
    select generate_series(date_trunc('day', p_from), date_trunc('day', p_to), interval '1 day')::date as day
  )
  select
    d.day,
    coalesce((select count(*) from profiles where role = 'student' and created_at::date = d.day), 0),
    coalesce((select count(*) from students where last_active_at::date = d.day), 0),
    coalesce((select count(*) from test_attempts where completed_at::date = d.day), 0),
    coalesce((select avg(score) from test_attempts where completed_at::date = d.day), 0),
    coalesce((select count(*) from ai_conversations where created_at::date = d.day), 0)
  from days d
  order by d.day;
$$;

-- ── Dashboard / Progress: platform-wide subject performance ─────────────
create or replace function admin_platform_subject_performance(p_from timestamptz, p_to timestamptz)
returns table (
  subject subject_type,
  avg_score numeric,
  attempts_count bigint
)
language sql stable as $$
  select subject, coalesce(avg(score), 0), count(*)
  from test_attempts
  where completed_at between p_from and p_to
  group by subject
  order by subject;
$$;

-- ── Progress: students needing attention (configurable thresholds) ─────
create or replace function admin_students_needing_attention(
  p_inactive_days int,
  p_low_score_threshold numeric,
  p_low_ai_sessions int,
  p_page int default 1,
  p_page_size int default 20
)
returns table (
  student_id uuid,
  full_name text,
  email text,
  class_level smallint,
  last_active_at timestamptz,
  days_since_active int,
  last_mock_test_at timestamptz,
  avg_score numeric,
  ai_sessions bigint,
  reasons text[],
  total_count bigint
)
language sql stable as $$
  with agg as (
    select
      s.id as student_id,
      p.full_name,
      p.email,
      s.class_level,
      s.last_active_at,
      case when s.last_active_at is null then null
           else (now()::date - s.last_active_at::date) end as days_since_active,
      (select max(completed_at) from test_attempts where student_id = s.id) as last_mock_test_at,
      coalesce((select avg(score) from test_attempts where student_id = s.id and completed_at is not null), 0) as avg_score,
      coalesce((select count(*) from ai_conversations where student_id = s.id), 0) as ai_sessions
    from students s
    join profiles p on p.id = s.profile_id
    where s.account_status = 'active'
  )
  select
    agg.*,
    array_remove(array[
      case when agg.last_active_at is null or agg.days_since_active >= p_inactive_days
           then 'No recent activity (' || coalesce(agg.days_since_active::text, 'never') || ' days)' end,
      case when agg.avg_score > 0 and agg.avg_score < p_low_score_threshold
           then 'Low mock-test scores (avg ' || round(agg.avg_score, 0) || '%)' end,
      case when agg.ai_sessions <= p_low_ai_sessions
           then 'Low AI Tutor engagement (' || agg.ai_sessions || ' sessions)' end
    ], null) as reasons,
    count(*) over() as total_count
  from agg
  where (agg.last_active_at is null or agg.days_since_active >= p_inactive_days)
     or (agg.avg_score > 0 and agg.avg_score < p_low_score_threshold)
     or (agg.ai_sessions <= p_low_ai_sessions)
  order by agg.days_since_active desc nulls first
  limit p_page_size offset greatest(0, (p_page - 1)) * p_page_size;
$$;

-- ── Lock down execution to the service role only ────────────────────────
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'admin_list_students(text,int,board_type,text,text,timestamptz,timestamptz,int,int,numeric,numeric,text,int,int)',
    'admin_student_stats(uuid)',
    'admin_student_subject_progress(uuid)',
    'admin_student_topic_progress(uuid)',
    'admin_student_activity(uuid,int)',
    'admin_list_test_attempts(uuid,int,subject_type,uuid,timestamptz,timestamptz,numeric,numeric,text,text,int,int)',
    'admin_list_ai_tutor_usage(text,text,int,int)',
    'admin_ai_tutor_analytics(timestamptz,timestamptz)',
    'admin_dashboard_stats(timestamptz,timestamptz)',
    'admin_activity_series(timestamptz,timestamptz)',
    'admin_platform_subject_performance(timestamptz,timestamptz)',
    'admin_students_needing_attention(int,numeric,int,int,int)'
  ]
  loop
    execute format('revoke execute on function %s from public, anon, authenticated;', fn);
    execute format('grant execute on function %s to service_role;', fn);
  end loop;
end $$;
