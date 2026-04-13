export interface CloneRequest {
  url: string;
}

export interface ExtractedSiteData {
  finalUrl: string;
  title: string;
  description: string | null;
  ogImage: string | null;
  html: string;
  assetUrls: string[];
}

export interface SavedAssetInfo {
  sourceUrl: string;
  localPath: string;
}

export interface CloneResult {
  runId: string;
  sourceUrl: string;
  finalUrl: string;
  title: string;
  description: string | null;
  ogImage: string | null;
  htmlSnapshotPath: string;
  metadataPath: string;
  downloadedAssets: SavedAssetInfo[];
}

export interface CloneResponse {
  ok: boolean;
  result?: CloneResult;
  error?: string;
}
