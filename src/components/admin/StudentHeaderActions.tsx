"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./ConfirmDialog";
import { EditStudentDialog } from "./EditStudentDialog";
import { setStudentAccountStatus, adminSendPasswordReset } from "@/actions/admin/students";
import type { StudentAccountStatus, StudentRow } from "@/types/database";

export function StudentHeaderActions({
  studentId, student, fullName, status, email,
}: {
  studentId: string; student: StudentRow; fullName: string; status: StudentAccountStatus; email: string;
}) {
  const router = useRouter();
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const nextStatus: StudentAccountStatus = status === "suspended" ? "active" : "suspended";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <EditStudentDialog studentId={studentId} student={student} fullName={fullName} />

      <Button variant="outline" size="sm" onClick={() => setResetConfirmOpen(true)}>
        <KeyRound size={14} /> {resetSent ? "Reset email sent" : "Reset Password"}
      </Button>

      <Button
        variant={nextStatus === "suspended" ? "destructive" : "outline"}
        size="sm"
        onClick={() => setStatusConfirmOpen(true)}
      >
        {nextStatus === "suspended" ? <Ban size={14} /> : <CheckCircle2 size={14} />}
        {nextStatus === "suspended" ? "Suspend" : "Activate"}
      </Button>

      <ConfirmDialog
        open={statusConfirmOpen}
        onOpenChange={setStatusConfirmOpen}
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
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title="Send password reset email?"
        description={`A password reset link will be emailed to ${email}. The admin never sees or sets the student's password directly.`}
        confirmLabel="Send email"
        onConfirm={async () => {
          await adminSendPasswordReset(studentId);
          setResetSent(true);
        }}
      />
    </div>
  );
}
