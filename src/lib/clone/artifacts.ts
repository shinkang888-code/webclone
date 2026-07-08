import { createWriteStream } from "node:fs";
import { access, constants, mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type {
  CloneResult,
  DetectedAsset,
  ExtractedSiteData,
  SavedAssetInfo,
  SkippedAssetInfo,
} from "@/types/clone";

/**
 * Memory-safe artifact pipeline:
 * - assets stream straight to disk (no arrayBuffer buffering)
 * - per-asset size cap enforced mid-stream, oversized files aborted + removed
 * - downloads run in a small parallel pool instead of serially
 * - progress is reported per asset via callback (drives the live UI)
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

export async function assertWritableWorkspace(): Promise<void> {
  try {
    await access(process.cwd(), constants.W_OK);
  } catch {
    throw new Error(
      "이 서버 환경은 파일 저장이 제한되어 있어요(예: Vercel 서버리스). 로컬에서 `npm run dev`로 실행해 주세요.",
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

/** Wrap a web stream and abort once the byte budget is exceeded. */
function limitBytes(
  source: ReadableStream<Uint8Array>,
  maxBytes: number,
): { stream: Readable; overflowed: () => boolean } {
  let total = 0;
  let overflow = false;
  const reader = source.getReader();

  const nodeStream = new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
          return;
        }
        total += value.byteLength;
        if (total > maxBytes) {
          overflow = true;
          await reader.cancel();
          this.destroy(new Error("asset-too-large"));
          return;
        }
        this.push(Buffer.from(value));
      } catch (error) {
        this.destroy(error instanceof Error ? error : new Error("read-failed"));
      }
    },
  });

  return { stream: nodeStream, overflowed: () => overflow };
}

async function downloadAsset(
  asset: DetectedAsset,
  targetDir: string,
  runId: string,
  index: number,
): Promise<SavedAssetInfo | SkippedAssetInfo> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ASSET_TIMEOUT_MS);
  let fullPath: string | null = null;

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
    fullPath = path.join(targetDir, fileName);

    const { stream } = limitBytes(response.body, MAX_ASSET_BYTES);
    await pipeline(stream, createWriteStream(fullPath));

    const { size } = await stat(fullPath);
    return {
      sourceUrl: asset.url,
      localPath: `/clones/${runId}/assets/${fileName}`,
      kind: asset.kind,
      bytes: size,
    };
  } catch (error) {
    if (fullPath) {
      await unlink(fullPath).catch(() => undefined);
    }
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
  targetDir: string,
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
      const result = await downloadAsset(assets[index], targetDir, runId, index);
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

  // Keep original detection order for the result list.
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
  const root = process.cwd();

  const docsRunDir = path.join(root, "docs", "research", "runs", runId);
  const publicRunDir = path.join(root, "public", "clones", runId);
  const publicAssetDir = path.join(publicRunDir, "assets");

  await mkdir(docsRunDir, { recursive: true });
  await mkdir(publicAssetDir, { recursive: true });

  const htmlBuffer = Buffer.from(extracted.html, "utf-8");
  // Snapshot is saved both to docs/ (research archive) and public/ (browser preview).
  await writeFile(path.join(docsRunDir, "source.html"), htmlBuffer);
  await writeFile(path.join(publicRunDir, "source.html"), htmlBuffer);

  const candidates = extracted.assets.slice(0, MAX_ASSETS);
  const { saved, skipped } = await downloadPool(
    candidates,
    publicAssetDir,
    runId,
    onProgress,
  );

  const createdAt = new Date().toISOString();
  const result: CloneResult = {
    runId,
    sourceUrl,
    finalUrl: extracted.finalUrl,
    title: extracted.title,
    description: extracted.description,
    ogImage: extracted.ogImage,
    htmlBytes: htmlBuffer.byteLength,
    snapshotPath: `/clones/${runId}/source.html`,
    totalDetectedAssets: extracted.assets.length,
    downloadedAssets: saved,
    skippedAssets: skipped,
    durationMs: Date.now() - startedAt,
    createdAt,
  };

  await writeFile(
    path.join(docsRunDir, "metadata.json"),
    JSON.stringify(result, null, 2),
    "utf-8",
  );
  await writeFile(
    path.join(publicRunDir, "metadata.json"),
    JSON.stringify(result, null, 2),
    "utf-8",
  );

  return result;
}
