import type { ExtractedSiteData } from "@/types/clone";

const TITLE_REGEX = /<title[^>]*>([\s\S]*?)<\/title>/i;
const DESCRIPTION_REGEX =
  /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i;
const OG_IMAGE_REGEX =
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i;
const IMG_SRC_REGEX = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
const SOURCE_SRC_REGEX = /<source[^>]+src=["']([^"']+)["'][^>]*>/gi;
const ICON_LINK_REGEX =
  /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/gi;

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function firstMatch(regex: RegExp, source: string): string | null {
  const match = source.match(regex);
  if (!match?.[1]) {
    return null;
  }
  return decodeHtml(match[1].trim());
}

function collectAll(regex: RegExp, source: string): string[] {
  const results: string[] = [];
  let match = regex.exec(source);
  while (match) {
    if (match[1]) {
      results.push(match[1].trim());
    }
    match = regex.exec(source);
  }
  return results;
}

function toAbsoluteUrl(candidate: string, baseUrl: string): string | null {
  try {
    const normalized = new URL(candidate, baseUrl);
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
  const title = firstMatch(TITLE_REGEX, html) ?? "Untitled";
  const description = firstMatch(DESCRIPTION_REGEX, html);
  const ogImage = firstMatch(OG_IMAGE_REGEX, html);

  const rawAssetUrls = [
    ...collectAll(IMG_SRC_REGEX, html),
    ...collectAll(SOURCE_SRC_REGEX, html),
    ...collectAll(ICON_LINK_REGEX, html),
    ...(ogImage ? [ogImage] : []),
  ];

  const dedupedAssets = new Set<string>();
  for (const assetUrl of rawAssetUrls) {
    const absolute = toAbsoluteUrl(assetUrl, finalUrl || sourceUrl);
    if (absolute) {
      dedupedAssets.add(absolute);
    }
  }

  return {
    finalUrl,
    title,
    description,
    ogImage,
    html,
    assetUrls: [...dedupedAssets],
  };
}
