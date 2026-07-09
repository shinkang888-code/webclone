import { put } from "@vercel/blob";
import { aspectForRole } from "@/lib/v2/prompts";
import type { ImageSlot } from "@/types/project";

const FAL_ENDPOINT = "https://fal.run/fal-ai/flux/schnell";

export function isImageGenConfigured(): boolean {
  return Boolean(process.env.FAL_KEY);
}

interface FalImageResult {
  images: { url: string; width: number; height: number }[];
}

export async function generateImage(
  prompt: string,
  slot: ImageSlot,
): Promise<{ url: string; width: number; height: number }> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    throw new Error(
      "이미지 생성 API가 설정되지 않았어요. FAL_KEY 환경 변수를 추가해 주세요.",
    );
  }

  const response = await fetch(FAL_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Key ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: aspectForRole(slot.role),
      num_images: 1,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `이미지 생성 실패 (HTTP ${response.status})`);
  }

  const data = (await response.json()) as FalImageResult;
  const image = data.images?.[0];
  if (!image?.url) {
    throw new Error("이미지 생성 결과가 비어 있어요.");
  }
  return image;
}

export async function uploadGeneratedImage(
  projectId: string,
  slotKey: string,
  imageUrl: string,
): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok || !response.body) {
    throw new Error("생성된 이미지를 다운로드하지 못했어요.");
  }
  const blob = await put(
    `projects/${projectId}/generated/${slotKey}.webp`,
    response.body,
    {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
      allowOverwrite: true,
      multipart: true,
    },
  );
  return blob.url;
}
