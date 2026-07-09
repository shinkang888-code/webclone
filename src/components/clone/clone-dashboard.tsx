"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FeatureGuide } from "@/components/clone/feature-guide";
import { HistoryPanel } from "@/components/clone/history-panel";
import { ResultPanel } from "@/components/clone/result-panel";
import {
  EMPTY_PROGRESS,
  ScanForm,
  ScanPipeline,
  type ScanProgressState,
} from "@/components/clone/scan-console";
import type {
  CloneHistoryResponse,
  CloneResult,
  CloneRunSummary,
  CloneStreamEvent,
} from "@/types/clone";

function LogoMark() {
  return (
    <svg viewBox="0 0 36 36" className="h-9 w-9" aria-hidden>
      <rect x="3" y="6" width="30" height="24" rx="4" fill="#fff" stroke="var(--scan-blue)" strokeWidth="2.5" />
      <line x1="3" y1="13" x2="33" y2="13" stroke="var(--scan-blue)" strokeWidth="2.5" />
      <line x1="8" y1="21" x2="28" y2="21" stroke="var(--scan-blue)" strokeWidth="2" strokeDasharray="2.5 3" />
      <circle cx="9" cy="9.5" r="1.4" fill="var(--scan-blue)" />
    </svg>
  );
}

export function CloneDashboard() {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgressState>(EMPTY_PROGRESS);
  const [result, setResult] = useState<CloneResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [runs, setRuns] = useState<CloneRunSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/clone/history", { cache: "no-store" });
      const data = (await response.json()) as CloneHistoryResponse;
      if (data.ok) setRuns(data.runs);
    } catch {
      // History is non-critical; keep whatever we have.
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const applyEvent = useCallback((event: CloneStreamEvent) => {
    switch (event.type) {
      case "phase":
        setProgress((prev) => ({
          ...prev,
          phase: event.phase,
          phaseLabel: event.label,
        }));
        break;
      case "meta":
        setProgress((prev) => ({
          ...prev,
          pageTitle: event.title,
          assetsTotal: event.totalAssets,
        }));
        break;
      case "asset":
        setProgress((prev) => ({
          ...prev,
          assetsDone: event.index,
          assetsTotal: event.total,
          log: [
            ...prev.log,
            {
              ok: event.ok,
              text: event.sourceUrl.replace(/^https?:\/\//, "").slice(0, 90),
            },
          ],
        }));
        break;
      case "done":
        setResult(event.result);
        break;
      case "error":
        setError(event.message);
        break;
    }
  }, []);

  const startScan = useCallback(
    async (url: string) => {
      setIsScanning(true);
      setError(null);
      setResult(null);
      setProgress({ ...EMPTY_PROGRESS, phase: "fetch", phaseLabel: "연결 중" });

      try {
        const response = await fetch("/api/clone", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!response.body) {
          throw new Error("서버 응답을 읽을 수 없어요. 잠시 후 다시 시도해 주세요.");
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
            try {
              applyEvent(JSON.parse(line) as CloneStreamEvent);
            } catch {
              // Ignore malformed lines rather than aborting the scan view.
            }
          }
        }
      } catch (scanError) {
        setError(
          scanError instanceof Error
            ? scanError.message
            : "네트워크 오류가 발생했어요. 연결 상태를 확인해 주세요.",
        );
      } finally {
        setIsScanning(false);
        void refreshHistory();
      }
    },
    [applyEvent, refreshHistory],
  );

  const showPipeline = isScanning || result !== null;

  return (
    <div className="scan-body min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <h1 className="text-xl font-bold tracking-tight md:text-2xl">웹 스캐너</h1>
              <p className="text-xs md:text-sm" style={{ color: "var(--scan-ink-soft)" }}>
                웹사이트 주소만 입력하면 페이지와 이미지를 내 컴퓨터에 안전하게 보관해 드려요.
              </p>
            </div>
          </div>
          <Link
            href="/v2"
            className="shrink-0 text-xs font-medium underline"
            style={{ color: "var(--scan-blue)" }}
          >
            v2 구조 클론 →
          </Link>
        </header>

        <div className="mt-6">
          <FeatureGuide />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
          <main className="scan-card space-y-5 p-5 md:p-6">
            <ScanForm onSubmit={startScan} isLoading={isScanning} />

            {showPipeline ? (
              <ScanPipeline progress={progress} finished={result !== null} />
            ) : null}

            {error ? (
              <div
                className="rounded-lg px-3.5 py-3 text-sm leading-relaxed"
                style={{ background: "var(--scan-amber-soft)", color: "var(--scan-amber)" }}
                role="alert"
              >
                <p className="font-semibold">스캔을 완료하지 못했어요</p>
                <p className="mt-0.5">{error}</p>
              </div>
            ) : null}

            {result ? <ResultPanel result={result} /> : null}

            {!showPipeline && !error ? (
              <div
                className="rounded-xl p-6 text-center"
                style={{ background: "var(--scan-paper)", border: "1px dashed var(--scan-line)" }}
              >
                <p className="text-sm font-medium">위 입력칸에 주소를 넣고 스캔을 시작해 보세요</p>
                <p className="mt-1 text-xs" style={{ color: "var(--scan-ink-soft)" }}>
                  진행 과정이 이 자리에 실시간으로 표시돼요.
                </p>
              </div>
            ) : null}
          </main>

          <HistoryPanel runs={runs} isLoading={historyLoading} />
        </div>

        <footer className="mt-8 text-center font-mono text-[11px]" style={{ color: "var(--scan-ink-soft)" }}>
          스캔 결과는 Vercel Blob·Neon Postgres에 안전하게 보관돼요 — 본인 소유이거나 이용이 허락된 사이트만 스캔하세요.
        </footer>
      </div>
    </div>
  );
}
