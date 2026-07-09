"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { StructureViewer } from "@/components/v2/structure-viewer";
import type {
  CaptureResult,
  CaptureStreamEvent,
  ProjectSummary,
} from "@/types/project";

const PIPELINE = [
  { key: "render", label: "렌더링" },
  { key: "sanitize", label: "정리" },
  { key: "css", label: "CSS" },
  { key: "structure", label: "구조 분석" },
  { key: "assets", label: "에셋" },
  { key: "save", label: "저장" },
] as const;

export function CaptureDashboard() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [phaseLabel, setPhaseLabel] = useState("");
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/v2/projects", { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; projects: ProjectSummary[] };
      if (data.ok) setProjects(data.projects);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !agreed) return;

    setIsCapturing(true);
    setError(null);
    setResult(null);
    setPhase(null);
    setPhaseLabel("");

    try {
      const response = await fetch("/api/v2/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok || !response.body) {
        throw new Error("캡처 요청에 실패했어요.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as CaptureStreamEvent;
          if (event.type === "phase") {
            setPhase(event.phase);
            setPhaseLabel(event.label);
          } else if (event.type === "done") {
            setResult(event.result);
            void refreshProjects();
            router.push(`/v2/projects/${event.result.projectId}`);
          } else if (event.type === "error") {
            setError(event.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setIsCapturing(false);
    }
  };

  const phaseIndex = PIPELINE.findIndex((p) => p.key === phase);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            웹클론 v2 · Phase A
          </p>
          <h1 className="text-2xl font-bold">구조 클론</h1>
          <p className="mt-1 text-sm text-neutral-600">
            사이트 UI 구조를 렌더링·분해해 편집 가능한 템플릿으로 가져옵니다.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-neutral-500 underline hover:text-neutral-800"
        >
          v1 스캐너
        </Link>
      </header>

      <form onSubmit={handleSubmit} className="mb-6 space-y-3">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 rounded-lg border px-4 py-2.5 text-sm"
            style={{ borderColor: "var(--scan-line)" }}
            disabled={isCapturing}
            required
          />
          <button
            type="submit"
            disabled={isCapturing || !agreed}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--scan-blue)" }}
          >
            {isCapturing ? "캡처 중…" : "구조 클론"}
          </button>
        </div>

        <label className="flex items-start gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            본인 소유이거나 이용 허락을 받은 사이트만 클론합니다. 타사 UI·브랜드를
            그대로 재발행하지 않겠습니다.
          </span>
        </label>
      </form>

      {isCapturing && (
        <div className="mb-6 flex flex-wrap gap-2">
          {PIPELINE.map((step, i) => {
            const state =
              phaseIndex < 0
                ? "pending"
                : i < phaseIndex
                  ? "done"
                  : i === phaseIndex
                    ? "active"
                    : "pending";
            return (
              <span
                key={step.key}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background:
                    state === "done"
                      ? "var(--scan-blue)"
                      : state === "active"
                        ? "var(--scan-blue-soft)"
                        : "#f5f5f5",
                  color: state === "done" ? "#fff" : "var(--scan-blue)",
                }}
              >
                {step.label}
                {state === "active" && phaseLabel ? ` · ${phaseLabel}` : ""}
              </span>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && <StructureViewer result={result} />}

      {projects.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold">최근 프로젝트</h2>
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/v2/projects/${p.id}`}
                  className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm hover:bg-neutral-50"
                  style={{ borderColor: "var(--scan-line)" }}
                >
                  <div>
                    <p className="font-medium">{p.sourceUrl}</p>
                    <p className="text-xs text-neutral-500">
                      {p.sectionCount}개 섹션 · {p.status}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-400">
                    {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
