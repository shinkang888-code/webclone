"use client";

import { useState } from "react";
import type { ProjectDetail, PublishedSite } from "@/types/project";

interface Props {
  project: ProjectDetail;
  onPublished: () => void;
}

export function PublishPanel({ project, onPublished }: Props) {
  const [slug, setSlug] = useState(
    (project.brandNew ?? "site").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30),
  );
  const [target, setTarget] = useState<"blob" | "vercel">("blob");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(
    project.latestPublish?.url ?? null,
  );

  const gateErrors: string[] = [];
  if (!project.brandNew) gateErrors.push("브랜드명 교체 필요");
  if (!project.imagesReplaced && !project.assets.some((a) => a.isGenerated)) {
    gateErrors.push("이미지 1개 이상 교체 필요");
  }

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/projects/${project.id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, target }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; url?: string };
      if (!data.ok) throw new Error(data.error);
      setPublishedUrl(data.url ?? null);
      onPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : "발행 실패");
    } finally {
      setPublishing(false);
    }
  };

  const handleRollback = async (site: PublishedSite) => {
    try {
      const res = await fetch(`/api/v2/projects/${project.id}/rollback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publishId: site.id }),
      });
      const data = (await res.json()) as { ok: boolean; site?: PublishedSite; error?: string };
      if (!data.ok) throw new Error(data.error);
      setPublishedUrl(data.site?.url ?? null);
      onPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : "롤백 실패");
    }
  };

  return (
    <div className="space-y-4">
      {gateErrors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          발행 전 필수: {gateErrors.join(" · ")}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">서브도메인 슬러그</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            style={{ borderColor: "var(--scan-line)" }}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">발행 대상</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as "blob" | "vercel")}
            className="w-full rounded-lg border px-3 py-2"
            style={{ borderColor: "var(--scan-line)" }}
          >
            <option value="blob">Blob 정적 호스팅</option>
            <option value="vercel">Vercel 배포 (VERCEL_TOKEN 필요)</option>
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {publishedUrl && (
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: "var(--scan-line)", background: "var(--scan-blue-soft)" }}
        >
          <p className="text-sm font-semibold">발행 완료</p>
          <a
            href={publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-sm underline"
            style={{ color: "var(--scan-blue)" }}
          >
            {publishedUrl}
          </a>
        </div>
      )}

      <button
        onClick={handlePublish}
        disabled={publishing || gateErrors.length > 0}
        className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--scan-blue)" }}
      >
        {publishing ? "발행 중…" : "사이트 발행"}
      </button>

      {project.publishHistory.length > 1 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">발행 이력 · 롤백</h3>
          <ul className="space-y-2">
            {project.publishHistory.map((site) => (
              <li
                key={site.id}
                className="flex items-center justify-between rounded border px-3 py-2 text-xs"
                style={{ borderColor: "var(--scan-line)" }}
              >
                <span>
                  {new Date(site.publishedAt).toLocaleString("ko-KR")} · {site.target}
                </span>
                <button
                  onClick={() => handleRollback(site)}
                  className="underline"
                  style={{ color: "var(--scan-blue)" }}
                >
                  이 버전으로 롤백
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
