"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal, Eye, Ban, CheckCircle2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./ConfirmDialog";
import { setStudentAccountStatus } from "@/actions/admin/students";
import type { StudentAccountStatus } from "@/types/database";

export function StudentRowActions({ studentId, status }: { studentId: string; status: StudentAccountStatus }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const nextStatus: StudentAccountStatus = status === "suspended" ? "active" : "suspended";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="ghost" size="icon-sm" aria-label="Row actions">
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/admin/students/${studentId}`} />}>
            <Eye size={14} /> View profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setConfirmOpen(true)} variant={nextStatus === "suspended" ? "destructive" : undefined}>
            {nextStatus === "suspended" ? <Ban size={14} /> : <CheckCircle2 size={14} />}
            {nextStatus === "suspended" ? "Suspend student" : "Activate student"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={nextStatus === "suspended" ? "Suspend this student?" : "Activate this student?"}
        description={
          nextStatus === "suspended"
            ? "The student will be unable to sign in until reactivated. This does not delete any of their data."
            : "The student will regain access to their account immediately."
        }
        confirmLabel={nextStatus === "suspended" ? "Suspend" : "Activate"}
        destructive={nextStatus === "suspended"}
        onConfirm={async () => {
          await setStudentAccountStatus(studentId, nextStatus);
          startTransition(() => router.refresh());
        }}
      />
    </>
  );
}
