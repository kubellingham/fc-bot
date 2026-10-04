import type { PostgrestError } from "@supabase/supabase-js";

export class DataLoadError extends Error {
  constructor(public readonly resource: string, public readonly code?: string) {
    super(`Could not load ${resource}.`);
    this.name = "DataLoadError";
  }
}

const PAGE_SIZE = 1000;
/** Hard ceiling per resource to keep a single request bounded. */
const MAX_ROWS = 50_000;

/**
 * Supabase caps responses at 1000 rows by default; page through with `range`
 * so totals are never silently computed from a truncated list.
 */
export async function fetchAll<T>(
  resource: string,
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new DataLoadError(resource, error.code);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
  throw new DataLoadError(`${resource} (more than ${MAX_ROWS} rows)`);
}
