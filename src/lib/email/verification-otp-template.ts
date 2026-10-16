interface VerificationOtpEmailInput {
  name: string;
  code: string;
  expiresInMinutes: number;
}

/**
 * Signup email-verification code. Same inline-styled, image-free layout as the
 * battle invite (see battle-invite-template.ts) so it renders consistently
 * across Gmail/Outlook/Apple Mail. The code goes in the subject too, so it's
 * readable straight from the inbox notification. Kept deliberately plain — no
 * emoji, hidden preheader text, links or images — since spam filters weigh
 * those against short transactional mail from a newer sending domain.
 */
export function buildVerificationOtpEmail(input: VerificationOtpEmailInput): { subject: string; html: string; text: string } {
  const { name, code, expiresInMinutes } = input;
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const subject = `Your OlympiadIQ verification code: ${code}`;
  // Letter-spaced digits read more easily and are harder to mistype.
  const spacedCode = code.split("").join("&#8202;");

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
                <div style="color:#FFFFFF; font-size:20px; font-weight:700;">Verify your email</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px; font-size:16px; line-height:1.6; color:#1A1D29;">
                  Hi ${escapeHtml(firstName)}, welcome to OlympiadIQ.
                </p>
                <p style="margin:0 0 8px; font-size:14px; line-height:1.6; color:#4B5163;">
                  Enter this code on the verification screen to activate your account:
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                  <tr>
                    <td align="center" style="background:#F3F4F8; border:1px dashed #C9CEDB; border-radius:12px; padding:20px 12px;">
                      <div style="font-family:'SFMono-Regular',Menlo,Consolas,'Courier New',monospace; font-size:36px; font-weight:700; letter-spacing:10px; color:#1F3E8C;">${spacedCode}</div>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#4B5163;">
                  This code expires in <strong>${expiresInMinutes} minutes</strong>. For your security, never share it with anyone &mdash; OlympiadIQ will never ask you for it.
                </p>
                <p style="margin:24px 0 0; font-size:12px; line-height:1.6; color:#9096A6;">
                  Didn&rsquo;t create an OlympiadIQ account? You can safely ignore this email.
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

  const text = `Hi ${firstName}, welcome to OlympiadIQ!

Your verification code is: ${code}

Enter it on the verification screen to activate your account. It expires in ${expiresInMinutes} minutes. Never share this code with anyone.

Didn't create an OlympiadIQ account? You can safely ignore this email.`;

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
