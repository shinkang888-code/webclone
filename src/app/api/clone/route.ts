import {
  assertWritableWorkspace,
  MAX_ASSETS,
  saveCloneArtifacts,
} from "@/lib/clone/artifacts";
import { extractSiteData } from "@/lib/clone/extract";
import { assertPublicUrl } from "@/lib/clone/security";
import type { CloneRequest, CloneStreamEvent } from "@/types/clone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 25_000;
const MAX_HTML_BYTES = 15 * 1024 * 1024; // 15MB page cap

function normalizeUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("http/https 주소만 스캔할 수 있어요.");
  }
  return parsed;
}

/** Read the response body incrementally so a huge page can't exhaust memory. */
async function readHtmlWithCap(response: Response): Promise<string> {
  if (!response.body) {
    return "";
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new Error(
        "페이지가 너무 커요(15MB 초과). 더 가벼운 페이지 주소로 시도해 주세요.",
      );
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString("utf-8");
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: CloneStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        const body = (await request.json()) as CloneRequest;
        if (!body.url?.trim()) {
          throw new Error("스캔할 웹사이트 주소를 입력해 주세요.");
        }

        await assertWritableWorkspace();

        const targetUrl = normalizeUrl(body.url);
        await assertPublicUrl(targetUrl);

        send({ type: "phase", phase: "fetch", label: "페이지 가져오는 중" });

        const controllerAbort = new AbortController();
        const timeout = setTimeout(
          () => controllerAbort.abort(),
          FETCH_TIMEOUT_MS,
        );
        let response: Response;
        try {
          response = await fetch(targetUrl.toString(), {
            signal: controllerAbort.signal,
            redirect: "follow",
            headers: {
              "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
              accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "accept-language": "ko,en;q=0.9",
            },
          });
        } catch (error) {
          if (controllerAbort.signal.aborted) {
            throw new Error(
              "페이지 응답이 25초를 넘어 중단했어요. 잠시 후 다시 시도해 주세요.",
            );
          }
          throw error;
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) {
          throw new Error(
            `대상 사이트가 요청을 거절했어요 (HTTP ${response.status}). 로그인 필요 페이지나 봇 차단 사이트일 수 있어요.`,
          );
        }

        const html = await readHtmlWithCap(response);

        send({ type: "phase", phase: "parse", label: "페이지 분석 중" });
        const extracted = extractSiteData(
          html,
          targetUrl.toString(),
          response.url,
        );

        send({
          type: "meta",
          title: extracted.title,
          totalAssets: Math.min(extracted.assets.length, MAX_ASSETS),
        });

        send({ type: "phase", phase: "assets", label: "이미지·파일 내려받는 중" });

        const result = await saveCloneArtifacts(
          targetUrl.toString(),
          extracted,
          (progress) => send({ type: "asset", ...progress }),
          startedAt,
        );

        send({ type: "phase", phase: "save", label: "결과 저장 중" });
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
