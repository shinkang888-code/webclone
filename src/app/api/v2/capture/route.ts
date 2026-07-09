import { runCapturePipeline } from "@/lib/v2/capture";
import type { CaptureRequest, CaptureStreamEvent } from "@/types/project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const startedAt = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: CaptureStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        const body = (await request.json()) as CaptureRequest;
        if (!body.url?.trim()) {
          throw new Error("스캔할 웹사이트 주소를 입력해 주세요.");
        }

        const result = await runCapturePipeline(body.url, send, startedAt);
        send({ type: "done", result });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "처리 중 알 수 없는 오류가 발생했어요.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
