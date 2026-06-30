"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { asStudent, asAttempt } from "@/lib/supabase/types-helper";
import type { Subject } from "@/types/database";

interface SubmitAttemptInput {
  mockTestId?: string;
  subject: Subject;
  topicName?: string;
  answers: {
    questionId: string;
    selectedOptionIndex: number | null;
    isCorrect: boolean;
    timeTakenSeconds: number;
  }[];
  totalTimeSeconds: number;
}

export async function submitTestAttempt(input: SubmitAttemptInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: rawStudent } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  const student = asStudent(rawStudent);
  if (!student) return { error: "Student profile not found" };

  const correct  = input.answers.filter((a) => a.isCorrect).length;
  const total    = input.answers.length;
  const accuracy = total > 0 ? (correct / total) * 100 : 0;
  const avgTime  = total > 0 ? Math.round(input.totalTimeSeconds / total) : 0;

  const { data: rawAttempt, error: attemptErr } = await supabase
    .from("test_attempts")
    .insert({
      student_id:                     student.id,
      mock_test_id:                   input.mockTestId ?? null,
      subject:                        input.subject,
      topic_name:                     input.topicName ?? null,
      score:                          accuracy,
      accuracy,
      avg_time_per_question_seconds:  avgTime,
      total_time_seconds:             input.totalTimeSeconds,
      questions_attempted:            total,
      questions_correct:              correct,
      readiness_score_after:          0,
      completed_at:                   new Date().toISOString(),
    })
    .select("id")
    .single();

  const attempt = asAttempt(rawAttempt);
  if (attemptErr || !attempt) return { error: (attemptErr as any)?.message };

  if (input.answers.length > 0) {
    await supabase.from("attempt_answers").insert(
      input.answers.map((a) => ({
        attempt_id:            attempt.id,
        question_id:           a.questionId,
        selected_option_index: a.selectedOptionIndex,
        is_correct:            a.isCorrect,
        time_taken_seconds:    a.timeTakenSeconds,
      }))
    );
  }

  if (input.topicName) {
    await supabase.from("performance_metrics").upsert(
      {
        student_id:      student.id,
        subject:         input.subject,
        topic_name:      input.topicName,
        mastery_score:   accuracy,
        accuracy_rate:   accuracy,
        attempts_count:  1,
        last_attempt_at: new Date().toISOString(),
      },
      { onConflict: "student_id,subject,topic_name" }
    );
  }

  const { data: newScore } = await supabase
    .rpc("calculate_readiness_score", { p_student_id: student.id });

  if (newScore !== null) {
    await supabase
      .from("students")
      .update({ readiness_score: newScore })
      .eq("id", student.id);

    await supabase
      .from("test_attempts")
      .update({ readiness_score_after: newScore })
      .eq("id", attempt.id);
  }

  revalidatePath("/results");
  revalidatePath("/dashboard");

  return { attemptId: attempt.id, accuracy, readinessScore: newScore ?? 0 };
}
