/** v2 project document model — phases A→D */

export type ProjectStatus =
  | "capturing"
  | "captured"
  | "rebranding"
  | "rebranded"
  | "editing"
  | "ready"
  | "published"
  | "failed";

export type SectionRole =
  | "header"
  | "nav"
  | "hero"
  | "section"
  | "cta"
  | "footer"
  | "main"
  | "unknown";

export interface ImageSlot {
  key: string;
  src: string;
  alt: string | null;
  role: "logo" | "hero" | "background" | "content" | "icon" | "unknown";
  aspectRatio: string | null;
}

export interface SectionNode {
  id: string;
  role: SectionRole;
  tag: string;
  label: string;
  textPreview: string;
  imageSlots: ImageSlot[];
  childCount: number;
  htmlSnippet: string;
}

export interface StructureTree {
  sections: SectionNode[];
  totalBlocks: number;
}

export interface NavItem {
  label: string;
  href: string | null;
  children: NavItem[];
}

export interface NavMap {
  items: NavItem[];
  source: "nav" | "header" | "role-navigation" | "heuristic";
}

export interface BrandConcept {
  keywords: string;
  tone: string;
  primaryColor?: string;
}

export interface BrandDetection {
  candidate: string;
  confidence: number;
  signals: { source: string; value: string; weight: number }[];
}

export interface ProjectAsset {
  id: string;
  projectId: string;
  slotKey: string;
  role: string;
  blobUrl: string;
  originalSrc: string | null;
  isGenerated: boolean;
  aspectRatio: string | null;
  prompt: string | null;
  createdAt: string;
}

export interface EditDocument {
  id: string;
  projectId: string;
  version: number;
  renderedHtmlBlob: string;
  updatedAt: string;
}

export interface PublishedSite {
  id: string;
  projectId: string;
  editVersion: number;
  target: "blob" | "vercel";
  url: string;
  slug: string;
  publishedAt: string;
}

export interface ProjectDetail {
  id: string;
  sourceUrl: string;
  status: ProjectStatus;
  brandOriginal: string | null;
  brandNew: string | null;
  concept: BrandConcept | null;
  capture: CaptureResult | null;
  rebrandedHtmlUrl: string | null;
  assets: ProjectAsset[];
  latestEdit: EditDocument | null;
  latestPublish: PublishedSite | null;
  publishHistory: PublishedSite[];
  imagesReplaced: boolean;
  createdAt: string;
}

export interface CaptureRequest {
  url: string;
  createProject?: boolean;
}

export type CapturePhase =
  | "render"
  | "sanitize"
  | "css"
  | "structure"
  | "assets"
  | "save";

export interface CaptureResult {
  projectId: string;
  captureId: string;
  sourceUrl: string;
  finalUrl: string;
  title: string;
  htmlBlobUrl: string;
  cssBlobUrl: string | null;
  structure: StructureTree;
  navmap: NavMap;
  assetCount: number;
  durationMs: number;
  renderMode: "playwright" | "fetch-fallback";
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  sourceUrl: string;
  title: string;
  status: ProjectStatus;
  thumbnailUrl: string | null;
  sectionCount: number;
  createdAt: string;
}

export interface RebrandRequest {
  brandOriginal: string;
  brandNew: string;
  concept?: BrandConcept;
  paletteRemap?: Record<string, string>;
}

export interface ImageActionRequest {
  slotKey: string;
  action: "generate" | "keep" | "upload";
  uploadUrl?: string;
  customPrompt?: string;
}

export interface PublishRequest {
  slug?: string;
  target?: "blob" | "vercel";
}

export type CaptureStreamEvent =
  | { type: "phase"; phase: CapturePhase; label: string }
  | { type: "meta"; title: string; sectionCount: number; renderMode: string }
  | {
      type: "asset";
      index: number;
      total: number;
      ok: boolean;
      sourceUrl: string;
      blobUrl?: string;
    }
  | { type: "done"; result: CaptureResult }
  | { type: "error"; message: string };

export type ProjectPhase = "capture" | "rebrand" | "images" | "edit" | "publish";

export const PHASE_ORDER: ProjectPhase[] = [
  "capture",
  "rebrand",
  "images",
  "edit",
  "publish",
];

export const PHASE_LABELS: Record<ProjectPhase, string> = {
  capture: "구조 클론",
  rebrand: "리브랜딩",
  images: "이미지 교체",
  edit: "위지윅 편집",
  publish: "발행",
};
