import type { BrandConcept, ImageSlot } from "@/types/project";

const ROLE_PROMPTS: Record<ImageSlot["role"], string> = {
  logo: "minimal wordmark logo, clean typography, white background",
  hero: "wide hero banner image, atmospheric, professional",
  background: "subtle textured background, soft gradient",
  content: "editorial photograph, natural lighting",
  icon: "simple flat icon, minimal design",
  unknown: "professional web imagery",
};

const TONE_MAP: Record<string, string> = {
  minimal: "minimalist, clean lines, lots of whitespace",
  retro: "retro vintage aesthetic, warm tones",
  luxury: "luxury premium feel, elegant, refined",
  warm: "warm cozy atmosphere, soft lighting",
  modern: "modern contemporary style, sharp and crisp",
};

export function buildImagePrompt(
  slot: ImageSlot,
  concept: BrandConcept | null,
  brandNew: string,
): string {
  const rolePart = ROLE_PROMPTS[slot.role] ?? ROLE_PROMPTS.unknown;
  const keywords = concept?.keywords?.trim() ?? "";
  const tone = concept?.tone?.trim() ?? "modern";
  const tonePart = TONE_MAP[tone] ?? tone;
  const context = slot.alt ? `context: ${slot.alt}` : "";

  return [
    rolePart,
    `brand: ${brandNew}`,
    keywords ? `theme: ${keywords}` : "",
    `style: ${tonePart}`,
    context,
    "high quality, web-ready, no text overlay, no watermark",
  ]
    .filter(Boolean)
    .join(", ");
}

export function aspectForRole(role: ImageSlot["role"]): string {
  switch (role) {
    case "logo":
      return "square_hd";
    case "hero":
      return "landscape_16_9";
    case "icon":
      return "square";
    default:
      return "landscape_4_3";
  }
}
