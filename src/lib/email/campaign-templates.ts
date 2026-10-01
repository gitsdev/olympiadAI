/**
 * Marketing/nudge email templates for admin campaigns. Pure (no server
 * imports) so the admin UI can render live previews client-side; the same
 * builder produces the real emails in src/actions/admin/campaigns.ts.
 *
 * Recipients are mostly Class 1–10 children, so urgency is framed as "your
 * spot is open", never "you're failing". Inline-styled table layout (same
 * as battle-invite-template.ts) for Gmail/Outlook/Apple Mail.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const CAMPAIGN_IDS = ["reengagement", "mock_test", "brain_booster", "battle", "ai_tutor"] as const;
export type CampaignId = (typeof CAMPAIGN_IDS)[number];

/** Who a bulk send targets. 'inactive' uses admin_settings.inactive_days_warning. */
export type CampaignSegment = "inactive" | "all";
export type CampaignAudience = "student" | "parent";

export interface CampaignRecipient {
  audience: CampaignAudience;
  studentName: string;
  classLevel: number;
  /** Null when the student signed up but never used the app. */
  lastActiveAt: string | null;
  streakDays: number;
}

type Feature = [icon: string, title: string, desc: string];

interface CampaignContent {
  subject: string;
  greeting: string;
  intro: string;
  headline: string;
  features: Feature[];
  push: string;
  cta: string;
}

export interface CampaignDefinition {
  id: CampaignId;
  label: string;
  description: string;
  /** Header badge in the email. */
  emoji: string;
  headerTitle: string;
  /** Where the CTA button lands in the student app. */
  path: string;
  segments: CampaignSegment[];
  supportsParents: boolean;
  content: (r: CampaignRecipient, firstName: string) => CampaignContent;
}

export const CAMPAIGNS: Record<CampaignId, CampaignDefinition> = {
  reengagement: {
    id: "reengagement",
    label: "What are you waiting for?",
    description: "Nudge inactive students to claim their place before others get ahead.",
    emoji: "🏆",
    headerTitle: "OlympiadIQ",
    path: "/dashboard",
    segments: ["inactive"],
    supportsParents: true,
    content: (r, firstName) => {
      const lapsed = r.lastActiveAt !== null;
      if (r.audience === "parent") {
        return {
          subject: `${firstName}'s Olympiad spot is still waiting 🏆`,
          greeting: "Hello,",
          intro: `Olympiad season is getting closer, and Class ${r.classLevel} students across the country are already practising daily on OlympiadIQ. ${firstName} ${lapsed ? "hasn't practised in a while" : "hasn't started practising yet"}.`,
          headline: "A little practice now makes a big difference later.",
          features: [
            ["🎯", "Adaptive practice", "focuses on exactly the topics your child needs"],
            ["🤖", "AI tutor", "explains any question, any time, step by step"],
            ["📈", "Progress tracking", "so you can see how they're improving"],
          ],
          push: `Just 15 minutes a day is enough for ${firstName} to build confidence and get ahead. Why not sit with them today and take the first step together?`,
          cta: "Open OlympiadIQ",
        };
      }
      const features: Feature[] = [
        ["🎯", "Practice that adapts", "to exactly what you need to work on"],
        ["🤖", "An AI tutor", "that explains any question, any time"],
        ["⚔️", "Olympiad Battles", "challenge a friend and see who comes out on top"],
      ];
      if (lapsed && r.streakDays > 1) {
        return {
          subject: `${firstName}, your ${r.streakDays}-day streak is waiting for you 🔥`,
          greeting: `Hi ${firstName},`,
          intro: `You had a ${r.streakDays}-day streak going on OlympiadIQ, and that's awesome! Meanwhile, Class ${r.classLevel} students everywhere are practising every day and climbing the leaderboard.`,
          headline: "So what are you still waiting for?",
          features,
          push: "Let's get your streak back before others overtake you. Just 15 minutes today puts you ahead of everyone who is still waiting.",
          cta: "Claim my place",
        };
      }
      return {
        subject: `${firstName}, what are you still waiting for? 🏆`,
        greeting: `Hi ${firstName},`,
        intro: `Olympiad season is getting closer, and Class ${r.classLevel} students everywhere are already practising every day, climbing the leaderboard and building their streaks.`,
        headline: "So what are you still waiting for?",
        features,
        push: "Now is the time to get your place ahead of everyone. Just 15 minutes today puts you ahead of all the students who are still waiting. The top spots won't stay open forever!",
        cta: "Claim my place",
      };
    },
  },

  mock_test: {
    id: "mock_test",
    label: "Start a Mock Test",
    description: "Invite students to take a timed, Olympiad-style mock test.",
    emoji: "📝",
    headerTitle: "OlympiadIQ Mock Test",
    path: "/tests",
    segments: ["all", "inactive"],
    supportsParents: false,
    content: (r, firstName) => ({
      subject: `${firstName}, how ready are you for the Olympiad? 📝`,
      greeting: `Hi ${firstName},`,
      intro: `The best way to know where you stand is to try a real Olympiad-style mock test. Class ${r.classLevel} students on OlympiadIQ are already testing themselves against the clock.`,
      headline: "Are you ready to test yourself?",
      features: [
        ["⏱️", "Real exam format", "timed, just like the actual Olympiad"],
        ["📊", "Instant results", "see your score with every answer explained"],
        ["🎯", "Know your weak spots", "and exactly what to practise next"],
      ],
      push: "It takes less than 30 minutes, and you'll know exactly where you stand. The students who test early are the ones who finish on top!",
      cta: "Start a mock test",
    }),
  },

  brain_booster: {
    id: "brain_booster",
    label: "Try Brain Booster games",
    description: "Promote the quick brain-training games.",
    emoji: "🧠",
    headerTitle: "Brain Booster",
    path: "/brain-booster",
    segments: ["all", "inactive"],
    supportsParents: false,
    content: (_r, firstName) => ({
      subject: `${firstName}, can you beat these brain games? 🧠`,
      greeting: `Hi ${firstName},`,
      intro: "Brain Booster games are quick, fun challenges that make your brain faster and sharper, which is exactly what tricky Olympiad questions need.",
      headline: "Train your brain in 2 minutes a day!",
      features: [
        ["🥷", "Number Ninja", "slice the numbers in order, as fast as you can"],
        ["🧩", "Memory Match", "flip and match pairs to train your memory"],
        ["🔷", "Pattern Blitz", "spot the next shape before time runs out"],
        ["🔐", "Code Breaker", "crack the secret colour code with logic"],
      ],
      push: "Each game takes about two minutes. Play one now and see if you can beat your best score!",
      cta: "Play Brain Booster",
    }),
  },

  battle: {
    id: "battle",
    label: "Battle with a friend",
    description: "Encourage students to challenge a friend to an Olympiad Battle.",
    emoji: "⚔️",
    headerTitle: "OlympiadIQ Battle",
    path: "/battle",
    segments: ["all", "inactive"],
    supportsParents: false,
    content: (_r, firstName) => ({
      subject: `⚔️ ${firstName}, who's the Olympiad champion among your friends?`,
      greeting: `Hi ${firstName},`,
      intro: "Olympiad Battles are quiz duels: you and a friend answer the same questions, and the fastest, most accurate player wins.",
      headline: "Challenge a friend and find out who's the champ!",
      features: [
        ["✉️", "Challenge any friend", "just enter their email address"],
        ["⏱️", "Same questions, same timer", "a perfectly fair fight"],
        ["🏆", "Win rating points", "and climb the leaderboard"],
        ["🤖", "No friend around?", "battle the AI instead"],
      ],
      push: "Pick a subject, send the challenge, and play your side straight away. Your friend gets an email to play theirs. May the best mind win!",
      cta: "Start a battle",
    }),
  },

  ai_tutor: {
    id: "ai_tutor",
    label: "Try the AI Tutor",
    description: "Show students they can get any question explained, any time.",
    emoji: "🤖",
    headerTitle: "OlympiadIQ AI Tutor",
    path: "/tutor",
    segments: ["all", "inactive"],
    supportsParents: false,
    content: (_r, firstName) => ({
      subject: `${firstName}, stuck on a question? Ask your AI tutor 🤖`,
      greeting: `Hi ${firstName},`,
      intro: "Every Olympiad champion gets stuck sometimes. The difference is they don't stay stuck. Your OlympiadIQ AI tutor is ready to help, any time of day.",
      headline: "Your personal tutor is waiting for you!",
      features: [
        ["💬", "Ask anything", "any question, from any subject"],
        ["🪜", "Step-by-step answers", "learn the method, not just the answer"],
        ["🌙", "Available 24/7", "even the night before a test"],
      ],
      push: "Try it now: ask about one question you found tricky this week, and see how much easier it gets.",
      cta: "Ask my AI tutor",
    }),
  },
};

export function isCampaignId(value: unknown): value is CampaignId {
  return typeof value === "string" && (CAMPAIGN_IDS as readonly string[]).includes(value);
}

export function campaignActionUrl(id: CampaignId, audience: CampaignAudience): string {
  return `${SITE_URL}${CAMPAIGNS[id].path}?utm_source=email&utm_medium=email&utm_campaign=${id}_${audience}`;
}

export function unsubscribePageUrl(token: string): string {
  return `${SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Sample recipients for admin previews and test sends. */
export function sampleRecipients(id: CampaignId, studentName = "Aarav Sharma"): { label: string; recipient: CampaignRecipient }[] {
  const base = { studentName, classLevel: 6 };
  const lapsedAt = new Date().toISOString();
  // Only the re-engagement copy varies by activity/audience; the feature
  // promos read the same for everyone, so one sample is enough.
  if (id !== "reengagement") {
    return [{ label: "Student", recipient: { ...base, audience: "student", lastActiveAt: null, streakDays: 0 } }];
  }
  return [
    { label: "Never started", recipient: { ...base, audience: "student", lastActiveAt: null, streakDays: 0 } },
    { label: "Lapsed (had streak)", recipient: { ...base, audience: "student", lastActiveAt: lapsedAt, streakDays: 5 } },
    { label: "Parent", recipient: { ...base, audience: "parent", lastActiveAt: lapsedAt, streakDays: 5 } },
  ];
}

export function buildCampaignEmail(
  id: CampaignId,
  recipient: CampaignRecipient,
  unsubscribeUrl: string,
): { subject: string; html: string; text: string } {
  const def = CAMPAIGNS[id];
  const firstName = recipient.studentName.trim().split(/\s+/)[0] || "there";
  const c = def.content(recipient, firstName);
  const actionUrl = campaignActionUrl(id, recipient.audience);

  const featureRows = c.features.map(([icon, title, desc]) => `
                    <tr>
                      <td style="padding:6px 0; font-size:14px; line-height:1.5; color:#4B5163;">
                        ${icon}&nbsp; <strong style="color:#1A1D29;">${escapeHtml(title)}</strong> ${escapeHtml(desc)}
                      </td>
                    </tr>`).join("");

  const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background:#F3F4F8; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F8; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background:#FFFFFF; border-radius:16px; overflow:hidden; box-shadow:0 2px 10px rgba(20,30,60,0.08);">
            <tr>
              <td style="background:#1F3E8C; padding:28px 32px; text-align:center;">
                <div style="font-size:32px; line-height:1;">${def.emoji}</div>
                <div style="color:#FFFFFF; font-size:20px; font-weight:700; margin-top:8px;">${escapeHtml(def.headerTitle)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px; font-size:16px; line-height:1.6; color:#1A1D29;">${escapeHtml(c.greeting)}</p>
                <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#4B5163;">${escapeHtml(c.intro)}</p>
                <p style="margin:0 0 16px; font-size:18px; line-height:1.4; font-weight:700; color:#1F3E8C;">${escapeHtml(c.headline)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F8; border-radius:10px; margin:20px 0;">
                  <tr><td style="padding:12px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${featureRows}
                    </table>
                  </td></tr>
                </table>
                <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#4B5163;">${escapeHtml(c.push)}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>
                    <td style="border-radius:8px; background:#F5B942;">
                      <a href="${actionUrl}" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:700; color:#1A1D29; text-decoration:none;">
                        ${escapeHtml(c.cta)} &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:28px 0 0; font-size:14px; line-height:1.6; color:#4B5163;">
                  See you on the leaderboard,<br />Team OlympiadIQ
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; background:#F3F4F8; text-align:center; font-size:12px; line-height:1.6; color:#9096A6;">
                OlympiadIQ &mdash; AI-powered Olympiad preparation<br />
                Don&rsquo;t want these emails? <a href="${unsubscribeUrl}" style="color:#9096A6; text-decoration:underline;">Unsubscribe</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  const text = `${c.greeting}

${c.intro}

${c.headline}

${c.features.map(([, title, desc]) => `- ${title}: ${desc}`).join("\n")}

${c.push}

${c.cta}: ${actionUrl}

See you on the leaderboard,
Team OlympiadIQ

Don't want these emails? Unsubscribe: ${unsubscribeUrl}`;

  return { subject: c.subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
