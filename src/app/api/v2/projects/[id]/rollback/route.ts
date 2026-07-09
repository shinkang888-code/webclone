import { rollbackPublish } from "@/lib/v2/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { publishId: string };
    if (!body.publishId) {
      return Response.json({ ok: false, error: "publishId가 필요해요." }, { status: 400 });
    }
    const site = await rollbackPublish(id, body.publishId);
    if (!site) {
      return Response.json({ ok: false, error: "발행 기록을 찾을 수 없어요." }, { status: 404 });
    }
    return Response.json({ ok: true, site });
  } catch (error) {
    const message = error instanceof Error ? error.message : "롤백 실패";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
