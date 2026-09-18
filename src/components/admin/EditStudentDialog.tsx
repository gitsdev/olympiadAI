"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateStudentDetails } from "@/actions/admin/students";
import type { Board, Subject, StudentRow } from "@/types/database";

const SUBJECTS: Subject[] = ["Mathematics", "Science", "English", "General Knowledge", "Cyber"];
const CLASS_LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);

export function EditStudentDialog({ studentId, student, fullName }: {
  studentId: string; student: StudentRow; fullName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(fullName);
  const [board, setBoard] = useState<Board>(student.board);
  const [classLevel, setClassLevel] = useState(student.class_level);
  const [subjects, setSubjects] = useState<Subject[]>(student.subjects ?? []);

  function toggleSubject(s: Subject) {
    setSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function handleSave() {
    setPending(true);
    setError(null);
    const res = await updateStudentDetails(studentId, { fullName: name, board, classLevel, subjects });
    setPending(false);
    if (res.error) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil size={14} /> Edit Student
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit student</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Full name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-board">Board</Label>
              <Select value={board} onValueChange={(v) => setBoard(v as Board)}>
                <SelectTrigger id="edit-board"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CBSE">CBSE</SelectItem>
                  <SelectItem value="ICSE">ICSE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-class">Class</Label>
              <Select value={String(classLevel)} onValueChange={(v) => setClassLevel(Number(v))}>
                <SelectTrigger id="edit-class"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLASS_LEVELS.map((c) => <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Subjects</Label>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSubject(s)}
                  className="px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors"
                  style={
                    subjects.includes(s)
                      ? { background: "var(--cobalt-50)", color: "var(--cobalt-700)", borderColor: "var(--cobalt-200)" }
                      : { background: "transparent", color: "var(--ink-700)", borderColor: "var(--line-300)" }
                  }
                  aria-pressed={subjects.includes(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-[12.5px]" style={{ color: "var(--danger-tx)" }}>{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={handleSave} disabled={pending || !name.trim()}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
