"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CLASS_LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);

export function StudentFilters() {
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
      <Select value={searchParams.get("class") ?? "all"} onValueChange={(v) => setParam("class", v)}>
        <SelectTrigger aria-label="Filter by class" className="h-9"><SelectValue placeholder="Class" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All classes</SelectItem>
          {CLASS_LEVELS.map((c) => <SelectItem key={c} value={String(c)}>Class {c}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("status") ?? "all"} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger aria-label="Filter by status" className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="suspended">Suspended</SelectItem>
        </SelectContent>
      </Select>

      <Select value={searchParams.get("activity") ?? "all"} onValueChange={(v) => setParam("activity", v)}>
        <SelectTrigger aria-label="Filter by activity" className="h-9"><SelectValue placeholder="Activity" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any activity</SelectItem>
          <SelectItem value="today">Active today</SelectItem>
          <SelectItem value="week">Active this week</SelectItem>
          <SelectItem value="inactive_7">Inactive 7+ days</SelectItem>
          <SelectItem value="inactive_30">Inactive 30+ days</SelectItem>
        </SelectContent>
      </Select>

      <Select value={searchParams.get("tests") ?? "all"} onValueChange={(v) => setParam("tests", v)}>
        <SelectTrigger aria-label="Filter by mock test activity" className="h-9"><SelectValue placeholder="Mock tests" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any mock-test activity</SelectItem>
          <SelectItem value="0">No tests</SelectItem>
          <SelectItem value="1-5">1–5 tests</SelectItem>
          <SelectItem value="6-10">6–10 tests</SelectItem>
          <SelectItem value="11-">10+ tests</SelectItem>
        </SelectContent>
      </Select>

      <Select value={searchParams.get("sort") ?? "created_at_desc"} onValueChange={(v) => setParam("sort", v)}>
        <SelectTrigger aria-label="Sort by" className="h-9"><SelectValue placeholder="Sort" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="created_at_desc">Newest first</SelectItem>
          <SelectItem value="name_asc">Name (A–Z)</SelectItem>
          <SelectItem value="last_active_desc">Last active</SelectItem>
          <SelectItem value="score_desc">Highest score</SelectItem>
          <SelectItem value="tests_desc">Most tests taken</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
