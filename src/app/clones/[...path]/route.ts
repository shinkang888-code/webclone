import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves files written to public/clones at runtime.
 * In `next dev` the public folder handles these directly, but in
 * production (standalone/docker) newly created files aren't part of
 * the build output — this route streams them from disk instead.
 */

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  const clonesRoot = path.join(process.cwd(), "public", "clones");
  const requested = path.normalize(path.join(clonesRoot, ...segments));

  // Path traversal guard: resolved path must stay inside public/clones.
  if (!requested.startsWith(clonesRoot + path.sep)) {
    return new Response("잘못된 경로예요.", { status: 400 });
  }

  try {
    const info = await stat(requested);
    if (!info.isFile()) {
      return new Response("파일을 찾을 수 없어요.", { status: 404 });
    }

    const ext = path.extname(requested).toLowerCase();
    const stream = Readable.toWeb(
      createReadStream(requested),
    ) as ReadableStream<Uint8Array>;

    return new Response(stream, {
      headers: {
        "content-type": MIME[ext] ?? "application/octet-stream",
        "content-length": String(info.size),
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("파일을 찾을 수 없어요.", { status: 404 });
  }
}
