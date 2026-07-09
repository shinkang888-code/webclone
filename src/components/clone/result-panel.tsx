"use client";

import { useState } from "react";
import type { CloneResult } from "@/types/clone";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}초`;
}

const SKIP_REASON_LABEL: Record<string, string> = {
  "too-large": "용량 초과(15MB)",
  "fetch-failed": "내려받기 실패",
  timeout: "응답 시간 초과",
  blocked: "차단됨",
};

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg px-3 py-2.5 text-center"
      style={{ background: "var(--scan-paper)", border: "1px solid var(--scan-line)" }}
    >
      <p className="font-mono text-lg font-semibold" style={{ color: "var(--scan-blue)" }}>
        {value}
      </p>
      <p className="text-[11px]" style={{ color: "var(--scan-ink-soft)" }}>
        {label}
      </p>
    </div>
  );
}

export function ResultPanel({ result }: { result: CloneResult }) {
  const [showSkipped, setShowSkipped] = useState(false);
  const images = result.downloadedAssets.filter(
    (asset) =>
      asset.kind === "image" ||
      /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(asset.localPath),
  );
  const others = result.downloadedAssets.filter((a) => !images.includes(a));

  return (
    <div className="space-y-4">
      <div
        className="flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium"
        style={{ background: "var(--scan-green-soft)", color: "var(--scan-green)" }}
        role="status"
      >
        <span aria-hidden>✓</span> 스캔이 끝났어요. 아래에서 결과를 확인하세요.
      </div>

      <div>
        <h2 className="truncate text-base font-bold" title={result.title}>
          {result.title}
        </h2>
        {result.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--scan-ink-soft)" }}>
            {result.description}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatBox label="내려받은 파일" value={`${result.downloadedAssets.length}개`} />
        <StatBox label="섹션 블록" value={`${result.structure.sections.length}개`} />
        <StatBox label="걸린 시간" value={formatDuration(result.durationMs)} />
      </div>

      {result.structure.sections.length > 0 ? (
        <div>
          <p className="scan-eyebrow">
            페이지 구조 · CSS {result.inlinedStylesheets}개 인라인
          </p>
          <ol className="mt-2 space-y-1">
            {result.structure.sections.map((section, i) => (
              <li
                key={`${section.role}-${i}`}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                style={{ background: "var(--scan-paper)", border: "1px solid var(--scan-line)" }}
              >
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase"
                  style={{ background: "var(--scan-blue-soft)", color: "var(--scan-blue)" }}
                >
                  {section.role}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs">{section.label}</span>
                <span className="shrink-0 font-mono text-[10px]" style={{ color: "var(--scan-ink-soft)" }}>
                  {section.imageCount > 0 ? `🖼${section.imageCount} ` : ""}
                  {section.linkCount > 0 ? `🔗${section.linkCount}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {result.structure.nav.length > 0 ? (
        <div>
          <p className="scan-eyebrow">메뉴 구조 {result.structure.nav.length}개</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.structure.nav.map((item, i) => (
              <span
                key={`${item.label}-${i}`}
                className="rounded-full px-2.5 py-1 text-xs"
                style={{ border: "1px solid var(--scan-line)", background: "#fff" }}
                title={item.children.length > 0 ? `하위 ${item.children.length}개` : undefined}
              >
                {item.label}
                {item.children.length > 0 ? (
                  <span style={{ color: "var(--scan-blue)" }}> ▾{item.children.length}</span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <a
          href={result.snapshotPath}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--scan-blue)" }}
        >
          페이지 스냅샷 열기
        </a>
        <a
          href={result.finalUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-80"
          style={{ border: "1.5px solid var(--scan-line)", color: "var(--scan-ink)" }}
        >
          원본 사이트 가기
        </a>
      </div>

      {images.length > 0 ? (
        <div>
          <p className="scan-eyebrow">모은 이미지 {images.length}개</p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {images.map((asset) => (
              <a
                key={asset.localPath}
                href={asset.localPath}
                target="_blank"
                rel="noreferrer"
                className="group relative block aspect-square overflow-hidden rounded-lg transition hover:opacity-85"
                style={{ border: "1px solid var(--scan-line)", background: "#fff" }}
                title={asset.sourceUrl}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.localPath}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-contain p-1"
                />
                <span
                  className="absolute inset-x-0 bottom-0 truncate px-1.5 py-0.5 font-mono text-[9px] text-white opacity-0 transition group-hover:opacity-100"
                  style={{ background: "rgba(23,27,38,0.75)" }}
                >
                  {formatBytes(asset.bytes)}
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs" style={{ color: "var(--scan-ink-soft)" }}>
          이 페이지에서는 내려받을 수 있는 이미지를 찾지 못했어요. 스냅샷에는 페이지 내용이 그대로 담겨 있어요.
        </p>
      )}

      {others.length > 0 ? (
        <div>
          <p className="scan-eyebrow">기타 파일 {others.length}개</p>
          <ul className="mt-2 space-y-1">
            {others.map((asset) => (
              <li key={asset.localPath} className="truncate font-mono text-xs">
                <a
                  href={asset.localPath}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                  style={{ color: "var(--scan-blue)" }}
                >
                  {asset.localPath.split("/").at(-1)}
                </a>{" "}
                <span style={{ color: "var(--scan-ink-soft)" }}>({formatBytes(asset.bytes)})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.skippedAssets.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowSkipped((v) => !v)}
            className="text-xs font-medium underline-offset-4 hover:underline"
            style={{ color: "var(--scan-ink-soft)" }}
          >
            건너뛴 파일 {result.skippedAssets.length}개 {showSkipped ? "숨기기" : "보기"}
          </button>
          {showSkipped ? (
            <ul className="mt-2 space-y-1">
              {result.skippedAssets.map((asset) => (
                <li key={asset.sourceUrl} className="truncate font-mono text-[11px]" style={{ color: "var(--scan-amber)" }}>
                  – {asset.sourceUrl}{" "}
                  <span className="font-sans">({SKIP_REASON_LABEL[asset.reason] ?? asset.reason})</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
