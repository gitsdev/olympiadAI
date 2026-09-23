interface BattleInviteEmailInput {
  inviterName: string;
  subject: string;
  difficulty: string;
  questionCount: number;
  actionUrl: string;
}

/**
 * Plain inline-styled HTML (no external CSS/images) so it renders reasonably
 * in Gmail/Outlook/Apple Mail alike. Hex colors are hand-picked approximations
 * of the app's cobalt/gold design tokens — email clients can't read CSS
 * custom properties.
 */
export function buildBattleInviteEmail(input: BattleInviteEmailInput): { subject: string; html: string; text: string } {
  const { inviterName, subject, difficulty, questionCount, actionUrl } = input;
  const emailSubject = `⚔️ ${inviterName} challenged you to an Olympiad Battle!`;

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
                <div style="font-size:32px; line-height:1;">⚔️</div>
                <div style="color:#FFFFFF; font-size:20px; font-weight:700; margin-top:8px;">OlympiadIQ Battle</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px; font-size:16px; line-height:1.6; color:#1A1D29;">
                  <strong>${escapeHtml(inviterName)}</strong> just challenged you to an Olympiad Battle! 🎉
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F8; border-radius:10px; margin:20px 0;">
                  <tr>
                    <td style="padding:16px 20px; font-size:14px; color:#4B5163;">
                      <div style="margin-bottom:6px;"><strong>Subject:</strong> ${escapeHtml(subject)}</div>
                      <div style="margin-bottom:6px;"><strong>Difficulty:</strong> ${escapeHtml(difficulty)}</div>
                      <div><strong>Questions:</strong> ${questionCount}</div>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#4B5163;">
                  Click below to accept the challenge. If you don&rsquo;t have an OlympiadIQ account yet, this link will help you create one first &mdash; it only takes a minute.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>
                    <td style="border-radius:8px; background:#F5B942;">
                      <a href="${actionUrl}" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:700; color:#1A1D29; text-decoration:none;">
                        Accept the Challenge
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:28px 0 0; font-size:12px; line-height:1.6; color:#9096A6;">
                  If the button doesn&rsquo;t work, copy and paste this link into your browser:<br />
                  <a href="${actionUrl}" style="color:#1F3E8C; word-break:break-all;">${actionUrl}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; background:#F3F4F8; text-align:center; font-size:12px; color:#9096A6;">
                OlympiadIQ &mdash; AI-powered Olympiad preparation
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  const text = `${inviterName} challenged you to an Olympiad Battle!

Subject: ${subject}
Difficulty: ${difficulty}
Questions: ${questionCount}

Accept the challenge: ${actionUrl}

If you don't have an OlympiadIQ account yet, this link will help you create one first.`;

  return { subject: emailSubject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
