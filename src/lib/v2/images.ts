import { generateImage, isImageGenConfigured, uploadGeneratedImage } from "@/lib/v2/image-gen";
import { fetchTextFromUrl, replaceImgSrc } from "@/lib/v2/html";
import { buildImagePrompt } from "@/lib/v2/prompts";
import {
  getProjectById,
  getWorkingHtmlUrl,
  listAssets,
  updateProjectStatus,
  upsertAsset,
} from "@/lib/v2/db";
import { uploadV2Html } from "@/lib/v2/blob";
import type { ImageActionRequest, ImageSlot } from "@/types/project";

export function collectAllSlots(projectId: string): Promise<ImageSlot[]> {
  return getProjectById(projectId).then((p) => {
    if (!p?.capture?.structure) return [];
    return p.capture.structure.sections.flatMap((s) => s.imageSlots);
  });
}

export async function processImageAction(
  projectId: string,
  action: ImageActionRequest,
): Promise<{ blobUrl: string; htmlUrl: string }> {
  const project = await getProjectById(projectId);
  if (!project) throw new Error("프로젝트를 찾을 수 없어요.");

  const slots = project.capture?.structure.sections.flatMap((s) => s.imageSlots) ?? [];
  const slot = slots.find((s) => s.key === action.slotKey);
  if (!slot) throw new Error(`이미지 슬롯 '${action.slotKey}'을 찾을 수 없어요.`);

  let blobUrl: string;

  if (action.action === "keep") {
    blobUrl = slot.src;
    await upsertAsset({
      id: `${projectId}-${action.slotKey}`,
      projectId,
      slotKey: action.slotKey,
      role: slot.role,
      blobUrl,
      originalSrc: slot.src,
      isGenerated: false,
      aspectRatio: slot.aspectRatio,
      prompt: null,
    });
  } else if (action.action === "upload") {
    if (!action.uploadUrl) throw new Error("업로드 URL이 필요해요.");
    blobUrl = action.uploadUrl;
    await upsertAsset({
      id: `${projectId}-${action.slotKey}`,
      projectId,
      slotKey: action.slotKey,
      role: slot.role,
      blobUrl,
      originalSrc: slot.src,
      isGenerated: false,
      aspectRatio: slot.aspectRatio,
      prompt: null,
    });
  } else {
    if (!isImageGenConfigured()) {
      throw new Error("FAL_KEY가 설정되지 않아 AI 이미지 생성을 사용할 수 없어요.");
    }
    const prompt =
      action.customPrompt ??
      buildImagePrompt(slot, project.concept, project.brandNew ?? "Brand");
    const generated = await generateImage(prompt, slot);
    blobUrl = await uploadGeneratedImage(projectId, action.slotKey, generated.url);
    await upsertAsset({
      id: `${projectId}-${action.slotKey}`,
      projectId,
      slotKey: action.slotKey,
      role: slot.role,
      blobUrl,
      originalSrc: slot.src,
      isGenerated: true,
      aspectRatio: `${generated.width}x${generated.height}`,
      prompt,
    });
  }

  const htmlUrl = await getWorkingHtmlUrl(projectId);
  if (!htmlUrl) throw new Error("HTML을 찾을 수 없어요.");
  let html = await fetchTextFromUrl(htmlUrl);
  html = replaceImgSrc(html, slot.src, blobUrl);
  const newHtmlUrl = await uploadV2Html(projectId, html, "working");

  const assets = await listAssets(projectId);
  if (assets.some((a) => a.isGenerated)) {
    await updateProjectStatus(projectId, "rebranded");
  }

  return { blobUrl, htmlUrl: newHtmlUrl };
}

export async function generateAllSlots(
  projectId: string,
): Promise<{ processed: number; skipped: number }> {
  const project = await getProjectById(projectId);
  if (!project?.capture) throw new Error("캡처 데이터가 없어요.");
  if (!project.brandNew) throw new Error("먼저 리브랜딩을 완료해 주세요.");

  const slots = project.capture.structure.sections.flatMap((s) => s.imageSlots);
  let processed = 0;
  let skipped = 0;

  for (const slot of slots.slice(0, 10)) {
    try {
      await processImageAction(projectId, { slotKey: slot.key, action: "generate" });
      processed += 1;
    } catch {
      skipped += 1;
    }
  }

  return { processed, skipped };
}
