/** Fetch external stylesheets and produce an inline <style> bundle. */

const LINK_STYLESHEET_REGEX =
  /<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi;
const HREF_REGEX = /href=["']([^"']+)["']/i;

const FETCH_TIMEOUT_MS = 10_000;
const MAX_CSS_BYTES = 2 * 1024 * 1024;

function toAbsoluteUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchStylesheet(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "text/css,*/*" },
    });
    if (!response.ok) return null;
    const text = await response.text();
    if (text.length > MAX_CSS_BYTES) return text.slice(0, MAX_CSS_BYTES);
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export interface InlineCssResult {
  /** Combined CSS text */
  css: string;
  /** Number of external sheets successfully fetched */
  fetchedCount: number;
  /** HTML with <link rel=stylesheet> replaced by inline <style> */
  html: string;
}

export async function inlineStylesheets(
  html: string,
  baseUrl: string,
): Promise<InlineCssResult> {
  const links: { full: string; href: string }[] = [];
  let match: RegExpExecArray | null;
  LINK_STYLESHEET_REGEX.lastIndex = 0;

  while ((match = LINK_STYLESHEET_REGEX.exec(html)) !== null) {
    const full = match[0];
    const href = full.match(HREF_REGEX)?.[1];
    if (href) links.push({ full, href });
  }

  const cssParts: string[] = [];
  let fetchedCount = 0;

  for (const { href } of links) {
    const absolute = toAbsoluteUrl(href, baseUrl);
    if (!absolute) continue;
    const css = await fetchStylesheet(absolute);
    if (css) {
      cssParts.push(`/* ${absolute} */\n${css}`);
      fetchedCount += 1;
    }
  }

  const combined = cssParts.join("\n\n");
  const styleTag = combined
    ? `<style data-v2-inlined="true">\n${combined}\n</style>`
    : "";

  let resultHtml = html;
  for (const { full } of links) {
    resultHtml = resultHtml.replace(full, "");
  }

  if (styleTag) {
    const headClose = resultHtml.match(/<\/head>/i);
    if (headClose) {
      resultHtml = resultHtml.replace(/<\/head>/i, `${styleTag}\n</head>`);
    } else {
      resultHtml = `${styleTag}\n${resultHtml}`;
    }
  }

  return { css: combined, fetchedCount, html: resultHtml };
}
