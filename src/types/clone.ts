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

/** A semantic region of the cloned page (P0 structure clone). */
export type SectionRole =
  | "header"
  | "nav"
  | "hero"
  | "section"
  | "cta"
  | "footer"
  | "aside";

export interface SectionNode {
  role: SectionRole;
  tag: string;
  /** First heading or leading text, trimmed for a human-readable label. */
  label: string;
  textPreview: string;
  imageCount: number;
  linkCount: number;
}

export interface NavItem {
  label: string;
  href: string | null;
  children: NavItem[];
}

export interface SiteStructure {
  sections: SectionNode[];
  nav: NavItem[];
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
  /** P0: semantic section tree + menu structure. */
  structure: SiteStructure;
  /** Number of external stylesheets inlined into the snapshot. */
  inlinedStylesheets: number;
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
