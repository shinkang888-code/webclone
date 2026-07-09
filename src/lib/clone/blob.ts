import { put } from "@vercel/blob";

/**
 * All persisted files (HTML snapshots, downloaded images) live in
 * Vercel Blob instead of local disk, since serverless functions on
 * Vercel have a read-only, ephemeral filesystem outside /tmp.
 */

export interface BlobUploadResult {
  url: string;
  bytes: number;
}

const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;

/**
 * Wrap a fetch response body with a byte-counting guard so a single
 * oversized asset can't blow past our size budget or run away with
 * function memory — the stream errors out once maxBytes is exceeded.
 */
function capStream(
  source: ReadableStream<Uint8Array>,
  maxBytes: number,
): { stream: ReadableStream<Uint8Array>; getBytes: () => number } {
  let total = 0;
  const reader = source.getReader();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        controller.error(new Error("asset-too-large"));
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      reader.cancel(reason).catch(() => undefined);
    },
  });

  return { stream, getBytes: () => total };
}

export async function uploadHtmlSnapshot(
  runId: string,
  html: string,
): Promise<BlobUploadResult> {
  const buffer = Buffer.from(html, "utf-8");
  const blob = await put(`clones/${runId}/source.html`, buffer, {
    access: "public",
    contentType: "text/html; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return { url: blob.url, bytes: buffer.byteLength };
}

export async function uploadAssetFromResponse(
  runId: string,
  filename: string,
  response: Response,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<BlobUploadResult> {
  if (!response.body) {
    throw new Error("empty-body");
  }
  const { stream, getBytes } = capStream(response.body, maxBytes);
  const blob = await put(`clones/${runId}/assets/${filename}`, stream, {
    access: "public",
    contentType: response.headers.get("content-type") ?? undefined,
    addRandomSuffix: false,
    allowOverwrite: true,
    multipart: true,
  });
  return { url: blob.url, bytes: getBytes() };
}
