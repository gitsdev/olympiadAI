-- OlympiadIQ — Administrator Area: Olympiad Battle read-only aggregation
-- Additive only. Mirrors the convention in 005_admin_queries.sql:
-- SECURITY INVOKER SQL function doing filter/paginate/aggregate in Postgres,
-- a `total_count` window column, revoked from anon/authenticated, granted
-- to service_role only. Detail views (a single battle) use plain joined
-- `.select()` calls via the service client instead — no RPC needed there.

create or replace function admin_list_battles(
  p_student_id   uuid default null,
  p_status       battle_status default null,
  p_mode         battle_mode default null,
  p_subject      subject_type default null,
  p_class_level  int default null,
  p_result       battle_result default null, -- filters on the human participant's result
  p_date_from    timestamptz default null,
  p_date_to      timestamptz default null,
  p_sort         text default 'date_desc',
  p_page         int default 1,
  p_page_size    int default 20
)
returns table (
  battle_id        uuid,
  student_id       uuid,
  student_name     text,
  mode             battle_mode,
  status           battle_status,
  subject          subject_type,
  class_level      smallint,
  difficulty       difficulty_type,
  question_count   smallint,
  student_score    int,
  ai_score         int,
  result           battle_result,
  rating_delta     int,
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz,
  total_count      bigint
)
language sql stable as $$
  with base as (
    select
      b.id as battle_id,
      s.id as student_id,
      p.full_name as student_name,
      b.mode, b.status, b.subject, b.class_level, b.difficulty, b.question_count,
      hp.score as student_score,
      aip.score as ai_score,
      hp.result,
      hp.rating_delta,
      b.started_at, b.completed_at, b.created_at
    from battles b
    join students s on s.id = b.created_by
    join profiles p on p.id = s.profile_id
    join battle_participants hp on hp.battle_id = b.id and hp.is_ai = false
    left join battle_participants aip on aip.battle_id = b.id and aip.is_ai = true
  )
  select base.*, count(*) over() as total_count
  from base
  where (p_student_id is null or base.student_id = p_student_id)
    and (p_status is null or base.status = p_status)
    and (p_mode is null or base.mode = p_mode)
    and (p_subject is null or base.subject = p_subject)
    and (p_class_level is null or base.class_level = p_class_level)
    and (p_result is null or base.result = p_result)
    and (p_date_from is null or base.created_at >= p_date_from)
    and (p_date_to is null or base.created_at <= p_date_to)
  order by
    case when p_sort = 'score_desc' then base.student_score end desc nulls last,
    case when p_sort = 'student_asc' then base.student_name end asc nulls last,
    case when p_sort = 'date_desc' or p_sort is null then base.created_at end desc
  limit p_page_size offset greatest(0, (p_page - 1)) * p_page_size;
$$;

do $$
begin
  execute 'revoke execute on function admin_list_battles(uuid,battle_status,battle_mode,subject_type,int,battle_result,timestamptz,timestamptz,text,int,int) from public, anon, authenticated;';
  execute 'grant execute on function admin_list_battles(uuid,battle_status,battle_mode,subject_type,int,battle_result,timestamptz,timestamptz,text,int,int) to service_role;';
end $$;
