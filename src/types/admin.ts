import type { Board, Subject, StudentAccountStatus, BattleMode, BattleStatus, BattleOutcome, Difficulty } from "./database";

export interface AdminStudentListRow {
  student_id: string;
  profile_id: string;
  full_name: string;
  email: string;
  class_level: number;
  board: Board;
  registered_at: string;
  last_active_at: string | null;
  account_status: StudentAccountStatus;
  mock_tests_taken: number;
  avg_score: number;
  ai_sessions: number;
  overall_progress: number;
  total_count: number;
}

export interface AdminStudentFilters {
  q?: string;
  classLevel?: number;
  board?: Board;
  status?: StudentAccountStatus;
  activity?: "today" | "week" | "inactive_7" | "inactive_30";
  registeredFrom?: string;
  registeredTo?: string;
  testCountMin?: number;
  testCountMax?: number;
  scoreMin?: number;
  scoreMax?: number;
  sort?: string;
}

export interface AdminStudentStats {
  mock_tests_taken: number;
  avg_score: number;
  best_score: number;
  ai_sessions: number;
  questions_attempted: number;
  total_test_time_seconds: number;
  overall_progress: number;
  last_mock_test_at: string | null;
  last_ai_session_at: string | null;
}

export interface AdminSubjectProgress {
  subject: Subject;
  questions_attempted: number;
  questions_correct: number;
  accuracy: number;
  tests_completed: number;
  avg_score: number;
  progress_pct: number;
}

export interface AdminTopicProgress {
  subject: Subject;
  chapter_name: string;
  topic_name: string;
  mastery_score: number;
  accuracy_rate: number;
  attempts_count: number;
  last_attempt_at: string;
}

export interface AdminActivityEvent {
  activity_type: "mock_test" | "practice" | "ai_tutor";
  occurred_at: string;
  subject: Subject | null;
  topic_name: string | null;
  detail: Record<string, unknown>;
}

export type MockTestAttemptStatus = "completed" | "in_progress" | "abandoned";

export interface AdminTestAttemptRow {
  attempt_id: string;
  student_id: string;
  student_name: string;
  test_title: string;
  subject: Subject;
  class_level: number;
  started_at: string;
  completed_at: string | null;
  score: number;
  accuracy: number;
  questions_attempted: number;
  questions_correct: number;
  total_time_seconds: number;
  status: MockTestAttemptStatus;
  total_count: number;
}

export interface AdminTestAttemptFilters {
  studentId?: string;
  classLevel?: number;
  subject?: Subject;
  mockTestId?: string;
  dateFrom?: string;
  dateTo?: string;
  scoreMin?: number;
  scoreMax?: number;
  status?: MockTestAttemptStatus;
  sort?: string;
}

export interface AdminAiTutorUsageRow {
  student_id: string;
  student_name: string;
  email: string;
  sessions: number;
  messages: number;
  last_session_at: string | null;
  subjects: string[];
  total_count: number;
}

export interface AdminAiTutorAnalyticsRow {
  subject: Subject;
  session_count: number;
}

export interface AdminDashboardStats {
  total_students: number;
  new_registrations: number;
  active_students: number;
  mock_tests_taken: number;
  avg_score: number;
  ai_sessions: number;
}

export interface AdminActivitySeriesPoint {
  day: string;
  registrations: number;
  active_students: number;
  mock_tests: number;
  avg_score: number;
  ai_sessions: number;
}

export interface AdminPlatformSubjectPerformance {
  subject: Subject;
  avg_score: number;
  attempts_count: number;
}

export interface AdminBattleRow {
  battle_id: string;
  student_id: string;
  student_name: string;
  mode: BattleMode;
  status: BattleStatus;
  subject: Subject;
  class_level: number;
  difficulty: Difficulty;
  question_count: number;
  student_score: number;
  ai_score: number | null;
  result: BattleOutcome | null;
  rating_delta: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  total_count: number;
}

export interface AdminBattleFilters {
  studentId?: string;
  status?: BattleStatus;
  mode?: BattleMode;
  subject?: Subject;
  classLevel?: number;
  result?: BattleOutcome;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
}

export interface AdminAttentionStudentRow {
  student_id: string;
  full_name: string;
  email: string;
  class_level: number;
  last_active_at: string | null;
  days_since_active: number | null;
  last_mock_test_at: string | null;
  avg_score: number;
  ai_sessions: number;
  reasons: string[];
  total_count: number;
}
