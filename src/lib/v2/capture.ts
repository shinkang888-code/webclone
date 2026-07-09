import { extractSiteData } from "@/lib/clone/extract";
import {
  assertStorageConfigured,
  MAX_ASSETS,
  saveCloneArtifacts,
} from "@/lib/clone/artifacts";
import { inlineStylesheets } from "@/lib/v2/css";
import { uploadV2Css, uploadV2Html } from "@/lib/v2/blob";
import {
  insertCapture,
  insertProject,
  makeCaptureId,
  makeProjectId,
  updateProjectStatus,
} from "@/lib/v2/db";
import { extractNavMap } from "@/lib/v2/nav";
import { renderPage } from "@/lib/v2/render-client";
import { sanitizeHtml } from "@/lib/v2/sanitize";
import { decomposeSections } from "@/lib/v2/section";
import type { CaptureResult, CaptureStreamEvent } from "@/types/project";

type SendFn = (event: CaptureStreamEvent) => void;

export async function runCapturePipeline(
  rawUrl: string,
  send: SendFn,
  startedAt: number,
): Promise<CaptureResult> {
  assertStorageConfigured();

  const projectId = makeProjectId(rawUrl);
  const captureId = makeCaptureId(projectId);

  send({ type: "phase", phase: "render", label: "페이지 렌더링 중" });
  const rendered = await renderPage(rawUrl);

  await insertProject({
    id: projectId,
    sourceUrl: rawUrl,
    title: rendered.title,
    status: "capturing",
  });

  send({ type: "phase", phase: "sanitize", label: "스크립트·트래커 제거 중" });
  const sanitized = sanitizeHtml(rendered.html);

  send({ type: "phase", phase: "css", label: "CSS 인라인화 중" });
  const cssResult = await inlineStylesheets(sanitized, rendered.finalUrl);

  send({ type: "phase", phase: "structure", label: "섹션·메뉴 구조 분석 중" });
  const structure = decomposeSections(cssResult.html);
  const navmap = extractNavMap(cssResult.html);

  send({
    type: "meta",
    title: rendered.title,
    sectionCount: structure.totalBlocks,
    renderMode: rendered.mode,
  });

  send({ type: "phase", phase: "assets", label: "이미지·파일 재호스팅 중" });

  const extracted = extractSiteData(cssResult.html, rawUrl, rendered.finalUrl);
  const assetResult = await saveCloneArtifacts(
    rawUrl,
    extracted,
    (progress) =>
      send({
        type: "asset",
        index: progress.index,
        total: progress.total,
        ok: progress.ok,
        sourceUrl: progress.sourceUrl,
        blobUrl: progress.localPath,
      }),
    startedAt,
  );

  send({ type: "phase", phase: "save", label: "프로젝트 저장 중" });

  const htmlBlobUrl = await uploadV2Html(projectId, cssResult.html);
  const cssBlobUrl = await uploadV2Css(projectId, cssResult.css);

  const createdAt = new Date().toISOString();
  const result: CaptureResult = {
    projectId,
    captureId,
    sourceUrl: rawUrl,
    finalUrl: rendered.finalUrl,
    title: rendered.title,
    htmlBlobUrl,
    cssBlobUrl,
    structure,
    navmap,
    assetCount: Math.min(extracted.assets.length, MAX_ASSETS),
    durationMs: Date.now() - startedAt,
    renderMode: rendered.mode,
    createdAt,
  };

  await insertCapture({
    id: captureId,
    projectId,
    htmlBlobUrl,
    cssBlobUrl,
    structure,
    navmap,
    renderMode: rendered.mode,
    assetCount: assetResult.downloadedAssets.length,
    durationMs: result.durationMs,
  });

  await updateProjectStatus(projectId, "captured");

  return result;
}
