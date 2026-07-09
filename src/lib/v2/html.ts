/** Fetch HTML/CSS from Blob public URLs. */

export async function fetchTextFromUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) {
      throw new Error(`파일을 불러오지 못했어요 (HTTP ${response.status})`);
    }
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export function extractTitle(html: string): string {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "Untitled";
}

export function replaceImgSrc(html: string, oldSrc: string, newSrc: string): string {
  const escaped = oldSrc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(src=["'])${escaped}(["'])`, "gi");
  return html.replace(regex, `$1${newSrc}$2`);
}

export function replaceImgAlt(html: string, oldAlt: string, newAlt: string): string {
  if (!oldAlt) return html;
  const escaped = oldAlt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(alt=["'])${escaped}(["'])`, "gi");
  return html.replace(regex, `$1${newAlt}$2`);
}
