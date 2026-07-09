import { HTMLElement, parse } from "node-html-parser";
import type {
  NavItem,
  SectionNode,
  SectionRole,
  SiteStructure,
} from "@/types/clone";

/**
 * P0 structure clone: turn rendered HTML into a semantic section tree
 * and a menu (nav) tree. This is the backbone the later WYSIWYG editor
 * loads as editable blocks, and what "clone the whole interface" means
 * in practice — layout regions + navigation, not just images.
 */

const MAX_SECTIONS = 60;
const MAX_NAV_ITEMS = 80;

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function firstHeading(el: HTMLElement): string {
  const heading = el.querySelector("h1, h2, h3");
  if (heading) return clean(heading.text).slice(0, 80);
  return clean(el.text).slice(0, 80);
}

/** Classify a top-level block into a semantic role. */
function classify(el: HTMLElement, index: number): SectionRole {
  const tag = el.tagName?.toLowerCase() ?? "div";
  const cls = (el.getAttribute("class") ?? "").toLowerCase();
  const id = (el.getAttribute("id") ?? "").toLowerCase();
  const role = (el.getAttribute("role") ?? "").toLowerCase();
  const hay = `${cls} ${id} ${role}`;

  if (tag === "header" || /(^|[\s_-])header|masthead|topbar/.test(hay)) {
    return "header";
  }
  if (
    tag === "nav" ||
    role === "navigation" ||
    /(^|[\s_-])(nav|menu|gnb|lnb)([\s_-]|$)/.test(hay)
  ) {
    return "nav";
  }
  if (tag === "footer" || /(^|[\s_-])footer|copyright/.test(hay)) {
    return "footer";
  }
  if (tag === "aside" || role === "complementary" || /sidebar|aside/.test(hay)) {
    return "aside";
  }
  if (/hero|jumbotron|banner|visual|main-?visual|kv\b/.test(hay) || index === 0) {
    return "hero";
  }
  if (/(^|[\s_-])(cta|call-?to-?action|subscribe|newsletter)/.test(hay)) {
    return "cta";
  }
  return "section";
}

/** Walk the most content-bearing container's direct children. */
function pickContainer(root: HTMLElement): HTMLElement {
  const body = root.querySelector("body") ?? root;
  const main = body.querySelector("main");
  // If <main> holds most of the sections, prefer body so we still catch
  // header/nav/footer siblings; otherwise body is already right.
  return main && main.childNodes.length > body.childNodes.length / 2
    ? body
    : body;
}

function extractSections(root: HTMLElement): SectionNode[] {
  const container = pickContainer(root);
  const blocks = container.childNodes.filter(
    (n): n is HTMLElement =>
      n instanceof HTMLElement && (n.tagName ?? "") !== "",
  );

  const sections: SectionNode[] = [];
  let index = 0;
  for (const block of blocks) {
    const tag = (block.tagName ?? "div").toLowerCase();
    if (["script", "style", "noscript", "template", "svg"].includes(tag)) {
      continue;
    }
    const text = clean(block.text);
    const imageCount = block.querySelectorAll("img, picture, svg image").length;
    const linkCount = block.querySelectorAll("a").length;
    // Skip empty spacer/util divs with no content, images, or links.
    if (!text && imageCount === 0 && linkCount === 0) continue;

    sections.push({
      role: classify(block, index),
      tag,
      label: firstHeading(block) || `${tag} 블록`,
      textPreview: text.slice(0, 140),
      imageCount,
      linkCount,
    });
    index += 1;
    if (sections.length >= MAX_SECTIONS) break;
  }
  return sections;
}

/** Recursively read an unordered-list menu into a nav tree. */
function readList(ul: HTMLElement, depth: number): NavItem[] {
  if (depth > 3) return [];
  const items: NavItem[] = [];
  for (const li of ul.querySelectorAll(":scope > li")) {
    const anchor = li.querySelector(":scope > a") ?? li.querySelector("a");
    const label = clean(anchor?.text ?? li.text).slice(0, 60);
    if (!label) continue;
    const childUl = li.querySelector(":scope > ul");
    items.push({
      label,
      href: anchor?.getAttribute("href") ?? null,
      children: childUl ? readList(childUl, depth + 1) : [],
    });
    if (items.length >= MAX_NAV_ITEMS) break;
  }
  return items;
}

function extractNav(root: HTMLElement): NavItem[] {
  const navEls = root.querySelectorAll(
    "nav, [role='navigation'], header ul",
  );
  for (const navEl of navEls) {
    const topList = navEl.querySelector("ul");
    if (topList) {
      const tree = readList(topList, 0);
      if (tree.length > 0) return tree;
    }
  }
  // Fallback: flat list of header links.
  const header = root.querySelector("header");
  if (header) {
    const flat: NavItem[] = [];
    for (const a of header.querySelectorAll("a")) {
      const label = clean(a.text).slice(0, 60);
      if (label) {
        flat.push({ label, href: a.getAttribute("href") ?? null, children: [] });
      }
      if (flat.length >= 20) break;
    }
    return flat;
  }
  return [];
}

export function extractStructure(html: string): SiteStructure {
  try {
    const root = parse(html, {
      lowerCaseTagName: true,
      comment: false,
      blockTextElements: { script: false, noscript: false, style: false },
    });
    return {
      sections: extractSections(root),
      nav: extractNav(root),
    };
  } catch {
    return { sections: [], nav: [] };
  }
}
