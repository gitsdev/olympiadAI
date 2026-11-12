"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function QpsStatusFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setStatus(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set("status", value);
    else params.delete("status");
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={searchParams.get("status") ?? "all"} onValueChange={setStatus}>
      <SelectTrigger aria-label="Filter by status" className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
        <SelectItem value="processing">Processing</SelectItem>
        <SelectItem value="failed">Failed / rejected</SelectItem>
        <SelectItem value="abandoned">Abandoned uploads</SelectItem>
      </SelectContent>
    </Select>
  );
}
