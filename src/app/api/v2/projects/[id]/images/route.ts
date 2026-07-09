import { generateAllSlots, processImageAction } from "@/lib/v2/images";
import type { ImageActionRequest } from "@/types/project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as ImageActionRequest | { batch: true };
    if ("batch" in body && body.batch) {
      const result = await generateAllSlots(id);
      return Response.json({ ok: true, ...result });
    }
    const action = body as ImageActionRequest;
    const result = await processImageAction(id, action);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "이미지 처리 실패";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
