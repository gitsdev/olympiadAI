// Browser-side calls for the Question Paper Solver.

import type { PublicJob, PublicQuestion } from "@/lib/question-paper/types";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  } catch {
    throw new ApiError("You seem to be offline. Check your connection and try again.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new ApiError(data.error || "Something went wrong. Please try again.", res.status);
  return data;
}

export interface CreateJobInput {
  fileName: string;
  fileSize: number;
  classLevel: number | null;
  board: string | null;
  subject: string | null;
  examType: string | null;
  detailLevel: string;
  autoDetect: boolean;
}

export const qpsApi = {
  listJobs: () => call<{ jobs: PublicJob[] }>("/api/question-paper/jobs"),
  createJob: (input: CreateJobInput) => call<{ jobId: string; uploadUrl: string }>("/api/question-paper/jobs", { method: "POST", body: JSON.stringify(input) }),
  startJob: (id: string) => call<{ ok: true; status: string }>(`/api/question-paper/jobs/${id}/start`, { method: "POST" }),
  getJob: (id: string, withQuestions = false) =>
    call<{ job: PublicJob; questions?: PublicQuestion[] }>(`/api/question-paper/jobs/${id}${withQuestions ? "?questions=1" : ""}`, { cache: "no-store" }),
  deleteJob: (id: string) => call<{ ok: true }>(`/api/question-paper/jobs/${id}`, { method: "DELETE" }),
  regenerateSheet: (id: string) => call<{ ok: true }>(`/api/question-paper/jobs/${id}/regenerate`, { method: "POST" }),
  exportSheet: (id: string, format: "pdf" | "docx") => call<{ url: string }>(`/api/question-paper/jobs/${id}/export?format=${format}`, { method: "POST" }),
  updateQuestion: (id: string, patch: Record<string, unknown>) =>
    call<{ question: PublicQuestion }>(`/api/question-paper/questions/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  regenerateQuestion: (id: string, instruction?: string) =>
    call<{ question: PublicQuestion }>(`/api/question-paper/questions/${id}/regenerate`, { method: "POST", body: JSON.stringify(instruction ? { instruction } : {}) }),
};

/**
 * Uploads straight to the private bucket with a one-off signed URL, using
 * XHR so we can report progress (fetch can't report upload progress).
 */
export function uploadWithProgress(signedUrl: string, file: File, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "true");
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anon) xhr.setRequestHeader("apikey", anon);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else if (xhr.status === 413) reject(new ApiError("The file is too large to upload.", 413));
      else if (xhr.status === 415 || xhr.status === 400) reject(new ApiError("This file type isn't accepted. Upload a PDF or Word (.docx) file.", xhr.status));
      else reject(new ApiError("The upload failed. Please try again.", xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("The upload was interrupted. Check your connection and try again.", 0));
    xhr.onabort = () => reject(new ApiError("Upload cancelled.", 0));
    signal?.addEventListener("abort", () => xhr.abort());

    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    xhr.send(form);
  });
}
