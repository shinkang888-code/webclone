import { saveEdit } from "@/lib/v2/edit";
import { getLatestEdit, getWorkingHtmlUrl } from "@/lib/v2/db";
import { fetchTextFromUrl } from "@/lib/v2/html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const htmlUrl = await getWorkingHtmlUrl(id);
    if (!htmlUrl) {
      return Response.json({ ok: false, error: "편집할 HTML이 없어요." }, { status: 404 });
    }
    const html = await fetchTextFromUrl(htmlUrl);
    const latestEdit = await getLatestEdit(id);
    return Response.json({ ok: true, html, htmlUrl, latestEdit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "편집 데이터 로드 실패";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { html: string; docJson?: unknown };
    if (!body.html?.trim()) {
      return Response.json({ ok: false, error: "HTML이 비어 있어요." }, { status: 400 });
    }
    const result = await saveEdit(id, body.html, body.docJson);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "저장 실패";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
