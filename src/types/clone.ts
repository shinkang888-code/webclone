export interface CloneRequest {
  url: string;
}

export type AssetKind = "image" | "video" | "icon" | "stylesheet" | "font";

export interface DetectedAsset {
  url: string;
  kind: AssetKind;
}

export interface ExtractedSiteData {
  finalUrl: string;
  title: string;
  description: string | null;
  ogImage: string | null;
  html: string;
  assets: DetectedAsset[];
}

export interface SavedAssetInfo {
  sourceUrl: string;
  /** Browser-servable path under /clones/... */
  localPath: string;
  kind: AssetKind;
  bytes: number;
}

export interface SkippedAssetInfo {
  sourceUrl: string;
  reason: "too-large" | "fetch-failed" | "timeout" | "blocked";
}

export interface CloneResult {
  runId: string;
  sourceUrl: string;
  finalUrl: string;
  title: string;
  description: string | null;
  ogImage: string | null;
  htmlBytes: number;
  /** Browser-servable snapshot path, e.g. /clones/<runId>/source.html */
  snapshotPath: string;
  totalDetectedAssets: number;
  downloadedAssets: SavedAssetInfo[];
  skippedAssets: SkippedAssetInfo[];
  durationMs: number;
  createdAt: string;
}

/** One saved run, as listed by the history API. */
export interface CloneRunSummary {
  runId: string;
  sourceUrl: string;
  finalUrl: string;
  title: string;
  snapshotPath: string;
  downloadedAssetCount: number;
  thumbnailPath: string | null;
  createdAt: string;
}

export interface CloneHistoryResponse {
  ok: boolean;
  runs: CloneRunSummary[];
  error?: string;
}

/** NDJSON progress events streamed from POST /api/clone. */
export type ClonePhase = "fetch" | "parse" | "assets" | "save";

export type CloneStreamEvent =
  | { type: "phase"; phase: ClonePhase; label: string }
  | { type: "meta"; title: string; totalAssets: number }
  | {
      type: "asset";
      index: number;
      total: number;
      ok: boolean;
      sourceUrl: string;
      localPath?: string;
      bytes?: number;
    }
  | { type: "done"; result: CloneResult }
  | { type: "error"; message: string };
