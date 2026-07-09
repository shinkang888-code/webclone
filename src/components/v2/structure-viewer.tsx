"use client";

import type { CaptureResult, SectionNode } from "@/types/project";

const ROLE_LABELS: Record<string, string> = {
  header: "헤더",
  nav: "내비",
  hero: "히어로",
  section: "섹션",
  cta: "CTA",
  footer: "푸터",
  main: "메인",
  unknown: "기타",
};

function SectionCard({ section }: { section: SectionNode }) {
  return (
    <article
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--scan-line)", background: "#fff" }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="rounded px-2 py-0.5 text-xs font-semibold"
          style={{ background: "var(--scan-blue-soft)", color: "var(--scan-blue)" }}
        >
          {ROLE_LABELS[section.role] ?? section.role}
        </span>
        <span className="text-xs text-neutral-500">&lt;{section.tag}&gt;</span>
        <span className="ml-auto text-xs text-neutral-400">{section.id}</span>
      </div>
      <h3 className="mb-1 text-sm font-semibold">{section.label}</h3>
      <p className="mb-3 line-clamp-2 text-sm text-neutral-600">{section.textPreview}</p>
      {section.imageSlots.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {section.imageSlots.map((slot) => (
            <span
              key={slot.key}
              className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
            >
              {slot.role}: {slot.alt ?? "이미지"}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export function StructureViewer({ result }: { result: CaptureResult }) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: "var(--scan-line)", background: "var(--scan-blue-soft)" }}
      >
        <h2 className="mb-2 text-base font-bold">구조 클론 결과</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-neutral-500">렌더 모드</dt>
            <dd className="font-medium">
              {result.renderMode === "playwright" ? "Playwright" : "Fetch 폴백"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">섹션 수</dt>
            <dd className="font-medium">{result.structure.totalBlocks}개</dd>
          </div>
          <div>
            <dt className="text-neutral-500">메뉴 항목</dt>
            <dd className="font-medium">{result.navmap.items.length}개</dd>
          </div>
          <div>
            <dt className="text-neutral-500">에셋</dt>
            <dd className="font-medium">{result.assetCount}개</dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={result.htmlBlobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded px-3 py-1.5 text-sm font-medium text-white"
            style={{ background: "var(--scan-blue)" }}
          >
            HTML 스냅샷 열기
          </a>
          {result.cssBlobUrl && (
            <a
              href={result.cssBlobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border px-3 py-1.5 text-sm"
              style={{ borderColor: "var(--scan-line)" }}
            >
              CSS 보기
            </a>
          )}
        </div>
      </div>

      {result.navmap.items.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">메뉴 구조</h3>
          <ul className="flex flex-wrap gap-2">
            {result.navmap.items.map((item) => (
              <li
                key={`${item.label}-${item.href}`}
                className="rounded-full border px-3 py-1 text-xs"
                style={{ borderColor: "var(--scan-line)" }}
              >
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold">섹션 트리</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {result.structure.sections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}
