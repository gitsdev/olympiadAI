import * as React from "react";

export type Subject = "Mathematics" | "Science" | "English" | "General Knowledge" | "Cyber";

const SUBJECT_COLORS: Record<Subject, string> = {
  Mathematics:       "var(--subj-math)",
  Science:           "var(--subj-science)",
  English:           "var(--subj-english)",
  "General Knowledge": "var(--subj-gk)",
  Cyber:             "var(--subj-cyber)",
};

interface OASubjectDotProps {
  subject: Subject;
  size?: number;
}

function OASubjectDot({ subject, size = 9 }: OASubjectDotProps) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: SUBJECT_COLORS[subject] ?? "var(--brand)",
        flexShrink: 0,
      }}
      aria-label={subject}
    />
  );
}

export { OASubjectDot, SUBJECT_COLORS };
