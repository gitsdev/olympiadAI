export type StudentView =
  | "home"
  | "tutor"
  | "practice"
  | "results"
  | "learn"
  | "tests"
  | "achievements"
  | "profile";

export interface StudentUser {
  id: string;
  name: string;
  email: string;
  board: "CBSE" | "ICSE";
  cls: number;
  streakDays: number;
  readinessScore: number;
}
