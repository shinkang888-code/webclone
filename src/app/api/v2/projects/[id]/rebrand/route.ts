import { applyRebrand } from "@/lib/v2/rebrand";
import type { RebrandRequest } from "@/types/project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as RebrandRequest;
    if (!body.brandOriginal?.trim() || !body.brandNew?.trim()) {
      return Response.json(
        { ok: false, error: "원본·새 브랜드명을 모두 입력해 주세요." },
        { status: 400 },
      );
    }
    const result = await applyRebrand(id, body);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "리브랜딩 실패";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
