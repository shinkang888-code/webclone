"use client";

import { FormEvent, useState } from "react";
import type { ClonePhase } from "@/types/clone";

export interface ScanProgressState {
  phase: ClonePhase | null;
  phaseLabel: string;
  pageTitle: string | null;
  assetsDone: number;
  assetsTotal: number;
  log: { ok: boolean; text: string }[];
}

export const EMPTY_PROGRESS: ScanProgressState = {
  phase: null,
  phaseLabel: "",
  pageTitle: null,
  assetsDone: 0,
  assetsTotal: 0,
  log: [],
};

const PIPELINE: { key: ClonePhase; label: string }[] = [
  { key: "fetch", label: "페이지 가져오기" },
  { key: "parse", label: "내용 분석" },
  { key: "assets", label: "이미지 내려받기" },
  { key: "save", label: "저장 완료" },
];

const PHASE_ORDER: Record<ClonePhase, number> = {
  fetch: 0,
  parse: 1,
  assets: 2,
  save: 3,
};

function PipelineNode({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "pending";
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
          state === "active" ? "scan-pulse" : ""
        }`}
        style={{
          borderColor:
            state === "pending" ? "var(--scan-line)" : "var(--scan-blue)",
          background:
            state === "done"
              ? "var(--scan-blue)"
              : state === "active"
                ? "var(--scan-blue-soft)"
                : "#fff",
          color: state === "done" ? "#fff" : "var(--scan-blue)",
        }}
        aria-hidden
      >
        {state === "done" ? "✓" : "●"}
      </span>
      <span
        className="text-center text-[11px] font-medium leading-tight"
        style={{
          color: state === "pending" ? "var(--scan-ink-soft)" : "var(--scan-ink)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function ScanPipeline({
  progress,
  finished,
}: {
  progress: ScanProgressState;
  finished: boolean;
}) {
  const activeIndex = progress.phase ? PHASE_ORDER[progress.phase] : -1;
  const percent =
    progress.assetsTotal > 0
      ? Math.round((progress.assetsDone / progress.assetsTotal) * 100)
      : 0;

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--scan-paper)", border: "1px solid var(--scan-line)" }}
    >
      <div className="flex items-start">
        {PIPELINE.map((step, i) => {
          const state: "done" | "active" | "pending" = finished
            ? "done"
            : i < activeIndex
              ? "done"
              : i === activeIndex
                ? "active"
                : "pending";
          return (
            <div key={step.key} className="flex flex-1 items-center">
              {i > 0 ? (
                <div
                  className="mx-1 mb-5 h-0.5 flex-1"
                  style={{
                    background:
                      i <= activeIndex || finished
                        ? "var(--scan-blue)"
                        : "var(--scan-line)",
                  }}
                  aria-hidden
                />
              ) : null}
              <PipelineNode label={step.label} state={state} />
            </div>
          );
        })}
      </div>

      {progress.pageTitle ? (
        <p className="mt-3 truncate text-sm font-medium" title={progress.pageTitle}>
          「{progress.pageTitle}」
        </p>
      ) : null}

      {progress.assetsTotal > 0 ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs" style={{ color: "var(--scan-ink-soft)" }}>
            <span>이미지·파일 내려받기</span>
            <span className="font-mono">
              {progress.assetsDone}/{progress.assetsTotal}
            </span>
          </div>
          <div
            className={`relative mt-1.5 h-2 overflow-hidden rounded-full ${!finished ? "scan-sweep" : ""}`}
            style={{ background: "var(--scan-line)" }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${percent}%`, background: "var(--scan-blue)" }}
            />
          </div>
        </div>
      ) : null}

      {progress.log.length > 0 ? (
        <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto font-mono text-[11px]">
          {progress.log.slice(-8).map((entry, i) => (
            <li
              key={`${entry.text}-${i}`}
              className="truncate"
              style={{ color: entry.ok ? "var(--scan-green)" : "var(--scan-amber)" }}
            >
              {entry.ok ? "✓" : "–"} {entry.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ScanForm({
  onSubmit,
  isLoading,
}: {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}) {
  const [url, setUrl] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!url.trim() || isLoading) return;
    onSubmit(url.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="scan-url" className="block text-sm font-semibold">
        어떤 사이트를 보관할까요?
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="scan-url"
          type="text"
          inputMode="url"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="예: www.apple.com"
          className="w-full rounded-lg px-3.5 py-2.5 font-mono text-sm outline-none transition focus-visible:ring-2"
          style={{
            border: "1.5px solid var(--scan-line)",
            background: "#fff",
          }}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="shrink-0 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--scan-blue)" }}
        >
          {isLoading ? "스캔 중…" : "스캔 시작"}
        </button>
      </div>
      <p className="text-xs" style={{ color: "var(--scan-ink-soft)" }}>
        https:// 는 붙이지 않아도 돼요. 공개된 웹페이지만 스캔할 수 있어요.
      </p>
    </form>
  );
}
