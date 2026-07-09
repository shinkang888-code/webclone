import { type HTMLElement, parse } from "node-html-parser";

/**
 * Rewrites a cloned page into a self-contained snapshot:
 *  - asset references (img/src, srcset, source, video poster, link icons,
 *    inline style url(...)) are pointed at their Blob copies
 *  - external stylesheets are fetched and inlined as <style> so the clone
 *    renders without depending on the origin
 *  - scripts are stripped (security + the snapshot is a static template)
 *
 * This is best-effort: any fetch/parse failure falls back to leaving the
 * original markup untouched rather than breaking the whole clone.
 */

const CSS_FETCH_TIMEOUT_MS = 8_000;
const MAX_CSS_BYTES = 2 * 1024 * 1024;
const MAX_STYLESHEETS = 12;

export interface RewriteResult {
  html: string;
  inlinedStylesheets: number;
}

function rewriteSrcset(value: string, map: Map<string, string>): string {
  return value
    .split(",")
    .map((entry) => {
      const parts = entry.trim().split(/\s+/);
      const url = parts[0];
      const replacement = map.get(url);
      if (replacement) parts[0] = replacement;
      return parts.join(" ");
    })
    .join(", ");
}

async function fetchStylesheet(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CSS_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_CSS_BYTES) return null;
    const text = await response.text();
    if (text.length > MAX_CSS_BYTES) return null;
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function toAbsolute(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export async function rewriteSnapshot(
  html: string,
  baseUrl: string,
  /** original source URL -> Blob URL, from the asset download pool */
  assetMap: Map<string, string>,
): Promise<RewriteResult> {
  let root: HTMLElement;
  try {
    root = parse(html, { lowerCaseTagName: true, comment: false });
  } catch {
    return { html, inlinedStylesheets: 0 };
  }

  // Resolve a raw attribute value (possibly relative) against the map.
  const mapAbsolute = (raw: string): string | undefined => {
    const abs = toAbsolute(raw, baseUrl);
    if (abs && assetMap.has(abs)) return assetMap.get(abs);
    return assetMap.get(raw);
  };

  // 1. Strip scripts (static template + safety).
  for (const script of root.querySelectorAll("script")) script.remove();

  // 2. Rewrite <img>, lazy-load, <source>, <video poster>, icons.
  for (const img of root.querySelectorAll("img")) {
    for (const attr of ["src", "data-src", "data-lazy-src", "data-original"]) {
      const val = img.getAttribute(attr);
      if (val) {
        const repl = mapAbsolute(val);
        if (repl) img.setAttribute("src", repl);
      }
    }
    const srcset = img.getAttribute("srcset") ?? img.getAttribute("data-srcset");
    if (srcset) {
      const absMap = new Map<string, string>();
      for (const [k, v] of assetMap) absMap.set(k, v);
      img.setAttribute("srcset", rewriteSrcset(srcset, absMap));
    }
  }
  for (const source of root.querySelectorAll("source")) {
    const srcset = source.getAttribute("srcset");
    if (srcset) {
      const absMap = new Map<string, string>();
      for (const [k, v] of assetMap) absMap.set(k, v);
      source.setAttribute("srcset", rewriteSrcset(srcset, absMap));
    }
    const src = source.getAttribute("src");
    if (src) {
      const repl = mapAbsolute(src);
      if (repl) source.setAttribute("src", repl);
    }
  }
  for (const video of root.querySelectorAll("video[poster]")) {
    const poster = video.getAttribute("poster");
    if (poster) {
      const repl = mapAbsolute(poster);
      if (repl) video.setAttribute("poster", repl);
    }
  }
  for (const link of root.querySelectorAll("link[rel*='icon']")) {
    const href = link.getAttribute("href");
    if (href) {
      const repl = mapAbsolute(href);
      if (repl) link.setAttribute("href", repl);
    }
  }

  // 3. Fetch + inline external stylesheets, rewriting their asset URLs too.
  const styleLinks = root
    .querySelectorAll("link[rel='stylesheet']")
    .slice(0, MAX_STYLESHEETS);

  let inlined = 0;
  const cssResults = await Promise.all(
    styleLinks.map(async (link) => {
      const href = link.getAttribute("href");
      if (!href) return null;
      const abs = toAbsolute(href, baseUrl);
      if (!abs) return null;
      let css = await fetchStylesheet(abs);
      if (!css) return null;
      // Rewrite url(...) inside CSS to Blob copies where we have them.
      css = css.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, _q, u) => {
        const cssAbs = toAbsolute(u, abs);
        const repl = cssAbs ? assetMap.get(cssAbs) : undefined;
        return repl ? `url(${repl})` : match;
      });
      return { link, css };
    }),
  );

  for (const result of cssResults) {
    if (!result) continue;
    const style = parse(`<style data-inlined>${result.css}</style>`)
      .firstChild as HTMLElement;
    result.link.replaceWith(style);
    inlined += 1;
  }

  return { html: root.toString(), inlinedStylesheets: inlined };
}
