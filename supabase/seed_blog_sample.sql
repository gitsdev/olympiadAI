-- Optional: one sample published post for testing the blog.
-- Run AFTER 003_blog_posts.sql. Safe to run more than once (on conflict do nothing).
-- Delete later with:  delete from blog_posts where slug = 'best-books-for-maths-olympiad-classes-6-to-8';

insert into blog_posts (
  slug, title, excerpt, content, cover_image_url, cover_image_alt,
  category, board, class_levels, tags, author_name,
  seo_title, seo_description, has_affiliate_links, status, reading_minutes, published_at
) values (
  'best-books-for-maths-olympiad-classes-6-to-8',
  'Best Books to Prepare for the Maths Olympiad (Classes 6–8)',
  'A parent-friendly guide to the reference books that actually help for SOF IMO, IOM and similar Maths Olympiads — what to use for concepts, what to use for practice, and the order to work through them.',
  $md$If your child is in **Class 6, 7 or 8** and preparing for a Maths Olympiad — the SOF **IMO**, **IOM**, Unified Council's **UIMO**, or a school-run contest — the hardest part is usually choosing what to study from. School textbooks are not enough on their own, and the Olympiad shelf in any bookshop is overwhelming.

This guide breaks it into three jobs: **build concepts**, **practise Olympiad-style questions**, and **take timed mock tests**. Pick one book for each job and you have a complete plan.

## 1. Build concepts (do this first)

Olympiad questions are just school topics asked in a trickier way. Before any Olympiad-specific book, your child should be comfortable with the current year's syllabus.

- **NCERT Mathematics (class textbook)** — still the best free concept source for CBSE. Work every solved example and every exercise. It is available free from the [NCERT website](https://ncert.nic.in/textbook.php).
- For ICSE, the **Selina Concise Mathematics** series plays the same role — [browse the Selina Class 7 book on Amazon](https://www.amazon.in/s?k=selina+concise+mathematics+class+7).
- For extra worked examples and slightly harder in-chapter problems, **R.D. Sharma** for the relevant class is the standard choice — [see R.D. Sharma Class 7 on Amazon](https://www.amazon.in/s?k=rd+sharma+mathematics+class+7).

> Rule of thumb: if your child cannot finish the NCERT/Selina exercise for a chapter in one sitting, they are not ready for Olympiad questions on that chapter yet.

## 2. Practise Olympiad-style questions

Once a chapter's basics are solid, switch to a book written specifically for the Olympiad pattern (MCQs, "achievers section", logical reasoning).

| Book | Best for | Notes |
| --- | --- | --- |
| MTG *IMO Work Book* (class-wise) | Chapter-wise Olympiad MCQs | Closest to the real SOF paper pattern |
| MTG *Olympiad Prep-Guide* | Concept + practice combined | Good if you want a single book |
| Arihant *International Mathematics Olympiad* | Extra practice sets | Slightly harder; use after MTG |

You can [compare the MTG IMO workbooks for Class 6–8 on Amazon](https://www.amazon.in/s?k=mtg+imo+work+book+class+7). Buy the workbook for your child's **current class**, not a higher one.

## 3. Take timed mock tests

In the last 4–6 weeks before the exam, practice must become timed.

- Use the **previous years' SOF IMO papers** (MTG publishes an official *IMO Previous Years Papers* booklet each year).
- Sit one full paper a week under exam conditions: same time limit, no calculator, no help.
- After each paper, spend more time on the **review** than on the paper itself — every wrong answer should turn into a note.

## A simple 12-week plan

1. **Weeks 1–6:** NCERT/Selina + R.D. Sharma, two chapters a week.
2. **Weeks 7–10:** MTG IMO workbook, same chapter order, plus reasoning practice.
3. **Weeks 11–12:** One timed past paper per week + focused review.

## What you don't need

- More than one practice book per year. Finishing one beats owning five.
- Books aimed at Class 9–10 or the "advanced" RMO/INMO track — those come later.
- Expensive "guaranteed rank" coaching kits. The books above plus consistent daily practice cover the SOF/IOM level completely.

---

*Prices and availability on Amazon change over time — check the current price before buying. The Amazon links above are examples to help you find the right edition; any well-reviewed recent edition of these titles is fine.*
$md$,
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=70',
  'A student working through maths problems at a desk with books and a notebook',
  'Book Reviews',
  'Both',
  '{6,7,8}',
  '{IMO, Maths Olympiad, book list, Class 6, Class 7, Class 8, SOF}',
  'OlympiadIQ Team',
  'Best Maths Olympiad Books for Classes 6–8 (IMO / IOM) — 2026 Guide',
  'Which books to use for Maths Olympiad prep in Classes 6, 7 and 8: concept books, Olympiad practice workbooks, and past papers, with a 12-week study plan.',
  true,
  'published',
  5,
  now()
)
on conflict (slug) do nothing;
