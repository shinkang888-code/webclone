import type { SectionNode, SectionRole, StructureTree, ImageSlot } from "@/types/project";

const SEMANTIC_TAGS: Record<string, SectionRole> = {
  header: "header",
  nav: "nav",
  main: "main",
  section: "section",
  footer: "footer",
  aside: "section",
  article: "section",
};

const BLOCK_REGEX =
  /<(header|nav|main|section|footer|aside|article)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi;

const IMG_REGEX = /<img[^>]*>/gi;
const SRC_REGEX = /\bsrc=["']([^"']+)["']/i;
const ALT_REGEX = /\balt=["']([^"']*)["']/i;
const TAG_TEXT_REGEX = /<[^>]+>/g;

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(TAG_TEXT_REGEX, " ").replace(/\s+/g, " ").trim());
}

function detectRole(tag: string, index: number, isFirst: boolean): SectionRole {
  const lower = tag.toLowerCase();
  if (SEMANTIC_TAGS[lower]) {
    const base = SEMANTIC_TAGS[lower];
    if (base === "section" && isFirst) return "hero";
    if (base === "section" && index > 0) return "section";
    return base;
  }
  return "unknown";
}

function classifyImage(alt: string | null, index: number, inHeader: boolean): ImageSlot["role"] {
  const lower = (alt ?? "").toLowerCase();
  if (inHeader && (lower.includes("logo") || index === 0)) return "logo";
  if (lower.includes("hero") || lower.includes("banner")) return "hero";
  if (lower.includes("icon") || lower.includes("favicon")) return "icon";
  if (index === 0 && inHeader) return "logo";
  return "content";
}

function extractImageSlots(html: string, inHeader: boolean): ImageSlot[] {
  const slots: ImageSlot[] = [];
  let match: RegExpExecArray | null;
  IMG_REGEX.lastIndex = 0;
  let idx = 0;

  while ((match = IMG_REGEX.exec(html)) !== null) {
    const tag = match[0];
    const src = tag.match(SRC_REGEX)?.[1] ?? "";
    if (!src || src.startsWith("data:")) continue;
    const alt = tag.match(ALT_REGEX)?.[1] ?? null;
    slots.push({
      key: `img-${idx}`,
      src,
      alt,
      role: classifyImage(alt, idx, inHeader),
      aspectRatio: null,
    });
    idx += 1;
  }
  return slots;
}

function makeLabel(role: SectionRole, tag: string, text: string): string {
  if (text.length >= 8) return text.slice(0, 48);
  const defaults: Record<SectionRole, string> = {
    header: "헤더",
    nav: "내비게이션",
    hero: "히어로",
    section: "섹션",
    cta: "CTA",
    footer: "푸터",
    main: "메인",
    unknown: tag,
  };
  return defaults[role];
}

export function decomposeSections(html: string): StructureTree {
  const sections: SectionNode[] = [];
  let match: RegExpExecArray | null;
  BLOCK_REGEX.lastIndex = 0;
  let index = 0;

  while ((match = BLOCK_REGEX.exec(html)) !== null) {
    const full = match[0];
    const tag = match[1].toLowerCase();
    const role = detectRole(tag, index, index === 0);
    const text = stripTags(full);
    const inHeader = role === "header" || role === "nav";

    sections.push({
      id: `block-${index}`,
      role,
      tag,
      label: makeLabel(role, tag, text),
      textPreview: text.slice(0, 200),
      imageSlots: extractImageSlots(full, inHeader),
      childCount: (full.match(/<div/gi) ?? []).length,
      htmlSnippet: full.slice(0, 4000),
    });
    index += 1;
  }

  // Fallback: no semantic blocks — treat body inner as one hero
  if (sections.length === 0) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const body = bodyMatch?.[1] ?? html;
    const text = stripTags(body);
    sections.push({
      id: "block-0",
      role: "hero",
      tag: "body",
      label: text.slice(0, 48) || "페이지 본문",
      textPreview: text.slice(0, 200),
      imageSlots: extractImageSlots(body, false),
      childCount: 0,
      htmlSnippet: body.slice(0, 4000),
    });
  }

  return { sections, totalBlocks: sections.length };
}
