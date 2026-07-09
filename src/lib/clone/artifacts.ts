import path from "node:path";
import { uploadAssetFromResponse, uploadHtmlSnapshot } from "@/lib/clone/blob";
import { insertCloneRun } from "@/lib/clone/db";
import { rewriteSnapshot } from "@/lib/clone/rewrite";
import { extractStructure } from "@/lib/clone/structure";
import type {
  CloneResult,
  DetectedAsset,
  ExtractedSiteData,
  SavedAssetInfo,
  SkippedAssetInfo,
} from "@/types/clone";

/**
 * Memory-safe artifact pipeline, now backed by Vercel Blob (files)
 * and Neon Postgres (run metadata) instead of local disk — required
 * for persistence on Vercel's serverless, read-only filesystem.
 */

export const MAX_ASSETS = 40;
const MAX_ASSET_BYTES = 15 * 1024 * 1024; // 15MB per asset
const ASSET_TIMEOUT_MS = 15_000;
const CONCURRENCY = 4;

export type AssetProgress = (info: {
  index: number;
  total: number;
  ok: boolean;
  sourceUrl: string;
  localPath?: string;
  bytes?: number;
}) => void;

export function makeRunId(url: string): string {
  const hostname = new URL(url).hostname.replaceAll(".", "-");
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  return `${hostname}-${timestamp}`;
}

/** Checked before every scan so failures are a friendly message, not a 500. */
export function assertStorageConfigured(): void {
  const missing: string[] = [];
  // Vercel Blob now authenticates via OIDC (BLOB_STORE_ID + auto-injected
  // VERCEL_OIDC_TOKEN) when connected through the dashboard; the older
  // static BLOB_READ_WRITE_TOKEN still works too, so accept either.
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) {
    missing.push("Blob");
  }
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    missing.push("Postgres(Neon)");
  }
  if (missing.length > 0) {
    throw new Error(
      `저장소가 아직 연결되지 않았어요 (${missing.join(", ")} 미연결). Vercel 프로젝트의 Storage 탭에서 추가해 주세요.`,
    );
  }
}

function safeFilename(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "asset";
}

function extFromContentType(contentType: string | null): string {
  if (!contentType) return ".bin";
  if (contentType.includes("image/jpeg")) return ".jpg";
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/webp")) return ".webp";
  if (contentType.includes("image/avif")) return ".avif";
  if (contentType.includes("image/gif")) return ".gif";
  if (contentType.includes("image/svg+xml")) return ".svg";
  if (contentType.includes("video/mp4")) return ".mp4";
  if (contentType.includes("video/webm")) return ".webm";
  if (contentType.includes("image/x-icon")) return ".ico";
  return ".bin";
}

async function downloadAsset(
  asset: DetectedAsset,
  runId: string,
  index: number,
): Promise<SavedAssetInfo | SkippedAssetInfo> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ASSET_TIMEOUT_MS);

  try {
    const response = await fetch(asset.url, {
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok || !response.body) {
      return { sourceUrl: asset.url, reason: "fetch-failed" };
    }

    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_ASSET_BYTES) {
      await response.body.cancel();
      return { sourceUrl: asset.url, reason: "too-large" };
    }

    const urlObj = new URL(asset.url);
    const baseName = safeFilename(
      path.parse(urlObj.pathname).name || `asset-${index + 1}`,
    );
    const ext =
      path.extname(urlObj.pathname).slice(0, 8) ||
      extFromContentType(response.headers.get("content-type"));
    const fileName = `${String(index + 1).padStart(2, "0")}-${baseName}${ext}`;

    const uploaded = await uploadAssetFromResponse(
      runId,
      fileName,
      response,
      MAX_ASSET_BYTES,
    );

    return {
      sourceUrl: asset.url,
      localPath: uploaded.url,
      kind: asset.kind,
      bytes: uploaded.bytes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "asset-too-large") {
      return { sourceUrl: asset.url, reason: "too-large" };
    }
    if (controller.signal.aborted) {
      return { sourceUrl: asset.url, reason: "timeout" };
    }
    return { sourceUrl: asset.url, reason: "fetch-failed" };
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadPool(
  assets: DetectedAsset[],
  runId: string,
  onProgress: AssetProgress,
): Promise<{ saved: SavedAssetInfo[]; skipped: SkippedAssetInfo[] }> {
  const saved: SavedAssetInfo[] = [];
  const skipped: SkippedAssetInfo[] = [];
  let cursor = 0;
  let completed = 0;

  const worker = async () => {
    while (cursor < assets.length) {
      const index = cursor;
      cursor += 1;
      const result = await downloadAsset(assets[index], runId, index);
      completed += 1;
      if ("localPath" in result) {
        saved.push(result);
        onProgress({
          index: completed,
          total: assets.length,
          ok: true,
          sourceUrl: result.sourceUrl,
          localPath: result.localPath,
          bytes: result.bytes,
        });
      } else {
        skipped.push(result);
        onProgress({
          index: completed,
          total: assets.length,
          ok: false,
          sourceUrl: result.sourceUrl,
        });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, assets.length) }, worker),
  );

  saved.sort((a, b) => a.localPath.localeCompare(b.localPath));
  return { saved, skipped };
}

export async function saveCloneArtifacts(
  sourceUrl: string,
  extracted: ExtractedSiteData,
  onProgress: AssetProgress,
  startedAt: number,
): Promise<CloneResult> {
  const runId = makeRunId(sourceUrl);

  // 1. Download assets first so we can rewrite the snapshot to point at
  //    the Blob copies (self-contained clone, not origin-dependent).
  const candidates = extracted.assets.slice(0, MAX_ASSETS);
  const { saved, skipped } = await downloadPool(candidates, runId, onProgress);

  // 2. Build the original-URL -> Blob-URL map from the downloaded assets.
  const assetMap = new Map<string, string>();
  for (const asset of saved) assetMap.set(asset.sourceUrl, asset.localPath);

  // 3. Rewrite asset refs + inline external CSS + strip scripts.
  const { html: rewrittenHtml, inlinedStylesheets } = await rewriteSnapshot(
    extracted.html,
    extracted.finalUrl,
    assetMap,
  );

  // 4. Extract the semantic section tree + menu structure (P0 core value).
  const structure = extractStructure(rewrittenHtml);

  // 5. Upload the self-contained snapshot.
  const snapshot = await uploadHtmlSnapshot(runId, rewrittenHtml);

  const createdAt = new Date().toISOString();
  const result: CloneResult = {
    runId,
    sourceUrl,
    finalUrl: extracted.finalUrl,
    title: extracted.title,
    description: extracted.description,
    ogImage: extracted.ogImage,
    htmlBytes: snapshot.bytes,
    snapshotPath: snapshot.url,
    totalDetectedAssets: extracted.assets.length,
    downloadedAssets: saved,
    skippedAssets: skipped,
    structure,
    inlinedStylesheets,
    durationMs: Date.now() - startedAt,
    createdAt,
  };

  await insertCloneRun(result);

  return result;
}
