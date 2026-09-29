export type ReengagementAudience = "student" | "parent";

interface ReengagementEmailInput {
  audience: ReengagementAudience;
  studentName: string;
  classLevel: number;
  /** Null when the student signed up but never used the app. */
  lastActiveAt: string | null;
  streakDays: number;
  actionUrl: string;
  unsubscribeUrl: string;
}

/**
 * "What are you still waiting for?" nudge for inactive students (and,
 * optionally, their linked parents). Three copy variants: never-started
 * student, lapsed student (mentions their old streak), and parent.
 *
 * Recipients are mostly Class 1–10 children, so the urgency is framed as
 * "your spot is open", never "you're failing". Same inline-styled table
 * layout as battle-invite-template.ts for Gmail/Outlook/Apple Mail.
 */
export function buildReengagementEmail(input: ReengagementEmailInput): { subject: string; html: string; text: string } {
  const { audience, classLevel, streakDays, actionUrl, unsubscribeUrl } = input;
  const firstName = input.studentName.trim().split(/\s+/)[0] || "there";
  const lapsed = input.lastActiveAt !== null;
  const hadStreak = lapsed && streakDays > 1;

  let subject: string;
  let greeting: string;
  let intro: string;
  let headline: string;
  let push: string;
  let cta: string;

  if (audience === "parent") {
    subject = `${firstName}'s Olympiad spot is still waiting 🏆`;
    greeting = "Hello,";
    intro = `Olympiad season is getting closer, and Class ${classLevel} students across the country are already practising daily on OlympiadIQ. ${firstName} ${lapsed ? "hasn't practised in a while" : "hasn't started practising yet"}.`;
    headline = "A little practice now makes a big difference later.";
    push = `Just 15 minutes a day is enough for ${firstName} to build confidence and get ahead. Why not sit with them today and take the first step together?`;
    cta = "Open OlympiadIQ";
  } else if (hadStreak) {
    subject = `${firstName}, your ${streakDays}-day streak is waiting for you 🔥`;
    greeting = `Hi ${firstName},`;
    intro = `You had a ${streakDays}-day streak going on OlympiadIQ, and that's awesome! Meanwhile, Class ${classLevel} students everywhere are practising every day and climbing the leaderboard.`;
    headline = "So what are you still waiting for?";
    push = "Let's get your streak back before others overtake you. Just 15 minutes today puts you ahead of everyone who is still waiting.";
    cta = "Claim my place";
  } else {
    subject = `${firstName}, what are you still waiting for? 🏆`;
    greeting = `Hi ${firstName},`;
    intro = `Olympiad season is getting closer, and Class ${classLevel} students everywhere are already practising every day, climbing the leaderboard and building their streaks.`;
    headline = "So what are you still waiting for?";
    push = "Now is the time to get your place ahead of everyone. Just 15 minutes today puts you ahead of all the students who are still waiting. The top spots won't stay open forever!";
    cta = "Claim my place";
  }

  const features = audience === "parent"
    ? [
        ["🎯", "Adaptive practice", "focuses on exactly the topics your child needs"],
        ["🤖", "AI tutor", "explains any question, any time, step by step"],
        ["📈", "Progress tracking", "so you can see how they're improving"],
      ]
    : [
        ["🎯", "Practice that adapts", "to exactly what you need to work on"],
        ["🤖", "An AI tutor", "that explains any question, any time"],
        ["⚔️", "Olympiad Battles", "challenge a friend and see who comes out on top"],
      ];

  const featureRows = features.map(([icon, title, desc]) => `
                    <tr>
                      <td style="padding:6px 0; font-size:14px; line-height:1.5; color:#4B5163;">
                        ${icon}&nbsp; <strong style="color:#1A1D29;">${title}</strong> ${desc}
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
                <div style="font-size:32px; line-height:1;">🏆</div>
                <div style="color:#FFFFFF; font-size:20px; font-weight:700; margin-top:8px;">OlympiadIQ</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px; font-size:16px; line-height:1.6; color:#1A1D29;">${escapeHtml(greeting)}</p>
                <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#4B5163;">${escapeHtml(intro)}</p>
                <p style="margin:0 0 16px; font-size:18px; line-height:1.4; font-weight:700; color:#1F3E8C;">${escapeHtml(headline)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F8; border-radius:10px; margin:20px 0;">
                  <tr><td style="padding:12px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${featureRows}
                    </table>
                  </td></tr>
                </table>
                <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#4B5163;">${escapeHtml(push)}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>
                    <td style="border-radius:8px; background:#F5B942;">
                      <a href="${actionUrl}" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:700; color:#1A1D29; text-decoration:none;">
                        ${cta} &rarr;
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
                Don&rsquo;t want these reminders? <a href="${unsubscribeUrl}" style="color:#9096A6; text-decoration:underline;">Unsubscribe</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  const text = `${greeting}

${intro}

${headline}

${features.map(([, title, desc]) => `- ${title} ${desc}`).join("\n")}

${push}

${cta}: ${actionUrl}

See you on the leaderboard,
Team OlympiadIQ

Don't want these reminders? Unsubscribe: ${unsubscribeUrl}`;

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
