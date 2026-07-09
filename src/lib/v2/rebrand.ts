import { uploadV2Css, uploadV2Html } from "@/lib/v2/blob";
import { detectBrand } from "@/lib/v2/brand";
import { fetchTextFromUrl } from "@/lib/v2/html";
import { extractColorTokens, remapColors, remapColorsInHtml } from "@/lib/v2/palette";
import { replaceBrandInHtml } from "@/lib/v2/replace";
import {
  getProjectById,
  updateProjectBrand,
  updateProjectStatus,
} from "@/lib/v2/db";
import type { BrandDetection, RebrandRequest } from "@/types/project";

export async function detectProjectBrand(
  projectId: string,
): Promise<BrandDetection | null> {
  const project = await getProjectById(projectId);
  if (!project?.capture?.htmlBlobUrl) return null;
  const html = await fetchTextFromUrl(project.capture.htmlBlobUrl);
  return detectBrand(html, project.sourceUrl);
}

export async function applyRebrand(
  projectId: string,
  input: RebrandRequest,
): Promise<{ rebrandedHtmlUrl: string; replacedCount: number }> {
  const project = await getProjectById(projectId);
  if (!project?.capture?.htmlBlobUrl) {
    throw new Error("캡처 데이터가 없어요. 먼저 구조 클론을 완료해 주세요.");
  }

  await updateProjectStatus(projectId, "rebranding");

  let html = await fetchTextFromUrl(project.capture.htmlBlobUrl);
  const before = html;

  html = replaceBrandInHtml(html, input.brandOriginal, input.brandNew);

  if (input.paletteRemap && Object.keys(input.paletteRemap).length > 0) {
    html = remapColorsInHtml(html, input.paletteRemap);
  }

  let cssUrl = project.capture.cssBlobUrl;
  if (cssUrl && input.paletteRemap) {
    const css = await fetchTextFromUrl(cssUrl);
    const remapped = remapColors(css, input.paletteRemap);
    cssUrl = await uploadV2Css(projectId, remapped);
  }

  const rebrandedHtmlUrl = await uploadV2Html(projectId, html, "rebranded");

  const replacedCount = (before.match(new RegExp(input.brandOriginal, "gi")) ?? []).length;

  await updateProjectBrand(projectId, {
    brandOriginal: input.brandOriginal,
    brandNew: input.brandNew,
    concept: input.concept ?? null,
    rebrandedHtmlUrl,
    status: "rebranded",
  });

  return { rebrandedHtmlUrl, replacedCount };
}

export async function getPaletteTokens(projectId: string): Promise<string[]> {
  const project = await getProjectById(projectId);
  if (!project?.capture?.cssBlobUrl) return [];
  const css = await fetchTextFromUrl(project.capture.cssBlobUrl);
  return extractColorTokens(css);
}
