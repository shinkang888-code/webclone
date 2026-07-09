import type { BrandDetection } from "@/types/project";

const OG_SITE_REGEX =
  /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i;
const OG_SITE_REV =
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i;
const TITLE_REGEX = /<title[^>]*>([\s\S]*?)<\/title>/i;
const LOGO_ALT_REGEX = /<img[^>]+alt=["']([^"']*logo[^"']*)["'][^>]*>/i;
const HEADER_TEXT_REGEX = /<header[^>]*>([\s\S]*?)<\/header>/i;

function decodeHtml(v: string): string {
  return v
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function domainBrand(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length >= 2) {
      const name = parts[parts.length - 2];
      if (name.length >= 2 && name.length <= 30) {
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function titleBrand(title: string): string | null {
  const cleaned = decodeHtml(title.trim());
  const parts = cleaned.split(/[|\-–—:·]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 0 && parts[0].length >= 2 && parts[0].length <= 40) {
    return parts[0];
  }
  return cleaned.length <= 40 ? cleaned : null;
}

function ngramCandidates(text: string): Map<string, number> {
  const words = text.match(/[A-Za-z가-힣]{2,20}/g) ?? [];
  const counts = new Map<string, number>();
  for (const w of words) {
    const key = w.length > 1 ? w : "";
    if (!key || /^(the|and|for|with|from|more|home|page)$/i.test(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function detectBrand(
  html: string,
  sourceUrl: string,
): BrandDetection {
  const signals: BrandDetection["signals"] = [];

  const title = html.match(TITLE_REGEX)?.[1]?.trim();
  if (title) {
    const tb = titleBrand(title);
    if (tb) signals.push({ source: "title", value: tb, weight: 0.35 });
  }

  const ogSite =
    html.match(OG_SITE_REGEX)?.[1] ?? html.match(OG_SITE_REV)?.[1];
  if (ogSite) {
    signals.push({ source: "og:site_name", value: decodeHtml(ogSite.trim()), weight: 0.3 });
  }

  const logoAlt = html.match(LOGO_ALT_REGEX)?.[1];
  if (logoAlt) {
    const cleaned = stripTags(logoAlt);
    if (cleaned) signals.push({ source: "logo-alt", value: cleaned, weight: 0.25 });
  }

  const header = html.match(HEADER_TEXT_REGEX)?.[1];
  if (header) {
    const headerText = stripTags(header).slice(0, 500);
    const counts = ngramCandidates(headerText);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) {
      signals.push({ source: "header-repeat", value: top[0], weight: 0.2 });
    }
  }

  const domain = domainBrand(sourceUrl);
  if (domain) {
    signals.push({ source: "domain", value: domain, weight: 0.15 });
  }

  // Score candidates
  const scores = new Map<string, number>();
  for (const s of signals) {
    const key = s.value.toLowerCase();
    scores.set(key, (scores.get(key) ?? 0) + s.weight);
  }

  let best = "";
  let bestScore = 0;
  for (const [key, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = signals.find((s) => s.value.toLowerCase() === key)?.value ?? key;
    }
  }

  if (!best && domain) {
    best = domain;
    bestScore = 0.15;
  }

  return {
    candidate: best || "Unknown",
    confidence: Math.min(1, bestScore),
    signals,
  };
}
