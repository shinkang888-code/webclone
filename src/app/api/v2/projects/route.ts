import { listProjectSummaries } from "@/lib/v2/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await listProjectSummaries();
    return Response.json({ ok: true, projects });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "프로젝트 목록을 불러오지 못했어요.";
    return Response.json({ ok: false, projects: [], error: message }, { status: 500 });
  }
}
