import type {
  AssetKind,
  DetectedAsset,
  ExtractedSiteData,
} from "@/types/clone";

/**
 * Regex-based extraction, deliberately dependency-free.
 * Compared to the original version this also collects:
 * - <img srcset> / <source srcset> candidates
 * - lazy-load attributes (data-src, data-lazy-src, data-original, data-bg)
 * - <video poster>
 * - <link rel="preload" as="image">
 * - inline style url(...) backgrounds
 */

const TITLE_REGEX = /<title[^>]*>([\s\S]*?)<\/title>/i;
const DESCRIPTION_REGEX =
  /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i;
const DESCRIPTION_REGEX_REVERSED =
  /<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i;
const OG_IMAGE_REGEX =
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i;
const OG_IMAGE_REGEX_REVERSED =
  /<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:image["'][^>]*>/i;

const SIMPLE_SOURCES: { regex: RegExp; kind: AssetKind }[] = [
  { regex: /<img[^>]+src=["']([^"']+)["']/gi, kind: "image" },
  { regex: /<img[^>]+data-src=["']([^"']+)["']/gi, kind: "image" },
  { regex: /<img[^>]+data-lazy-src=["']([^"']+)["']/gi, kind: "image" },
  { regex: /<img[^>]+data-original=["']([^"']+)["']/gi, kind: "image" },
  { regex: /<[^>]+data-bg=["']([^"']+)["']/gi, kind: "image" },
  { regex: /<source[^>]+src=["']([^"']+)["']/gi, kind: "video" },
  { regex: /<video[^>]+src=["']([^"']+)["']/gi, kind: "video" },
  { regex: /<video[^>]+poster=["']([^"']+)["']/gi, kind: "image" },
  {
    regex: /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/gi,
    kind: "icon",
  },
  {
    regex: /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/gi,
    kind: "icon",
  },
  {
    regex:
      /<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]+href=["']([^"']+)["']/gi,
    kind: "image",
  },
];

const SRCSET_REGEX = /(?:srcset|data-srcset)=["']([^"']+)["']/gi;
const INLINE_BG_REGEX = /url\((['"]?)([^'")]+)\1\)/gi;

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function firstMatch(regexes: RegExp[], source: string): string | null {
  for (const regex of regexes) {
    const match = source.match(regex);
    if (match?.[1]) {
      return decodeHtml(match[1].trim());
    }
  }
  return null;
}

function collectAll(regex: RegExp, source: string): string[] {
  const results: string[] = [];
  regex.lastIndex = 0;
  let match = regex.exec(source);
  while (match) {
    if (match[1]) {
      results.push(match[1].trim());
    }
    match = regex.exec(source);
  }
  return results;
}

function parseSrcset(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function toAbsoluteUrl(candidate: string, baseUrl: string): string | null {
  const trimmed = decodeHtml(candidate.trim());
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return null;
  }
  try {
    const normalized = new URL(trimmed, baseUrl);
    if (!["http:", "https:"].includes(normalized.protocol)) {
      return null;
    }
    return normalized.toString();
  } catch {
    return null;
  }
}

export function extractSiteData(
  html: string,
  sourceUrl: string,
  finalUrl: string,
): ExtractedSiteData {
  const base = finalUrl || sourceUrl;

  const title = firstMatch([TITLE_REGEX], html) ?? "Untitled";
  const description = firstMatch(
    [DESCRIPTION_REGEX, DESCRIPTION_REGEX_REVERSED],
    html,
  );
  const ogImage = firstMatch([OG_IMAGE_REGEX, OG_IMAGE_REGEX_REVERSED], html);

  const seen = new Map<string, DetectedAsset>();
  const add = (candidate: string, kind: AssetKind) => {
    const absolute = toAbsoluteUrl(candidate, base);
    if (absolute && !seen.has(absolute)) {
      seen.set(absolute, { url: absolute, kind });
    }
  };

  for (const { regex, kind } of SIMPLE_SOURCES) {
    for (const raw of collectAll(regex, html)) {
      add(raw, kind);
    }
  }

  for (const rawSet of collectAll(SRCSET_REGEX, html)) {
    // Keep only the largest candidate per srcset to avoid duplicates.
    const candidates = parseSrcset(rawSet);
    const last = candidates.at(-1);
    if (last) add(last, "image");
  }

  // Inline style backgrounds: scan only style="..." attribute bodies.
  const styleAttrRegex = /style=["']([^"']*url\([^"']*\)[^"']*)["']/gi;
  for (const styleBody of collectAll(styleAttrRegex, html)) {
    INLINE_BG_REGEX.lastIndex = 0;
    let match = INLINE_BG_REGEX.exec(styleBody);
    while (match) {
      if (match[2]) add(match[2], "image");
      match = INLINE_BG_REGEX.exec(styleBody);
    }
  }

  if (ogImage) add(ogImage, "image");

  // Images first (what users care about), then video, icons last.
  const order: Record<AssetKind, number> = {
    image: 0,
    video: 1,
    icon: 2,
    stylesheet: 3,
    font: 4,
  };
  const assets = [...seen.values()].sort(
    (a, b) => order[a.kind] - order[b.kind],
  );

  return { finalUrl: base, title, description, ogImage, html, assets };
}
