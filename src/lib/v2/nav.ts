import type { NavItem, NavMap } from "@/types/project";

const NAV_BLOCK_REGEX = /<nav\b[^>]*>([\s\S]*?)<\/nav>/gi;
const ANCHOR_REGEX = /<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
const TAG_STRIP = /<[^>]+>/g;

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function cleanLabel(raw: string): string {
  return decodeHtml(raw.replace(TAG_STRIP, " ").replace(/\s+/g, " ").trim());
}

function extractLinks(html: string): NavItem[] {
  const items: NavItem[] = [];
  let match: RegExpExecArray | null;
  ANCHOR_REGEX.lastIndex = 0;

  while ((match = ANCHOR_REGEX.exec(html)) !== null) {
    const href = match[1]?.trim() ?? null;
    const label = cleanLabel(match[2] ?? "");
    if (!label || label.length > 80) continue;
    if (href?.startsWith("javascript:")) continue;
    items.push({ label, href, children: [] });
  }

  return items;
}

function dedupeItems(items: NavItem[]): NavItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.label}|${item.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractNavMap(html: string): NavMap {
  const navBlocks: string[] = [];
  let match: RegExpExecArray | null;
  NAV_BLOCK_REGEX.lastIndex = 0;

  while ((match = NAV_BLOCK_REGEX.exec(html)) !== null) {
    navBlocks.push(match[0]);
  }

  if (navBlocks.length > 0) {
    const items = dedupeItems(extractLinks(navBlocks.join("\n")));
    if (items.length > 0) {
      return { items: items.slice(0, 30), source: "nav" };
    }
  }

  const roleNav = html.match(
    /<[^>]+role=["']navigation["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
  );
  if (roleNav?.[0]) {
    const items = dedupeItems(extractLinks(roleNav[0]));
    if (items.length > 0) {
      return { items: items.slice(0, 30), source: "role-navigation" };
    }
  }

  const headerMatch = html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/i);
  if (headerMatch?.[0]) {
    const items = dedupeItems(extractLinks(headerMatch[0]));
    if (items.length > 0) {
      return { items: items.slice(0, 30), source: "header" };
    }
  }

  return { items: [], source: "heuristic" };
}
