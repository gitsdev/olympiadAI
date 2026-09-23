import nodemailer from "nodemailer";

// Brevo (formerly Sendinblue) SMTP relay — see
// https://app.brevo.com/settings/keys/smtp for the login/key pair. Set these
// in .env.local (never commit real values); see .env.example for the full list.
const BREVO_SMTP_HOST = process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com";
const BREVO_SMTP_PORT = Number(process.env.BREVO_SMTP_PORT || 587);
const BREVO_SMTP_USER = process.env.BREVO_SMTP_USER;
const BREVO_SMTP_PASS = process.env.BREVO_SMTP_PASS;
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || "no-reply@olympiadiq.in";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "OlympiadIQ";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!BREVO_SMTP_USER || !BREVO_SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: BREVO_SMTP_HOST,
      port: BREVO_SMTP_PORT,
      secure: false, // Brevo uses STARTTLS on 587, not implicit TLS
      auth: { user: BREVO_SMTP_USER, pass: BREVO_SMTP_PASS },
    });
  }
  return transporter;
}

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends a transactional email via Brevo's SMTP relay. Returns { sent: false }
 * (never throws) when BREVO_SMTP_USER/PASS aren't configured, so callers can
 * degrade gracefully (e.g. the invite still exists in-app even if the email
 * doesn't go out) rather than failing the whole action over missing config.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) {
    console.error("[sendEmail] BREVO_SMTP_USER/BREVO_SMTP_PASS not configured — skipping send.");
    return { sent: false, error: "Email is not configured." };
  }
  try {
    await t.sendMail({
      from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM_ADDRESS}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { sent: true };
  } catch (err) {
    console.error("[sendEmail] Brevo send failed:", err);
    return { sent: false, error: err instanceof Error ? err.message : "Send failed." };
  }
}
