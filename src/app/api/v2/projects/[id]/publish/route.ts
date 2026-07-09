import { publishProject } from "@/lib/v2/publish";
import type { PublishRequest } from "@/types/project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as PublishRequest;
    const result = await publishProject(id, body);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "발행 실패";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
