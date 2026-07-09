import { getPaletteTokens } from "@/lib/v2/rebrand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const tokens = await getPaletteTokens(id);
    return Response.json({ ok: true, tokens });
  } catch (error) {
    const message = error instanceof Error ? error.message : "팔레트 추출 실패";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
