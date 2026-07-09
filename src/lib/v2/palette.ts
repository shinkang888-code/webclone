/** Extract dominant colors from CSS and remap to brand palette. */

const HEX_REGEX = /#([0-9a-fA-F]{3,8})\b/g;
const RGB_REGEX = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;

function normalizeHex(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return `#${h.slice(0, 6)}`.toLowerCase();
}

export function extractColorTokens(css: string): string[] {
  const colors = new Set<string>();
  let match: RegExpExecArray | null;

  HEX_REGEX.lastIndex = 0;
  while ((match = HEX_REGEX.exec(css)) !== null) {
    colors.add(normalizeHex(`#${match[1]}`));
  }

  RGB_REGEX.lastIndex = 0;
  while ((match = RGB_REGEX.exec(css)) !== null) {
    const r = Number(match[1]).toString(16).padStart(2, "0");
    const g = Number(match[2]).toString(16).padStart(2, "0");
    const b = Number(match[3]).toString(16).padStart(2, "0");
    colors.add(`#${r}${g}${b}`);
  }

  return [...colors].slice(0, 20);
}

export function remapColors(
  css: string,
  mapping: Record<string, string>,
): string {
  let result = css;
  for (const [from, to] of Object.entries(mapping)) {
    const normalized = normalizeHex(from);
    result = result.replaceAll(normalized, to);
    result = result.replaceAll(normalized.toUpperCase(), to);
    result = result.replaceAll(from, to);
    // 3-char shorthand
    if (normalized.length === 7) {
      const short = `#${normalized[1]}${normalized[3]}${normalized[5]}`;
      result = result.replaceAll(short, to);
    }
  }
  return result;
}

export function remapColorsInHtml(
  html: string,
  mapping: Record<string, string>,
): string {
  let result = html;
  for (const [from, to] of Object.entries(mapping)) {
    result = result.replaceAll(from, to);
    result = result.replaceAll(from.toUpperCase(), to);
  }
  return result;
}
