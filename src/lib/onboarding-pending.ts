import type { Board, Subject } from "@/types/database";

export const PENDING_ONBOARDING_COOKIE = "oiq_pending_onboarding";
export const PENDING_ONBOARDING_MAX_AGE_SECONDS = 60 * 60;

export interface PendingOnboarding {
  board: Board;
  classLevel: number;
  subjects: Subject[];
}

const BOARDS: Board[] = ["CBSE", "ICSE"];
const SUBJECTS: Subject[] = ["Mathematics", "Science", "English", "General Knowledge", "Cyber"];

export function serializePending(p: PendingOnboarding): string {
  return encodeURIComponent(JSON.stringify(p));
}

export function parsePending(raw: string | undefined): PendingOnboarding | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as Partial<PendingOnboarding>;
    if (!BOARDS.includes(v.board as Board)) return null;
    if (typeof v.classLevel !== "number" || !Number.isInteger(v.classLevel) || v.classLevel < 1 || v.classLevel > 10) return null;
    if (!Array.isArray(v.subjects) || !v.subjects.every((s) => SUBJECTS.includes(s as Subject))) return null;
    return { board: v.board as Board, classLevel: v.classLevel, subjects: v.subjects as Subject[] };
  } catch {
    return null;
  }
}
