import { OAAvatar, OABadge } from "@/components/ui";
import { StudentHeaderActions } from "./StudentHeaderActions";
import type { StudentRow, ProfileRow } from "@/types/database";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never active";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "Active today";
  if (days === 1) return "Active yesterday";
  return `Active ${days} days ago`;
}

interface StudentProfileHeaderProps {
  studentId: string;
  student: StudentRow;
  profile: Pick<ProfileRow, "full_name" | "email" | "avatar_url" | "created_at">;
}

export function StudentProfileHeader({ studentId, student, profile }: StudentProfileHeaderProps) {
  return (
    <div
      className="rounded-[var(--r-lg)] border p-5 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6"
      style={{ borderColor: "var(--line-200)", background: "var(--surface)" }}
    >
      <OAAvatar name={profile.full_name} size={56} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-bold text-[19px]" style={{ fontFamily: "var(--font-display)", color: "var(--ink-900)" }}>
            {profile.full_name}
          </h2>
          {student.account_status === "suspended" ? (
            <OABadge tone="red">Suspended</OABadge>
          ) : (
            <OABadge tone="green">Active</OABadge>
          )}
        </div>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-muted)" }}>{profile.email}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12.5px]" style={{ color: "var(--fg-muted)" }}>
          <span>ID: <span className="font-mono">{studentId.slice(0, 8)}</span></span>
          <span>{student.board} · Class {student.class_level}</span>
          <span>Registered {formatDate(profile.created_at)}</span>
          <span>{formatRelative(student.last_active_at)}</span>
        </div>
      </div>

      <StudentHeaderActions
        studentId={studentId}
        student={student}
        fullName={profile.full_name}
        status={student.account_status}
        email={profile.email}
      />
    </div>
  );
}
