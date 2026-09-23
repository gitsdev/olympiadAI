export type Board = "CBSE" | "ICSE";
export type Subject = "Mathematics" | "Science" | "English" | "General Knowledge" | "Cyber";
export type Difficulty = "Easy" | "Medium" | "Hard" | "HOTS" | "Adaptive";
export type QuestionType = "MCQ" | "MultipleCorrect" | "FillBlanks" | "TrueFalse" | "Reasoning" | "HOTS" | "Olympiad";
export type NodeState = "mastered" | "active" | "weak" | "locked";
export type ResourceType = "video" | "article" | "practice" | "worksheet" | "ncert" | "other";
export type RefType = "video" | "concept" | "example" | "practice" | "source";

/* ── Shared helpers ─────────────────────────────────────────────────── */
export interface StudyPlanItem {
  id: string;
  subject: Subject;
  title: string;
  kind: "Concept" | "Practice" | "Resource" | "Mock test";
  minutes: number;
  done: boolean;
  topic_name?: string;
}

// Matches what /api/tutor actually persists (src/app/api/tutor/route.ts) —
// no per-message timestamp is stored, only the conversation's created/updated_at.
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TutorReference {
  id: string;
  type: RefType;
  title: string;
  src: string;
  meta: string;
  url?: string;
  videoId?: string;   // YouTube video ID for in-app embed
  searchUrl?: string; // YouTube search fallback
}

/* ── Row types (used as Table<"name">) ──────────────────────────────── */
export interface ProfileRow {
  id: string; email: string; full_name: string;
  role: "student" | "parent" | "teacher" | "school_admin" | "platform_admin";
  avatar_url: string | null; created_at: string; updated_at: string;
}

export type StudentAccountStatus = "active" | "suspended";

export interface StudentRow {
  id: string; profile_id: string; board: Board; class_level: number;
  subjects: Subject[]; streak_days: number; readiness_score: number;
  total_points: number; created_at: string; updated_at: string;
  last_active_at: string | null; account_status: StudentAccountStatus;
}

export interface ParentRow {
  id: string; profile_id: string; student_ids: string[]; created_at: string;
}

export interface ConceptRow {
  id: string; title: string; definition: string; formula: string | null;
  examples: string[]; common_mistakes: string[]; subject: Subject;
  class_level: number; board: Board; chapter_name: string | null;
  topic_name: string | null; difficulty: Difficulty; created_at: string;
}

export interface ResourceRow {
  id: string; title: string; url: string; source_name: string;
  resource_type: ResourceType; subject: Subject; class_level: number; board: Board;
  chapter_name: string | null; topic_name: string | null;
  ai_summary: string | null; duration_seconds: number | null; created_at: string;
}

export interface QuestionRow {
  id: string; question_text: string; question_type: QuestionType;
  subject: Subject; class_level: number; board: Board;
  chapter_name: string | null; topic_name: string | null;
  difficulty: Difficulty; explanation: string; correct_answer_index: number | null;
  estimated_time_seconds: number; created_at: string;
}

export interface QuestionOptionRow {
  id: string; question_id: string; option_text: string;
  option_index: number; is_correct: boolean;
}

export interface MockTestRow {
  id: string; student_id: string | null; title: string; subject: Subject;
  class_level: number; board: Board; topic_name: string | null;
  difficulty: Difficulty; question_count: number; time_limit_minutes: number;
  is_adaptive: boolean; created_at: string;
}

export interface TestAttemptRow {
  id: string; student_id: string; mock_test_id: string | null;
  subject: Subject; topic_name: string | null;
  score: number; accuracy: number; avg_time_per_question_seconds: number;
  total_time_seconds: number; questions_attempted: number; questions_correct: number;
  readiness_score_after: number; started_at: string; completed_at: string | null;
}

export interface AttemptAnswerRow {
  id: string; attempt_id: string; question_id: string;
  selected_option_index: number | null; is_correct: boolean;
  time_taken_seconds: number; created_at: string;
}

export interface PerformanceMetricRow {
  id: string; student_id: string; subject: Subject; topic_name: string;
  mastery_score: number; accuracy_rate: number; attempts_count: number;
  last_attempt_at: string; updated_at: string;
}

export interface StudyPlanRow {
  id: string; student_id: string; plan_date: string;
  items: StudyPlanItem[]; total_minutes: number; created_at: string;
}

export interface AchievementRow {
  id: string; student_id: string; badge_key: string; earned_at: string;
}

export interface AIConversationRow {
  id: string; student_id: string; messages: ConversationMessage[];
  subject: Subject | null; topic_name: string | null;
  created_at: string; updated_at: string;
}

export interface KnowledgeNodeRow {
  id: string; topic_id: string | null; label: string; description: string | null;
  prerequisites: string[]; class_level: number; board: Board; subject: Subject; created_at: string;
}

export interface KnowledgeEdgeRow {
  id: string; from_node_id: string; to_node_id: string; weight: number;
}

export interface TopicPageRow {
  id: string; slug: string; subject: Subject; class_level: number;
  chapter_name: string; topic_name: string; summary: string;
  olympiad_tags: string[]; order_index: number; created_at: string;
}

export type BlogCategory =
  | "Olympiad Prep" | "Study Guides" | "Book Reviews"
  | "Exam Strategy" | "Parent Resources";
export type BlogBoard = "CBSE" | "ICSE" | "Both";
export type BlogStatus = "draft" | "published";

export interface BlogPostRow {
  id: string; slug: string; title: string; excerpt: string; content: string;
  cover_image_url: string | null; cover_image_alt: string | null;
  category: BlogCategory; board: BlogBoard; class_levels: number[];
  tags: string[]; author_name: string;
  seo_title: string | null; seo_description: string | null;
  has_affiliate_links: boolean; status: BlogStatus; reading_minutes: number;
  published_at: string | null; created_at: string; updated_at: string;
  created_by: string | null;
}

export interface AdminSettingsRow {
  id: 1; inactive_days_warning: number; inactive_days_critical: number;
  low_score_threshold: number; low_ai_engagement_sessions: number;
  updated_at: string; updated_by: string | null;
}

export interface AdminAuditLogRow {
  id: string; admin_id: string | null; action: string; target_type: string;
  target_id: string | null; metadata: Record<string, unknown>; created_at: string;
}

/* ── Olympiad Battle ──────────────────────────────────────────────────
   'ai' is the only mode Phase 1 writes; pvp_random/pvp_private are
   reserved for the live-matchmaking/private-code phase. */
export type BattleMode = "ai" | "pvp_random" | "pvp_private";
export type BattleStatus = "pending" | "active" | "completed" | "cancelled";
export type BattleOutcome = "win" | "loss" | "draw";

export interface BattleQuestionOption {
  index: number;
  text: string;
}

export interface BattleRow {
  id: string; mode: BattleMode; status: BattleStatus; subject: Subject;
  class_level: number; board: Board; difficulty: Difficulty; question_count: number;
  time_per_question_seconds: number; created_by: string; room_code: string | null;
  started_at: string | null; completed_at: string | null; cancelled_at: string | null;
  created_at: string; winner_participant_id: string | null;
}

export interface BattleParticipantRow {
  id: string; battle_id: string; student_id: string | null; is_ai: boolean;
  ai_difficulty_key: Difficulty | null; score: number; correct_count: number;
  incorrect_count: number; timeout_count: number; total_time_seconds: number;
  rating_before: number | null; rating_after: number | null; rating_delta: number | null;
  result: BattleOutcome | null; joined_at: string; finished_at: string | null;
}

export type BattleInvitationStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";

export interface BattleInvitationRow {
  id: string; inviter_student_id: string; invitee_email: string; invitee_student_id: string | null;
  subject: Subject; difficulty: Difficulty; class_level: number; board: Board; question_count: number;
  status: BattleInvitationStatus; battle_id: string | null;
  created_at: string; responded_at: string | null; expires_at: string;
}

export interface BattleQuestionRow {
  id: string; battle_id: string; question_id: string | null; order_index: number;
  question_text: string; options: BattleQuestionOption[]; correct_option_index: number;
  explanation: string; topic_name: string | null; difficulty: Difficulty;
  time_limit_seconds: number;
}

export interface BattleAnswerRow {
  id: string; battle_id: string; battle_question_id: string; participant_id: string;
  selected_option_index: number | null; is_correct: boolean; time_taken_seconds: number;
  points_awarded: number; answered_at: string;
}

export interface StudentBattleStatsRow {
  student_id: string; rating: number; wins: number; losses: number; draws: number;
  current_streak: number; best_win_streak: number; battles_played: number;
  last_battle_at: string | null; updated_at: string;
}

export type BattleConfigCategory = "scoring" | "timer" | "ai_difficulty" | "rating" | "achievements";

export interface BattleConfigRow {
  key: string; category: BattleConfigCategory; label: string; description: string | null;
  value: Record<string, unknown>; updated_at: string; updated_by: string | null;
}

/* ── Database schema (for Supabase client generic) ──────────────────── */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: { id: string; email: string; full_name: string; role?: ProfileRow["role"]; avatar_url?: string | null };
        Update: Partial<{ email: string; full_name: string; role: ProfileRow["role"]; avatar_url: string | null }>;
      };
      students: {
        Row: StudentRow;
        Insert: { profile_id: string; board: Board; class_level: number; subjects: Subject[]; streak_days?: number; readiness_score?: number; total_points?: number; last_active_at?: string | null; account_status?: StudentAccountStatus };
        Update: Partial<{ board: Board; class_level: number; subjects: Subject[]; streak_days: number; readiness_score: number; total_points: number; last_active_at: string | null; account_status: StudentAccountStatus }>;
      };
      parents: {
        Row: ParentRow;
        Insert: { profile_id: string; student_ids?: string[] };
        Update: Partial<{ student_ids: string[] }>;
      };
      boards: {
        Row: { id: string; name: Board; display_name: string };
        Insert: never;
        Update: never;
      };
      classes: {
        Row: { id: string; board_id: string; level: number; display_name: string };
        Insert: never;
        Update: never;
      };
      subjects: {
        Row: { id: string; name: Subject; color_token: string };
        Insert: never;
        Update: never;
      };
      chapters: {
        Row: { id: string; subject_id: string; class_id: string; name: string; order_index: number };
        Insert: never;
        Update: never;
      };
      topics: {
        Row: { id: string; chapter_id: string; name: string; order_index: number };
        Insert: never;
        Update: never;
      };
      knowledge_nodes: {
        Row: KnowledgeNodeRow;
        Insert: { topic_id?: string | null; label: string; description?: string | null; prerequisites?: string[]; class_level: number; board: Board; subject: Subject };
        Update: Partial<{ label: string; description: string | null }>;
      };
      knowledge_edges: {
        Row: KnowledgeEdgeRow;
        Insert: { from_node_id: string; to_node_id: string; weight?: number };
        Update: never;
      };
      resources: {
        Row: ResourceRow;
        Insert: { title: string; url: string; source_name: string; resource_type: ResourceType; subject: Subject; class_level: number; board: Board; chapter_name?: string | null; topic_name?: string | null; ai_summary?: string | null; duration_seconds?: number | null };
        Update: Partial<{ title: string; ai_summary: string | null }>;
      };
      concepts: {
        Row: ConceptRow;
        Insert: { title: string; definition: string; formula?: string | null; examples?: string[]; common_mistakes?: string[]; subject: Subject; class_level: number; board: Board; chapter_name?: string | null; topic_name?: string | null; difficulty?: Difficulty };
        Update: Partial<{ title: string; definition: string; difficulty: Difficulty }>;
      };
      questions: {
        Row: QuestionRow;
        Insert: { question_text: string; question_type?: QuestionType; subject: Subject; class_level: number; board: Board; chapter_name?: string | null; topic_name?: string | null; difficulty: Difficulty; explanation: string; correct_answer_index?: number | null; estimated_time_seconds?: number };
        Update: Partial<{ question_text: string; difficulty: Difficulty }>;
      };
      question_options: {
        Row: QuestionOptionRow;
        Insert: { question_id: string; option_text: string; option_index: number; is_correct: boolean };
        Update: never;
      };
      mock_tests: {
        Row: MockTestRow;
        Insert: { student_id?: string | null; title: string; subject: Subject; class_level: number; board: Board; topic_name?: string | null; difficulty?: Difficulty; question_count?: number; time_limit_minutes?: number; is_adaptive?: boolean };
        Update: Partial<{ title: string }>;
      };
      mock_test_questions: {
        Row: { id: string; mock_test_id: string; question_id: string; order_index: number };
        Insert: { mock_test_id: string; question_id: string; order_index: number };
        Update: never;
      };
      test_attempts: {
        Row: TestAttemptRow;
        Insert: { student_id: string; mock_test_id?: string | null; subject: Subject; topic_name?: string | null; score?: number; accuracy?: number; avg_time_per_question_seconds?: number; total_time_seconds?: number; questions_attempted?: number; questions_correct?: number; readiness_score_after?: number; completed_at?: string | null };
        Update: Partial<{ score: number; accuracy: number; readiness_score_after: number; completed_at: string | null }>;
      };
      attempt_answers: {
        Row: AttemptAnswerRow;
        Insert: { attempt_id: string; question_id: string; selected_option_index?: number | null; is_correct: boolean; time_taken_seconds: number };
        Update: never;
      };
      performance_metrics: {
        Row: PerformanceMetricRow;
        Insert: { student_id: string; subject: Subject; topic_name: string; mastery_score?: number; accuracy_rate?: number; attempts_count?: number; last_attempt_at?: string };
        Update: Partial<{ mastery_score: number; accuracy_rate: number; attempts_count: number; last_attempt_at: string }>;
      };
      study_plans: {
        Row: StudyPlanRow;
        Insert: { student_id: string; plan_date: string; items?: StudyPlanItem[]; total_minutes?: number };
        Update: Partial<{ items: StudyPlanItem[]; total_minutes: number }>;
      };
      achievements: {
        Row: AchievementRow;
        Insert: { student_id: string; badge_key: string; earned_at?: string };
        Update: never;
      };
      ai_conversations: {
        Row: AIConversationRow;
        Insert: { student_id: string; messages?: ConversationMessage[]; subject?: Subject | null; topic_name?: string | null };
        Update: Partial<{ messages: ConversationMessage[]; subject: Subject | null; topic_name: string | null }>;
      };
      topic_pages: {
        Row: TopicPageRow;
        Insert: { slug: string; subject: Subject; class_level: number; chapter_name: string; topic_name: string; summary: string; olympiad_tags?: string[]; order_index?: number };
        Update: Partial<{ summary: string; olympiad_tags: string[]; order_index: number }>;
      };
      blog_posts: {
        Row: BlogPostRow;
        Insert: {
          slug: string; title: string; excerpt: string; content: string;
          cover_image_url?: string | null; cover_image_alt?: string | null;
          category?: BlogCategory; board?: BlogBoard; class_levels?: number[];
          tags?: string[]; author_name?: string;
          seo_title?: string | null; seo_description?: string | null;
          has_affiliate_links?: boolean; status?: BlogStatus; reading_minutes?: number;
          published_at?: string | null; created_by?: string | null;
        };
        Update: Partial<{
          slug: string; title: string; excerpt: string; content: string;
          cover_image_url: string | null; cover_image_alt: string | null;
          category: BlogCategory; board: BlogBoard; class_levels: number[];
          tags: string[]; author_name: string;
          seo_title: string | null; seo_description: string | null;
          has_affiliate_links: boolean; status: BlogStatus; reading_minutes: number;
          published_at: string | null;
        }>;
      };
      admin_settings: {
        Row: AdminSettingsRow;
        Insert: never;
        Update: Partial<{ inactive_days_warning: number; inactive_days_critical: number; low_score_threshold: number; low_ai_engagement_sessions: number; updated_by: string | null }>;
      };
      admin_audit_log: {
        Row: AdminAuditLogRow;
        Insert: { admin_id: string | null; action: string; target_type: string; target_id?: string | null; metadata?: Record<string, unknown> };
        Update: never;
      };
      battles: {
        Row: BattleRow;
        Insert: { mode?: BattleMode; status?: BattleStatus; subject: Subject; class_level: number; board: Board; difficulty: Difficulty; question_count?: number; time_per_question_seconds: number; created_by: string; room_code?: string | null; started_at?: string | null; completed_at?: string | null; cancelled_at?: string | null };
        Update: Partial<{ status: BattleStatus; started_at: string | null; completed_at: string | null; cancelled_at: string | null; winner_participant_id: string | null }>;
      };
      battle_participants: {
        Row: BattleParticipantRow;
        Insert: { battle_id: string; student_id?: string | null; is_ai?: boolean; ai_difficulty_key?: Difficulty | null; score?: number; correct_count?: number; incorrect_count?: number; timeout_count?: number; total_time_seconds?: number; rating_before?: number | null };
        Update: Partial<{ score: number; correct_count: number; incorrect_count: number; timeout_count: number; total_time_seconds: number; rating_after: number | null; rating_delta: number | null; result: BattleOutcome | null; finished_at: string | null }>;
      };
      battle_invitations: {
        Row: BattleInvitationRow;
        Insert: { inviter_student_id: string; invitee_email: string; subject: Subject; difficulty: Difficulty; class_level: number; board: Board; question_count: number; battle_id?: string | null };
        Update: Partial<{ status: BattleInvitationStatus; battle_id: string | null; invitee_student_id: string | null; responded_at: string | null }>;
      };
      battle_questions: {
        Row: BattleQuestionRow;
        Insert: { battle_id: string; question_id?: string | null; order_index: number; question_text: string; options: BattleQuestionOption[]; correct_option_index: number; explanation: string; topic_name?: string | null; difficulty: Difficulty; time_limit_seconds: number };
        Update: never;
      };
      battle_answers: {
        Row: BattleAnswerRow;
        Insert: { battle_id: string; battle_question_id: string; participant_id: string; selected_option_index?: number | null; is_correct: boolean; time_taken_seconds: number; points_awarded: number };
        Update: never;
      };
      student_battle_stats: {
        Row: StudentBattleStatsRow;
        Insert: { student_id: string; rating?: number };
        Update: Partial<{ rating: number; wins: number; losses: number; draws: number; current_streak: number; best_win_streak: number; battles_played: number; last_battle_at: string | null }>;
      };
      battle_config: {
        Row: BattleConfigRow;
        Insert: never;
        Update: never;
      };
    };
    Functions: {
      search_knowledge: {
        Args: { query_embedding: number[]; match_count: number; student_class: number; student_board: Board };
        Returns: Array<{ id: string; title: string; content: string; similarity: number; type: string }>;
      };
      calculate_readiness_score: {
        Args: { p_student_id: string };
        Returns: number;
      };
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
