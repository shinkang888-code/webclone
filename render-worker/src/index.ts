import { createServer } from "node:http";
import { chromium } from "playwright";

const PORT = Number(process.env.PORT ?? 3100);
const SECRET = process.env.RENDER_WORKER_SECRET;
const RENDER_TIMEOUT_MS = 60_000;

interface RenderRequest {
  url: string;
}

async function renderUrl(url: string): Promise<{ html: string; finalUrl: string; title: string }> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    });

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: RENDER_TIMEOUT_MS,
    });

    const title = await page.title();
    const finalUrl = page.url();
    const html = await page.content();

    return { html, finalUrl, title };
  } finally {
    await browser.close();
  }
}

function readJsonBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch {
        reject(new Error("invalid-json"));
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== "POST" || req.url !== "/render") {
    res.writeHead(404);
    res.end();
    return;
  }

  if (SECRET) {
    const auth = req.headers.authorization ?? "";
    if (auth !== `Bearer ${SECRET}`) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
  }

  try {
    const body = (await readJsonBody(req)) as RenderRequest;
    if (!body.url?.trim()) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "url required" }));
      return;
    }

    const result = await renderUrl(body.url.trim());
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "render failed";
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  }
});

server.listen(PORT, () => {
  console.log(`[render-worker] listening on :${PORT}`);
});
