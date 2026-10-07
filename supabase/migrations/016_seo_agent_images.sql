-- OlympiadIQ SEO Agent — Phase 6: featured-image storage.
-- A public Supabase Storage bucket for blog cover images. Files are uploaded
-- only by server code (service role, behind requireAdmin or the publish
-- pipeline), so no INSERT policy is granted to browser clients; the bucket
-- being public just lets anyone view the published images.
-- Run after 013–015. Safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-images', 'blog-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
