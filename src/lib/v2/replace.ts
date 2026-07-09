/** Global brand text replacement in HTML. */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceInTextNodes(html: string, from: string, to: string): string {
  if (!from.trim()) return html;
  const pattern = new RegExp(escapeRegex(from), "gi");
  // Replace in text between tags (simple but effective for MVP)
  return html.replace(/>([^<]+)</g, (match, text: string) => {
    const replaced = text.replace(pattern, (m: string) => {
      // Preserve case pattern: ALL CAPS → ALL CAPS, Title → Title
      if (m === m.toUpperCase()) return to.toUpperCase();
      if (m[0] === m[0].toUpperCase()) {
        return to.charAt(0).toUpperCase() + to.slice(1);
      }
      return to;
    });
    return `>${replaced}<`;
  });
}

function replaceInAttributes(
  html: string,
  from: string,
  to: string,
  attr: string,
): string {
  const pattern = new RegExp(
    `(${attr}=["'])${escapeRegex(from)}(["'])`,
    "gi",
  );
  return html.replace(pattern, `$1${to}$2`);
}

function replaceInMetaContent(html: string, from: string, to: string): string {
  const pattern = new RegExp(
    `(content=["'])([^"']*?)${escapeRegex(from)}([^"']*?)(["'])`,
    "gi",
  );
  return html.replace(pattern, (_m, pre, before, after, post) => {
    return `${pre}${before}${to}${after}${post}`;
  });
}

/** Korean: attach common particles when brand ends with 받침 */
export function koreanBrandVariants(brand: string): string[] {
  const variants = [brand];
  const last = brand.charCodeAt(brand.length - 1);
  const hasJong = (last - 0xac00) % 28 !== 0;
  if (hasJong) {
    variants.push(`${brand}은`, `${brand}이`);
  } else {
    variants.push(`${brand}는`, `${brand}가`);
  }
  return variants;
}

export function replaceBrandInHtml(
  html: string,
  original: string,
  replacement: string,
): string {
  let result = html;

  // Title
  result = result.replace(
    new RegExp(`(<title[^>]*>)([\\s\\S]*?)(</title>)`, "i"),
    (_m, open, content, close) => {
      const replaced = content.replace(
        new RegExp(escapeRegex(original), "gi"),
        replacement,
      );
      return `${open}${replaced}${close}`;
    },
  );

  // Meta content, alt, text nodes
  result = replaceInMetaContent(result, original, replacement);
  result = replaceInAttributes(result, original, replacement, "alt");
  result = replaceInTextNodes(result, original, replacement);

  // Korean compound variants (longest first)
  const variants = koreanBrandVariants(original).sort((a, b) => b.length - a.length);
  for (const variant of variants) {
    const repVariant = variant.replace(original, replacement);
    if (variant !== original) {
      result = replaceInTextNodes(result, variant, repVariant);
    }
  }

  return result;
}
