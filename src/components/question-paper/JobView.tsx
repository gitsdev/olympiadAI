"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OAButton, OACard } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { ACTIVE_STATUSES } from "@/lib/question-paper/constants";
import type { PublicJob, PublicQuestion } from "@/lib/question-paper/types";
import { ApiError, qpsApi } from "./api";
import { AnswerSheetView } from "./AnswerSheetView";
import { ProcessingView } from "./ProcessingView";
import { Toasts, useToasts } from "./Toast";

const POLL_MS = 2500;

export function JobView({ id }: { id: string }) {
  const router = useRouter();
  const { toasts, push } = useToasts();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const wasActive = useRef(false);

  const load = useCallback(async (withQuestions: boolean) => {
    try {
      const r = await qpsApi.getJob(id, withQuestions);
      setJob(r.job);
      if (r.questions) setQuestions(r.questions);
      return r.job;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      return null;
    }
  }, [id]);

  // Initial load, then poll while the paper is being processed.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async (first: boolean) => {
      const j = await load(first);
      if (cancelled) return;
      if (!j) {
        timer = setTimeout(() => tick(false), POLL_MS * 2);
        return;
      }
      const active = ACTIVE_STATUSES.includes(j.status);
      if (active) {
        wasActive.current = true;
        timer = setTimeout(() => tick(false), POLL_MS);
      } else if (j.status === "completed" && (wasActive.current || first)) {
        if (!first) {
          await load(true);
          push("success", "Your answer sheet is ready.");
        }
        wasActive.current = false;
      }
    };
    void tick(true);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [load, push]);

  const restartPolling = async () => {
    try {
      await qpsApi.regenerateSheet(id);
      push("success", "Regenerating all answers…");
      wasActive.current = true;
      // Re-run the polling effect by reloading the job state.
      const poll = async () => {
        const j = await load(false);
        if (j && ACTIVE_STATUSES.includes(j.status)) setTimeout(poll, POLL_MS);
        else if (j?.status === "completed") {
          await load(true);
          push("success", "Your answer sheet is ready.");
        }
      };
      await poll();
    } catch (err) {
      push("error", err instanceof ApiError ? err.message : "Couldn't start regeneration.");
    }
  };

  async function remove() {
    setDeleting(true);
    try {
      await qpsApi.deleteJob(id);
      router.push("/question-paper-solver");
    } catch (err) {
      push("error", err instanceof ApiError ? err.message : "Couldn't delete this paper.");
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-[920px] mx-auto px-4 sm:px-7 py-6 pb-14">
      <div className="flex items-center justify-between mb-4 qps-no-print">
        <Link href="/question-paper-solver" className="inline-flex items-center gap-1.5 text-[13px] font-semibold hover:underline" style={{ color: "var(--ink-700)" }}>
          <ArrowLeft size={15} /> All papers
        </Link>
        {job && (
          <OAButton variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</OAButton>
        )}
      </div>

      {notFound ? (
        <OACard className="text-center py-10">
          <p className="font-semibold">This paper doesn&apos;t exist or isn&apos;t yours.</p>
          <Link href="/question-paper-solver" className="inline-block mt-4"><OAButton>Back to Paper Solver</OAButton></Link>
        </OACard>
      ) : !job ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40 w-full rounded-[var(--r-lg)]" />
          <Skeleton className="h-16 w-full rounded-[var(--r-lg)]" />
          <Skeleton className="h-16 w-full rounded-[var(--r-lg)]" />
        </div>
      ) : job.status === "completed" ? (
        questions ? (
          <AnswerSheetView
            job={job}
            questions={questions}
            toast={push}
            onRegenerateAll={restartPolling}
            onQuestionUpdated={(q) => {
              setQuestions((qs) => qs?.map((x) => (x.id === q.id ? q : x)) ?? null);
              void load(false);
            }}
          />
        ) : (
          <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin" style={{ color: "var(--brand)" }} /></div>
        )
      ) : (
        <ProcessingView job={job} />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this paper?</AlertDialogTitle>
            <AlertDialogDescription>
              The uploaded paper, its answer sheet and any downloads will be permanently deleted. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={(e) => { e.preventDefault(); void remove(); }}>
              {deleting ? <Loader2 className="animate-spin" size={16} /> : null} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toasts toasts={toasts} />
    </div>
  );
}
