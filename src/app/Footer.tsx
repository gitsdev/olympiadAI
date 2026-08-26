import { Logo } from "@/components/brand";
import { slugify } from "@/lib/slug";

const FOOTER_COLS = [
  { h: "Platform", links: ["AI Tutor", "Practice", "Mock tests", "Readiness score", "Knowledge graph"] },
  { h: "Subjects",  links: ["Mathematics", "Science", "English", "General Knowledge", "Cyber"] },
  { h: "Company",   links: ["About", "For schools", "Careers", "Contact"] },
  { h: "Legal",     links: ["Privacy", "Terms", "Copyright policy"] },
];

function footerHref(section: string, link: string): string {
  if (section === "Subjects") return `/learn/subject/${slugify(link)}`;
  if (link === "Privacy") return "/privacy";
  return "#";
}

export function Footer() {
  return (
    <footer className="px-5 sm:px-8 pt-12 sm:pt-14 pb-8" style={{ background: "var(--ink-900)" }}>
      <div className="max-w-[1160px] mx-auto">
        {/* Brand column + link columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1.4fr_repeat(4,1fr)] gap-7 pb-9 border-b"
          style={{ borderColor: "oklch(1 0 0 / 0.10)" }}>
          {/* Brand — full width on mobile, spans first row */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Logo size={26} mono />
            <p
              className="text-[13.5px] leading-[1.6] mt-3.5 max-w-[240px]"
              style={{ color: "oklch(0.72 0.02 264)" }}
            >
              The AI-powered Olympiad preparation platform for CBSE &amp; ICSE students, Classes 1–10.
            </p>
          </div>
          {FOOTER_COLS.map(({ h, links }) => (
            <div key={h}>
              <p
                className="text-[12px] font-bold uppercase tracking-[0.08em] mb-3.5"
                style={{ color: "oklch(0.78 0.02 264)" }}
              >
                {h}
              </p>
              <div className="flex flex-col gap-2">
                {links.map((l) => (
                  <a
                    key={l}
                    href={footerHref(h, l)}
                    className="text-[13.5px] transition-colors duration-[120ms] hover:text-white"
                    style={{ color: "oklch(0.72 0.02 264)", textDecoration: "none" }}
                  >
                    {l}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 pt-5 text-[12.5px]"
          style={{ color: "oklch(0.6 0.02 264)" }}
        >
          <span>© 2026 Guild IT Solutions. All Rights Reserved. | OlympiadIQ</span>
          <span className="hidden sm:block flex-1" />
          <span style={{ fontFamily: "var(--font-mono)" }}>Made for ambitious students.</span>
        </div>
      </div>
    </footer>
  );
}
