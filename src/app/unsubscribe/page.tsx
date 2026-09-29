import type { Metadata } from "next";
import Link from "next/link";
import { MailX, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/brand";
import { OAButton } from "@/components/ui";
import { confirmUnsubscribe } from "@/actions/unsubscribe";

export const metadata: Metadata = {
  title: "Unsubscribe | OlympiadIQ",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * Human-facing unsubscribe link from reminder emails. Requires a button
 * click (not a bare GET) so email link scanners can't unsubscribe people.
 */
export default async function UnsubscribePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const done = sp.done === "1";
  const invalid = sp.invalid === "1" || (!done && !sp.token);

  let title: string;
  let body: string;
  if (done) {
    title = "You're unsubscribed.";
    body = "You won't receive any more reminder emails from OlympiadIQ. Important account emails, like password resets, will still reach you.";
  } else if (invalid) {
    title = "This link isn't valid.";
    body = "The unsubscribe link may be incomplete or out of date. Please use the link from the most recent email.";
  } else {
    title = "Unsubscribe from reminders?";
    body = "You'll stop receiving practice reminder emails from OlympiadIQ. Important account emails, like password resets, will still reach you.";
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative graph-bg px-4"
      style={{ background: "var(--paper)", backgroundSize: "26px 26px" }}
    >
      <div
        className="relative w-full max-w-[380px] rounded-[var(--r-2xl)] border border-[var(--line-200)] shadow-[var(--shadow-lg)] p-8 text-center"
        style={{ background: "var(--surface)" }}
      >
        <Logo size={32} />
        <div
          className="w-16 h-16 mx-auto mt-7 mb-5 rounded-full flex items-center justify-center"
          style={{ background: "var(--cobalt-50)" }}
        >
          {done
            ? <CheckCircle2 size={30} style={{ color: "var(--brand)" }} />
            : <MailX size={30} style={{ color: "var(--brand)" }} />}
        </div>
        <h1
          className="font-bold text-[24px] tracking-tight mb-2"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}
        >
          {title}
        </h1>
        <p className="text-[14px] leading-[1.6] mb-6" style={{ color: "var(--fg-muted)" }}>{body}</p>

        {!done && !invalid && (
          <form action={confirmUnsubscribe} className="mb-5">
            <input type="hidden" name="token" value={sp.token} />
            <OAButton type="submit" className="w-full">Unsubscribe</OAButton>
          </form>
        )}

        <p className="text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
          <Link href="/" className="font-semibold" style={{ color: "var(--brand)" }}>
            Back to OlympiadIQ
          </Link>
        </p>
      </div>
    </div>
  );
}
