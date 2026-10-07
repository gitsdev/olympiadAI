-- OlympiadIQ SEO Agent — Phase 2: keyword list view.
-- One row per keyword with its active cluster memberships, so the Keywords
-- page can filter/paginate on "clustered" in SQL. security_invoker makes the
-- view run with the caller's rights, so 013's admin-only RLS still applies.

create or replace view seo_keywords_overview
with (security_invoker = true) as
select
  k.*,
  coalesce(c.clusters, '[]'::jsonb) as clusters,
  c.clusters is not null as is_clustered
from seo_keywords k
left join lateral (
  select jsonb_agg(jsonb_build_object('id', cl.id, 'name', cl.name, 'role', m.role) order by cl.name) as clusters
  from seo_keyword_cluster_members m
  join seo_keyword_clusters cl on cl.id = m.cluster_id and cl.status = 'ACTIVE'
  where m.keyword_id = k.id
) c on true;

revoke all on seo_keywords_overview from anon;
grant select on seo_keywords_overview to authenticated, service_role;
