import { detectProjectBrand } from "@/lib/v2/rebrand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const detection = await detectProjectBrand(id);
    if (!detection) {
      return Response.json({ ok: false, error: "캡처 데이터가 없어요." }, { status: 404 });
    }
    return Response.json({ ok: true, detection });
  } catch (error) {
    const message = error instanceof Error ? error.message : "브랜드 감지 실패";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
