export const ADMIN_PAGE_SIZE = 20;

export function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** Range for Supabase's `.range(from, to)` (inclusive, 0-indexed). */
export function pageRange(page: number, pageSize = ADMIN_PAGE_SIZE): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}

export function totalPages(count: number, pageSize = ADMIN_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(count / pageSize));
}

/** Parses the Students page's "tests" filter preset into a [min, max] range for the RPC. */
export function parseTestCountFilter(value: string | undefined): { min?: number; max?: number } {
  if (!value || value === "all") return {};
  if (value === "0") return { min: 0, max: 0 };
  if (value === "11-") return { min: 11 };
  const [min, max] = value.split("-").map(Number);
  return { min, max };
}
