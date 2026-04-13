import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CloneResult, SavedAssetInfo } from "@/types/clone";
import type { ExtractedSiteData } from "@/types/clone";

const MAX_ASSETS = 12;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;

function makeRunId(url: string): string {
  const hostname = new URL(url).hostname.replaceAll(".", "-");
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  return `${hostname}-${timestamp}`;
}

function safeFilename(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
}

function extFromContentType(contentType: string | null): string {
  if (!contentType) return ".bin";
  if (contentType.includes("image/jpeg")) return ".jpg";
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/webp")) return ".webp";
  if (contentType.includes("image/gif")) return ".gif";
  if (contentType.includes("image/svg+xml")) return ".svg";
  if (contentType.includes("video/mp4")) return ".mp4";
  if (contentType.includes("video/webm")) return ".webm";
  if (contentType.includes("image/x-icon")) return ".ico";
  return ".bin";
}

async function downloadAsset(
  sourceUrl: string,
  targetDir: string,
  index: number,
): Promise<SavedAssetInfo | null> {
  try {
    const response = await fetch(sourceUrl, { redirect: "follow" });
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type");
    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_ASSET_BYTES) {
      return null;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_ASSET_BYTES) {
      return null;
    }

    const urlObj = new URL(sourceUrl);
    const baseName = safeFilename(
      path.parse(urlObj.pathname).name || `asset-${index + 1}`,
    );
    const ext =
      path.extname(urlObj.pathname) || extFromContentType(contentType);
    const fileName = `${String(index + 1).padStart(2, "0")}-${baseName}${ext}`;
    const fullPath = path.join(targetDir, fileName);

    await writeFile(fullPath, bytes);
    return {
      sourceUrl,
      localPath: `/clones/${path.basename(path.dirname(targetDir))}/assets/${fileName}`,
    };
  } catch {
    return null;
  }
}

export async function saveCloneArtifacts(
  sourceUrl: string,
  extracted: ExtractedSiteData,
): Promise<CloneResult> {
  const runId = makeRunId(sourceUrl);
  const root = process.cwd();

  const docsRunDir = path.join(root, "docs", "research", "runs", runId);
  const publicRunDir = path.join(root, "public", "clones", runId);
  const publicAssetDir = path.join(publicRunDir, "assets");

  await mkdir(docsRunDir, { recursive: true });
  await mkdir(publicAssetDir, { recursive: true });

  const htmlSnapshotPath = path.join(docsRunDir, "source.html");
  const metadataPath = path.join(docsRunDir, "metadata.json");

  await writeFile(htmlSnapshotPath, extracted.html, "utf-8");

  const downloadedAssets: SavedAssetInfo[] = [];
  const candidates = extracted.assetUrls.slice(0, MAX_ASSETS);

  for (let i = 0; i < candidates.length; i += 1) {
    const asset = await downloadAsset(candidates[i], publicAssetDir, i);
    if (asset) {
      downloadedAssets.push(asset);
    }
  }

  const metadata = {
    runId,
    sourceUrl,
    finalUrl: extracted.finalUrl,
    title: extracted.title,
    description: extracted.description,
    ogImage: extracted.ogImage,
    totalDetectedAssets: extracted.assetUrls.length,
    downloadedAssets,
    createdAt: new Date().toISOString(),
  };

  await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");

  return {
    runId,
    sourceUrl,
    finalUrl: extracted.finalUrl,
    title: extracted.title,
    description: extracted.description,
    ogImage: extracted.ogImage,
    htmlSnapshotPath,
    metadataPath,
    downloadedAssets,
  };
}
