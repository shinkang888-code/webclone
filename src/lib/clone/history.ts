import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { CloneResult, CloneRunSummary } from "@/types/clone";

const MAX_HISTORY = 30;

export async function listCloneRuns(): Promise<CloneRunSummary[]> {
  const runsDir = path.join(process.cwd(), "docs", "research", "runs");

  let entries: string[];
  try {
    entries = await readdir(runsDir);
  } catch {
    return [];
  }

  const summaries: CloneRunSummary[] = [];

  for (const entry of entries) {
    try {
      const raw = await readFile(
        path.join(runsDir, entry, "metadata.json"),
        "utf-8",
      );
      const meta = JSON.parse(raw) as Partial<CloneResult> & {
        downloadedAssets?: { localPath: string; kind?: string }[];
      };
      if (!meta.runId || !meta.sourceUrl || !meta.createdAt) continue;

      const firstImage = meta.downloadedAssets?.find(
        (asset) =>
          asset.kind === "image" ||
          /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(asset.localPath),
      );

      summaries.push({
        runId: meta.runId,
        sourceUrl: meta.sourceUrl,
        finalUrl: meta.finalUrl ?? meta.sourceUrl,
        title: meta.title ?? "Untitled",
        snapshotPath: meta.snapshotPath ?? `/clones/${meta.runId}/source.html`,
        downloadedAssetCount: meta.downloadedAssets?.length ?? 0,
        thumbnailPath: firstImage?.localPath ?? null,
        createdAt: meta.createdAt,
      });
    } catch {
      // Skip malformed runs (e.g. legacy format) instead of failing the list.
    }
  }

  summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return summaries.slice(0, MAX_HISTORY);
}
