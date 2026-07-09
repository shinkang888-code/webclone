import { listCloneRunSummaries } from "@/lib/clone/db";
import type { CloneRunSummary } from "@/types/clone";

/**
 * Thin wrapper so the API route doesn't need to know the storage
 * backend. Returns an empty list rather than throwing when Postgres
 * isn't configured yet, so the dashboard still renders.
 */
export async function listCloneRuns(): Promise<CloneRunSummary[]> {
  try {
    return await listCloneRunSummaries();
  } catch {
    return [];
  }
}
