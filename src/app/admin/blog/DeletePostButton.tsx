"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePost } from "@/actions/blog";

export function DeletePostButton({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await deletePost(id);
              if (!res.ok) alert(res.error ?? "Delete failed");
              setConfirming(false);
              router.refresh();
            })
          }
          className="hover:underline disabled:opacity-50"
          style={{ color: "var(--danger-tx)" }}
        >
          {pending ? "Deleting…" : "Confirm"}
        </button>
        <button onClick={() => setConfirming(false)} className="hover:underline" style={{ color: "var(--fg-muted)" }}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="hover:underline"
      style={{ color: "var(--fg-muted)" }}
      aria-label={`Delete ${title}`}
    >
      Delete
    </button>
  );
}
