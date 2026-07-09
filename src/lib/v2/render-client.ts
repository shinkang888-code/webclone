import { assertPublicUrl } from "@/lib/clone/security";

export interface RenderResult {
  html: string;
  finalUrl: string;
  title: string;
  mode: "playwright" | "fetch-fallback";
}

const FETCH_TIMEOUT_MS = 25_000;
const MAX_HTML_BYTES = 15 * 1024 * 1024;

async function readHtmlWithCap(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new Error("페이지가 너무 커요(15MB 초과).");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function fetchFallback(targetUrl: URL): Promise<RenderResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(targetUrl.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) {
      throw new Error(`대상 사이트 응답 오류 (HTTP ${response.status})`);
    }
    const html = await readHtmlWithCap(response);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "Untitled";
    return {
      html,
      finalUrl: response.url || targetUrl.toString(),
      title,
      mode: "fetch-fallback",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function renderWithWorker(targetUrl: URL): Promise<RenderResult> {
  const workerUrl = process.env.RENDER_WORKER_URL?.replace(/\/$/, "");
  if (!workerUrl) {
    return fetchFallback(targetUrl);
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = process.env.RENDER_WORKER_SECRET;
  if (secret) headers.authorization = `Bearer ${secret}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch(`${workerUrl}/render`, {
      method: "POST",
      headers,
      body: JSON.stringify({ url: targetUrl.toString() }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `렌더 워커 오류 (HTTP ${response.status})`);
    }

    const data = (await response.json()) as {
      html: string;
      finalUrl: string;
      title: string;
    };

    return {
      html: data.html,
      finalUrl: data.finalUrl,
      title: data.title,
      mode: "playwright",
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("렌더 워커 응답 시간 초과(90초).");
    }
    // Worker unavailable — degrade gracefully
    console.warn("[v2] render worker failed, using fetch fallback:", error);
    return fetchFallback(targetUrl);
  } finally {
    clearTimeout(timeout);
  }
}

export async function renderPage(rawUrl: string): Promise<RenderResult> {
  const trimmed = rawUrl.trim();
  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
  const targetUrl = new URL(withProtocol);
  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    throw new Error("http/https 주소만 스캔할 수 있어요.");
  }
  await assertPublicUrl(targetUrl);
  return renderWithWorker(targetUrl);
}
