import { put } from "@vercel/blob";
import { fetchTextFromUrl } from "@/lib/v2/html";
import {
  getProjectById,
  getWorkingHtmlUrl,
  insertPublishedSite,
  updateProjectStatus,
} from "@/lib/v2/db";
import type { PublishRequest } from "@/types/project";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "site";
}

export interface PublishGateResult {
  ok: boolean;
  errors: string[];
}

export function checkPublishGate(project: NonNullable<Awaited<ReturnType<typeof getProjectById>>>): PublishGateResult {
  const errors: string[] = [];
  if (!project.brandNew) {
    errors.push("브랜드명 교체가 필요해요.");
  }
  if (!project.brandOriginal || project.brandOriginal === project.brandNew) {
    errors.push("원본 브랜드와 새 브랜드가 구분되어야 해요.");
  }
  if (!project.imagesReplaced && !project.assets.some((a) => a.isGenerated)) {
    errors.push("최소 1개 이상의 이미지를 AI 생성 또는 업로드로 교체해야 해요.");
  }
  return { ok: errors.length === 0, errors };
}

function buildSelfContainedHtml(html: string, css: string | null): string {
  if (!css) return html;
  if (html.includes("data-v2-inlined")) return html;
  const styleTag = `<style>\n${css}\n</style>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${styleTag}\n</head>`);
  }
  return `${styleTag}\n${html}`;
}

export async function publishProject(
  projectId: string,
  input: PublishRequest,
): Promise<{ url: string; slug: string; publishId: string }> {
  const project = await getProjectById(projectId);
  if (!project) throw new Error("프로젝트를 찾을 수 없어요.");

  const gate = checkPublishGate(project);
  if (!gate.ok) {
    throw new Error(gate.errors.join(" "));
  }

  const htmlUrl = await getWorkingHtmlUrl(projectId);
  if (!htmlUrl) throw new Error("발행할 HTML이 없어요.");

  let html = await fetchTextFromUrl(htmlUrl);
  let css: string | null = null;
  if (project.capture?.cssBlobUrl) {
    css = await fetchTextFromUrl(project.capture.cssBlobUrl);
  }
  html = buildSelfContainedHtml(html, css);

  const slug = input.slug?.trim() || slugify(project.brandNew ?? project.id);
  const publishId = `pub-${projectId}-${Date.now()}`;

  const blob = await put(`published/${slug}/index.html`, Buffer.from(html, "utf-8"), {
    access: "public",
    contentType: "text/html; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  const target = input.target ?? "blob";
  let finalUrl = blob.url;

  if (target === "vercel") {
    const vercelUrl = await tryVercelDeploy(slug, html);
    if (vercelUrl) finalUrl = vercelUrl;
  }

  await insertPublishedSite({
    id: publishId,
    projectId,
    editVersion: project.latestEdit?.version ?? 0,
    target,
    url: finalUrl,
    slug,
  });

  await updateProjectStatus(projectId, "published");

  return { url: finalUrl, slug, publishId };
}

async function tryVercelDeploy(slug: string, html: string): Promise<string | null> {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  const projectName = process.env.VERCEL_PROJECT_NAME;

  if (!token || !projectName) return null;

  try {
    const params = teamId ? `?teamId=${teamId}` : "";
    const response = await fetch(
      `https://api.vercel.com/v13/deployments${params}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: projectName,
          files: [
            {
              file: "index.html",
              data: Buffer.from(html, "utf-8").toString("base64"),
              encoding: "base64",
            },
          ],
          projectSettings: { framework: null },
          target: "production",
          alias: [`${slug}.vercel.app`],
        }),
      },
    );

    if (!response.ok) return null;
    const data = (await response.json()) as { url?: string };
    return data.url ? `https://${data.url}` : null;
  } catch {
    return null;
  }
}
