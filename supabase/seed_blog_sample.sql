-- Optional: three published sample posts (with cover + inline images) for
-- testing the blog end to end. Run AFTER 003_blog_posts.sql.
-- Safe to re-run (on conflict do nothing).
--
-- Remove later with:
--   delete from blog_posts where slug in (
--     'complete-maths-olympiad-imo-roadmap-classes-3-to-10',
--     'best-books-for-maths-olympiad-classes-6-to-8',
--     'beat-negative-marking-sof-olympiad-two-pass-strategy'
--   );

-- ── 1. Olympiad Prep — newest, so it becomes the featured banner ─────────────
insert into blog_posts (
  slug, title, excerpt, content, cover_image_url, cover_image_alt,
  category, board, class_levels, tags, author_name,
  seo_title, seo_description, has_affiliate_links, status, reading_minutes, published_at
) values (
  'complete-maths-olympiad-imo-roadmap-classes-3-to-10',
  'The Complete Maths Olympiad (IMO) Preparation Roadmap for Classes 3–10',
  'A staged, parent-friendly blueprint for building Olympiad ability across Classes 3–10 — what to focus on at each level, which books to use, and how to run timed practice without burnout.',
  $md$Most students hit a wall the first time they move from school maths to a competition paper like the **SOF IMO** or a regional qualifier. A child who scores 95%+ at school can still stall on an "easy" Olympiad question — because the two exams are testing different things.

This roadmap breaks preparation into three stages by class group, with a book list and a weekly routine for each.

![A tidy study desk with maths notes, a laptop and reference books by a sunny window](https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1000&q=70&auto=format&fit=crop)

## School maths vs Olympiad maths

School exams mostly reward **knowing which procedure to run**. Olympiad problems give you an unfamiliar situation and ask you to work out *which idea even applies* — parity, symmetry, the pigeonhole principle, working backwards.

> "School maths teaches you which algorithm to execute. Olympiad maths hands you an odd scenario and dares you to find the rule that fits."

| | School exam | Maths Olympiad |
| --- | --- | --- |
| Question style | Familiar textbook patterns | Multi-step, mixed-topic puzzles |
| Time per question | 2–3 minutes | 60–90 seconds, with traps |
| What's rewarded | Accurate routine working | Pattern-spotting and eliminating wrong options |

## Stage 1 — Classes 3 to 5: foundation

The goal here is number sense and logic, not speed.

- Mental arithmetic and estimation
- Number patterns and simple sequences
- Visual/spatial puzzles, shapes, symmetry
- Everyday logical reasoning ("if… then…")

**Books:** your NCERT / Selina textbook worked cover to cover, plus one gentle puzzle book. Free NCERT texts are on the [NCERT website](https://ncert.nic.in/textbook.php).

**Routine:** 15–20 minutes a day, 4 days a week. Keep it playful.

## Stage 2 — Classes 6 to 8: the real start

This is where Olympiad-specific topics come in.

![Equations and geometry worked out on a blackboard](https://images.unsplash.com/photo-1509228468518-180dd4864904?w=1000&q=70&auto=format&fit=crop)

- Divisibility rules and basic modular arithmetic
- Factors, primes, HCF/LCM used in problems
- Counting, arrangements, and the pigeonhole principle
- Angle-chasing and basic geometry proofs

**Books:** the MTG *IMO Work Book* for your child's class (closest to the real paper), plus [R.D. Sharma for the relevant class](https://www.amazon.in/s?k=rd+sharma+mathematics+class+7) for extra worked examples.

**Routine:** 30 minutes a day, 5 days a week — same chapter order as school, one week behind the school topic.

## Stage 3 — Classes 9 to 10: speed and accuracy

- Algebraic identities and inequalities (AM–GM, Cauchy–Schwarz basics)
- Cyclic quadrilaterals and similar-triangle proofs
- Managing negative marking: when to skip, when to guess

**Books:** [*Challenge and Thrill of Pre-College Mathematics*](https://www.amazon.in/s?k=challenge+and+thrill+of+pre-college+mathematics) and past SOF IMO papers.

## A simple 12-week block

1. **Weeks 1–6:** textbook + one Olympiad workbook, two chapters a week.
2. **Weeks 7–10:** mixed practice sets and reasoning.
3. **Weeks 11–12:** one full timed past paper a week, and spend longer on the review than on the paper.

The single habit that separates top scorers: after every mock, turn each wrong answer into a one-line note in an error log. Re-read the log before the next paper.
$md$,
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&q=70&auto=format&fit=crop',
  'A student working through problems at a laptop with an open notebook',
  'Olympiad Prep',
  'Both',
  '{3,4,5,6,7,8,9,10}',
  '{IMO, Maths Olympiad, roadmap, SOF, study plan}',
  'Dr. Arvind Raman',
  'The Complete Maths Olympiad (IMO) Roadmap for Classes 3–10 — 2026',
  'A stage-by-stage IMO preparation plan for Classes 3 to 10: what to focus on at each level, recommended books, and a 12-week timed-practice block.',
  true, 'published', 7, now()
)
on conflict (slug) do nothing;

-- ── 2. Book Reviews ────────────────────────────────────────────────────────
insert into blog_posts (
  slug, title, excerpt, content, cover_image_url, cover_image_alt,
  category, board, class_levels, tags, author_name,
  seo_title, seo_description, has_affiliate_links, status, reading_minutes, published_at
) values (
  'best-books-for-maths-olympiad-classes-6-to-8',
  'Best Books to Prepare for the Maths Olympiad (Classes 6–8)',
  'A parent-friendly guide to the reference books that actually help for SOF IMO, IOM and similar Maths Olympiads — what to use for concepts, what to use for practice, and the order to work through them.',
  $md$If your child is in **Class 6, 7 or 8** and preparing for a Maths Olympiad, the hardest part is choosing what to study from. This guide splits it into three jobs — **build concepts**, **practise Olympiad-style questions**, and **take timed mocks** — and names one book for each.

![Stacked reference books and workbooks on a study desk](https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1000&q=70&auto=format&fit=crop)

## 1. Build concepts first

Olympiad questions are school topics asked in a trickier way, so start with the current syllabus.

- **NCERT Mathematics** — the best free concept source for CBSE; work every solved example. Free on the [NCERT site](https://ncert.nic.in/textbook.php).
- For ICSE, [Selina Concise Mathematics](https://www.amazon.in/s?k=selina+concise+mathematics+class+7) plays the same role.
- For harder in-chapter problems, [R.D. Sharma for the class](https://www.amazon.in/s?k=rd+sharma+mathematics+class+7).

> If your child cannot finish the NCERT/Selina exercise for a chapter in one sitting, they are not ready for Olympiad questions on that chapter yet.

## 2. Practise Olympiad-style questions

| Book | Best for | Notes |
| --- | --- | --- |
| MTG *IMO Work Book* (class-wise) | Chapter-wise Olympiad MCQs | Closest to the real SOF paper |
| MTG *Olympiad Prep-Guide* | Concept + practice combined | Good as a single book |
| Arihant *International Mathematics Olympiad* | Extra practice sets | Harder; use after MTG |

[Compare the MTG IMO workbooks for Class 6–8 on Amazon](https://www.amazon.in/s?k=mtg+imo+work+book+class+7). Buy the workbook for the child's **current class**.

## 3. Take timed mock tests

In the last 4–6 weeks, sit one full past paper a week under exam conditions, then spend more time on the review than on the paper itself.

## What you don't need

- More than one practice book per year — finishing one beats owning five.
- Class 9–10 or RMO/INMO material at this stage.

---

*Amazon prices and availability change — check the current price before buying. The links above are examples to help you find the right edition.*
$md$,
  'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&q=70&auto=format&fit=crop',
  'A student writing notes in a notebook beside open books',
  'Book Reviews',
  'Both',
  '{6,7,8}',
  '{IMO, Maths Olympiad, book list, SOF, Class 7}',
  'Pooja Raman',
  'Best Maths Olympiad Books for Classes 6–8 (IMO / IOM) — 2026 Guide',
  'Which books to use for Maths Olympiad prep in Classes 6, 7 and 8: concept books, Olympiad practice workbooks, and past papers, with a 12-week study plan.',
  true, 'published', 5, now() - interval '2 days'
)
on conflict (slug) do nothing;

-- ── 3. Exam Strategy ──────────────────────────────────────────────────────
insert into blog_posts (
  slug, title, excerpt, content, cover_image_url, cover_image_alt,
  category, board, class_levels, tags, author_name,
  seo_title, seo_description, has_affiliate_links, status, reading_minutes, published_at
) values (
  'beat-negative-marking-sof-olympiad-two-pass-strategy',
  'Beat Negative Marking: A Two-Pass Strategy for SOF Olympiad Papers',
  'How to work through a 50-question Olympiad paper so that negative marking helps you instead of hurting you — a simple two-pass method with a worked timing plan.',
  $md$Most SOF Olympiad papers now carry **negative marking** on the harder "Achievers" section. Students lose more marks to rushed guesses on hard questions than to genuinely not knowing the answer.

The fix is a **two-pass** method.

![A clock and a maths test paper on a desk](https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1000&q=70&auto=format&fit=crop)

## Pass 1 — the confident sweep

Go through every question in order. If you can solve it in under a minute, do it. If not, **mark it and move on** — do not stop to fight it.

By the end of Pass 1 you have banked every "easy" mark and you know exactly how many hard questions remain.

## Pass 2 — the hard questions

Now spend your remaining time on the marked questions, hardest section last.

- If you can eliminate two of four options, a guess is worth it.
- If you cannot eliminate anything, **leave it blank** — a blank scores 0, a wrong answer scores negative.

## A timing plan for a 60-minute, 50-question paper

| Phase | Time | What you're doing |
| --- | --- | --- |
| Pass 1 | 35 min | Every question once; solve the quick ones |
| Pass 2 | 20 min | Marked questions + educated guesses |
| Review | 5 min | Check the answer sheet is filled correctly |

> The goal is not to answer everything. It is to make sure every mark you *can* get is on the sheet before you gamble on the ones you can't.

Practise this on past papers until the two passes feel automatic — it is worth 5–10 marks on exam day.
$md$,
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=70&auto=format&fit=crop',
  'Students working through practice papers at a desk',
  'Exam Strategy',
  'Both',
  '{6,7,8,9,10}',
  '{exam strategy, negative marking, SOF, time management}',
  'S. Narayanan',
  'Beat Negative Marking in SOF Olympiad Papers — A Two-Pass Strategy',
  'A simple two-pass method for working through a negative-marked Olympiad paper, with a minute-by-minute timing plan for a 50-question test.',
  false, 'published', 4, now() - interval '4 days'
)
on conflict (slug) do nothing;
