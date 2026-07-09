"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GrapesEditor } from "@/components/v2/grapes-editor";
import { ImagePanel } from "@/components/v2/image-panel";
import { PhaseStepper } from "@/components/v2/phase-stepper";
import { PublishPanel } from "@/components/v2/publish-panel";
import { RebrandPanel } from "@/components/v2/rebrand-panel";
import { StructureViewer } from "@/components/v2/structure-viewer";
import type { ProjectDetail, ProjectPhase } from "@/types/project";

function resolvePhase(project: ProjectDetail): ProjectPhase {
  if (project.status === "published") return "publish";
  if (project.latestEdit) return "publish";
  if (project.imagesReplaced || project.assets.some((a) => a.isGenerated)) return "edit";
  if (project.brandNew) return "images";
  if (project.capture) return "rebrand";
  return "capture";
}

interface Props {
  projectId: string;
}

export function ProjectWorkspace({ projectId }: Props) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [phase, setPhase] = useState<ProjectPhase>("capture");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/projects/${projectId}`, { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; project?: ProjectDetail; error?: string };
      if (!data.ok || !data.project) throw new Error(data.error);
      setProject(data.project);
      setPhase(resolvePhase(data.project));
    } catch (err) {
      setError(err instanceof Error ? err.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <p className="p-8 text-sm text-neutral-500">프로젝트 로딩 중…</p>;
  if (error || !project) {
    return <p className="p-8 text-sm text-red-600">{error ?? "프로젝트 없음"}</p>;
  }

  const tabs: { key: ProjectPhase; label: string }[] = [
    { key: "capture", label: "구조" },
    { key: "rebrand", label: "리브랜딩" },
    { key: "images", label: "이미지" },
    { key: "edit", label: "편집" },
    { key: "publish", label: "발행" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/v2" className="text-xs text-neutral-500 underline">
            ← 프로젝트 목록
          </Link>
          <h1 className="mt-1 text-xl font-bold">{project.sourceUrl}</h1>
          <p className="text-xs text-neutral-500">
            {project.id} · {project.status}
          </p>
        </div>
      </header>

      <PhaseStepper current={phase} />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPhase(tab.key)}
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: phase === tab.key ? "var(--scan-blue)" : "#f5f5f5",
              color: phase === tab.key ? "#fff" : "var(--scan-blue)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="rounded-lg border p-5" style={{ borderColor: "var(--scan-line)" }}>
        {phase === "capture" && project.capture && (
          <StructureViewer result={project.capture} />
        )}
        {phase === "rebrand" && (
          <RebrandPanel projectId={projectId} onComplete={refresh} />
        )}
        {phase === "images" && (
          <ImagePanel project={project} onComplete={refresh} />
        )}
        {phase === "edit" && (
          <GrapesEditor projectId={projectId} onSaved={refresh} />
        )}
        {phase === "publish" && (
          <PublishPanel project={project} onPublished={refresh} />
        )}
      </section>
    </div>
  );
}
