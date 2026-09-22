"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CLASS_LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);
const SUBJECTS = ["Mathematics", "Science", "English", "General Knowledge", "Cyber"];

export function BattleFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(name: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(name, value);
    else params.delete(name);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={searchParams.get("status") ?? "all"} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger aria-label="Filter by status" className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      <Select value={searchParams.get("result") ?? "all"} onValueChange={(v) => setParam("result", v)}>
        <SelectTrigger aria-label="Filter by result" className="h-9"><SelectValue placeholder="Result" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All results</SelectItem>
          <SelectItem value="win">Win</SelectItem>
          <SelectItem value="loss">Loss</SelectItem>
          <SelectItem value="draw">Draw</SelectItem>
        </SelectContent>
      </Select>

      <Select value={searchParams.get("class") ?? "all"} onValueChange={(v) => setParam("class", v)}>
        <SelectTrigger aria-label="Filter by class" className="h-9"><SelectValue placeholder="Class" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All classes</SelectItem>
          {CLASS_LEVELS.map((c) => <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("subject") ?? "all"} onValueChange={(v) => setParam("subject", v)}>
        <SelectTrigger aria-label="Filter by subject" className="h-9"><SelectValue placeholder="Subject" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All subjects</SelectItem>
          {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("sort") ?? "date_desc"} onValueChange={(v) => setParam("sort", v)}>
        <SelectTrigger aria-label="Sort by" className="h-9"><SelectValue placeholder="Sort" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="date_desc">Newest first</SelectItem>
          <SelectItem value="score_desc">Highest score</SelectItem>
          <SelectItem value="student_asc">Student (A–Z)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
