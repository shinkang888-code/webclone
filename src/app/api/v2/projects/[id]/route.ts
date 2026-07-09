import { getProjectById } from "@/lib/v2/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const project = await getProjectById(id);
    if (!project) {
      return Response.json({ ok: false, error: "프로젝트를 찾을 수 없어요." }, { status: 404 });
    }
    return Response.json({ ok: true, project });
  } catch (error) {
    const message = error instanceof Error ? error.message : "프로젝트를 불러오지 못했어요.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
