"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function InactivityThresholdSelect({ defaultDays }: { defaultDays: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get("inactiveDays") ?? String(defaultDays);

  function setValue(v: string | null) {
    if (!v) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("inactiveDays", v);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger aria-label="Inactivity threshold" className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="7">Inactive 7+ days</SelectItem>
        <SelectItem value="14">Inactive 14+ days</SelectItem>
        <SelectItem value="30">Inactive 30+ days</SelectItem>
      </SelectContent>
    </Select>
  );
}
