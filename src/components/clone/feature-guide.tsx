"use client";

import { useState } from "react";

/**
 * Beginner-facing guide: each capability of the scanner gets a
 * blueprint-style illustration plus plain-language copy, and the
 * top strip walks through the 3 steps of a scan.
 */

const STROKE = "var(--scan-blue)";
const SOFT = "var(--scan-blue-soft)";
const INK = "var(--scan-ink-soft)";

function IllustrationScan() {
  return (
    <svg viewBox="0 0 120 88" fill="none" aria-hidden className="h-20 w-full">
      <rect x="14" y="12" width="92" height="64" rx="6" fill="#fff" stroke={STROKE} strokeWidth="2" />
      <rect x="14" y="12" width="92" height="14" rx="6" fill={SOFT} stroke={STROKE} strokeWidth="2" />
      <circle cx="23" cy="19" r="2" fill={STROKE} />
      <circle cx="30" cy="19" r="2" fill={STROKE} opacity="0.5" />
      <rect x="38" y="16" width="52" height="6" rx="3" fill="#fff" stroke={STROKE} strokeWidth="1.5" />
      <line x1="20" y1="44" x2="100" y2="44" stroke={STROKE} strokeWidth="2" strokeDasharray="3 4" />
      <rect x="22" y="34" width="34" height="6" rx="2" fill={SOFT} />
      <rect x="22" y="52" width="50" height="5" rx="2" fill={SOFT} />
      <rect x="22" y="62" width="40" height="5" rx="2" fill={SOFT} />
      <circle cx="88" cy="58" r="12" fill="#fff" stroke={STROKE} strokeWidth="2" />
      <line x1="96" y1="66" x2="104" y2="74" stroke={STROKE} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function IllustrationAssets() {
  return (
    <svg viewBox="0 0 120 88" fill="none" aria-hidden className="h-20 w-full">
      <rect x="12" y="14" width="34" height="26" rx="4" fill="#fff" stroke={STROKE} strokeWidth="2" />
      <circle cx="21" cy="23" r="3" fill={SOFT} stroke={STROKE} strokeWidth="1.5" />
      <path d="M14 36l9-8 7 6 6-4 8 8" stroke={STROKE} strokeWidth="1.5" fill="none" />
      <rect x="52" y="10" width="34" height="26" rx="4" fill="#fff" stroke={STROKE} strokeWidth="2" />
      <path d="M63 18v10l9-5-9-5z" fill={SOFT} stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M40 46v8M69 42v12" stroke={STROKE} strokeWidth="1.5" strokeDasharray="2 3" />
      <path d="M40 54l-3-4M40 54l3-4M69 54l-3-4M69 54l3-4" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M22 60h76v18a4 4 0 01-4 4H26a4 4 0 01-4-4V60z" fill={SOFT} stroke={STROKE} strokeWidth="2" />
      <path d="M22 60l6-8h20l4 5h42l4 3" fill="none" stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function IllustrationSnapshot() {
  return (
    <svg viewBox="0 0 120 88" fill="none" aria-hidden className="h-20 w-full">
      <path d="M34 10h36l16 16v50H34V10z" fill="#fff" stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
      <path d="M70 10v16h16" fill={SOFT} stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
      <rect x="42" y="36" width="36" height="5" rx="2" fill={SOFT} />
      <rect x="42" y="46" width="28" height="5" rx="2" fill={SOFT} />
      <rect x="42" y="56" width="32" height="5" rx="2" fill={SOFT} />
      <circle cx="88" cy="62" r="15" fill="#fff" stroke={STROKE} strokeWidth="2" />
      <path d="M88 54v8l6 4" stroke={STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 30v28M14 34h8M14 54h8" stroke={INK} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function IllustrationHistory() {
  return (
    <svg viewBox="0 0 120 88" fill="none" aria-hidden className="h-20 w-full">
      {[16, 40, 64].map((y) => (
        <g key={y}>
          <rect x="16" y={y} width="88" height="18" rx="4" fill="#fff" stroke={STROKE} strokeWidth="2" />
          <rect x="21" y={y + 4} width="12" height="10" rx="2" fill={SOFT} stroke={STROKE} strokeWidth="1.5" />
          <rect x="39" y={y + 6} width="38" height="5" rx="2" fill={SOFT} />
          <circle cx="94" cy={y + 9} r="4" fill="none" stroke={STROKE} strokeWidth="1.5" />
          <path d={`M94 ${y + 6.5}v2.5l2 1.4`} stroke={STROKE} strokeWidth="1.3" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

const FEATURES = [
  {
    title: "주소만 넣으면 스캔 시작",
    body: "복잡한 설정 없이 웹사이트 주소 하나로 페이지 전체를 읽어 와요. 제목·설명 같은 기본 정보도 자동으로 정리돼요.",
    art: <IllustrationScan />,
  },
  {
    title: "이미지·영상 자동 수집",
    body: "페이지 안의 사진, 아이콘, 영상을 찾아 최대 40개까지 내려받아요. 숨어 있는 지연 로딩 이미지까지 챙겨요.",
    art: <IllustrationAssets />,
  },
  {
    title: "페이지 원본 스냅샷 보관",
    body: "스캔한 순간의 HTML 원본을 그대로 저장해요. 나중에 사이트가 바뀌어도 '스냅샷 열기'로 당시 모습을 확인할 수 있어요.",
    art: <IllustrationSnapshot />,
  },
  {
    title: "스캔 기록 한눈에",
    body: "지금까지 스캔한 사이트가 오른쪽 기록에 쌓여요. 썸네일로 알아보기 쉽고, 클릭 한 번으로 예전 결과를 다시 열어요.",
    art: <IllustrationHistory />,
  },
];

const STEPS = [
  { no: "1", title: "주소 붙여넣기", body: "스캔하고 싶은 사이트 주소를 입력칸에 붙여넣어요." },
  { no: "2", title: "스캔 시작 누르기", body: "진행 과정이 단계별로 실시간 표시돼요. 기다리기만 하면 끝." },
  { no: "3", title: "결과 확인", body: "모은 이미지와 페이지 스냅샷을 바로 열어 볼 수 있어요." },
];

export function FeatureGuide() {
  const [open, setOpen] = useState(true);

  return (
    <section aria-label="사용 안내">
      <div className="flex items-center justify-between">
        <p className="scan-eyebrow">처음이신가요?</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-medium underline-offset-4 hover:underline"
          style={{ color: "var(--scan-ink-soft)" }}
        >
          {open ? "안내 접기" : "안내 펼치기"}
        </button>
      </div>

      {open ? (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.no} className="scan-card flex items-start gap-3 p-4">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: "var(--scan-blue)" }}
                >
                  {step.no}
                </span>
                <div>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--scan-ink-soft)" }}>
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="scan-card p-4">
                <div
                  className="rounded-lg p-2"
                  style={{ background: "var(--scan-paper)", border: "1px dashed var(--scan-line)" }}
                >
                  {feature.art}
                </div>
                <h3 className="mt-3 text-sm font-semibold">{feature.title}</h3>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--scan-ink-soft)" }}>
                  {feature.body}
                </p>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
