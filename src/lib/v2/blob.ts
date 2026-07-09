import { put } from "@vercel/blob";

export async function uploadV2Html(
  projectId: string,
  html: string,
  suffix = "capture",
): Promise<string> {
  const blob = await put(`projects/${projectId}/${suffix}.html`, Buffer.from(html, "utf-8"), {
    access: "public",
    contentType: "text/html; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}

export async function uploadV2Css(
  projectId: string,
  css: string,
): Promise<string | null> {
  if (!css.trim()) return null;
  const blob = await put(`projects/${projectId}/styles.css`, Buffer.from(css, "utf-8"), {
    access: "public",
    contentType: "text/css; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}

export async function uploadV2Json(
  projectId: string,
  name: string,
  data: unknown,
): Promise<string> {
  const blob = await put(
    `projects/${projectId}/${name}.json`,
    Buffer.from(JSON.stringify(data, null, 2), "utf-8"),
    {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    },
  );
  return blob.url;
}
