-- OlympiadIQ — Blog / Amazon-affiliate content
-- Public-read blog for Olympiad prep + ICSE/CBSE study references. Content is
-- authored in the in-app admin (/admin/blog) by platform_admin users and
-- written with the service-role key, so no INSERT/UPDATE policy is needed —
-- only public SELECT of *published* rows.

create type blog_status as enum ('draft', 'published');

create table blog_posts (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,          -- derived from the title, used as the URL
  title            text not null,
  excerpt          text not null,                 -- 1-2 sentence summary / list + meta description fallback
  content          text not null,                 -- Markdown (GFM)
  cover_image_url  text,                           -- absolute URL (og + hero)
  cover_image_alt  text,
  category         text not null default 'Study Guides'
                     check (category in (
                       'Olympiad Prep', 'Study Guides', 'Book Reviews',
                       'Exam Strategy', 'Parent Resources'
                     )),
  board            text not null default 'Both'
                     check (board in ('CBSE', 'ICSE', 'Both')),
  class_levels     smallint[] not null default '{}',   -- e.g. {6,7,8}; empty = all
  tags             text[] not null default '{}',
  author_name      text not null default 'OlympiadIQ Team',
  -- SEO overrides (fall back to title/excerpt when null)
  seo_title        text,
  seo_description  text,
  -- Amazon Associates: show the "prices/availability as of…" disclaimer on
  -- posts that reference specific products.
  has_affiliate_links boolean not null default true,
  status           blog_status not null default 'draft',
  reading_minutes  smallint not null default 1,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id) on delete set null
);

create index idx_blog_posts_status_published on blog_posts (status, published_at desc);
create index idx_blog_posts_category on blog_posts (category);

alter table blog_posts enable row level security;

-- Anonymous + authenticated visitors may read published posts only.
create policy "public read published blog_posts" on blog_posts
  for select using (status = 'published');

-- Keep updated_at fresh (trigger fn defined in 001_initial_schema.sql).
create trigger trg_blog_posts_updated_at
  before update on blog_posts
  for each row execute procedure update_updated_at();
