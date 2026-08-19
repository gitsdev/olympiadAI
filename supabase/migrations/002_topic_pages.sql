-- OlympiadIQ — Public /learn/[slug] topic pages
-- Thin routing/structure layer for public curriculum topic pages. The rich
-- content (definition, formula, examples, common mistakes) lives in the
-- existing `concepts` table, matched by (subject, class_level, topic_name).

create table topic_pages (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  subject        subject_type not null,
  class_level    smallint not null check (class_level between 1 and 12),
  chapter_name   text not null,
  topic_name     text not null,
  summary        text not null,               -- 1-2 sentence intro / meta description
  olympiad_tags  text[] not null default '{}', -- e.g. {SOF IMO, IOQM}
  order_index    smallint not null default 0,
  created_at     timestamptz not null default now(),
  unique (subject, class_level, topic_name)
);

create index idx_topic_pages_subject_class on topic_pages(subject, class_level);

alter table topic_pages enable row level security;
create policy "public read topic_pages" on topic_pages for select using (true);
