"use client";

import type { CloneRunSummary } from "@/types/clone";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export function HistoryPanel({
  runs,
  isLoading,
}: {
  runs: CloneRunSummary[];
  isLoading: boolean;
}) {
  return (
    <aside className="scan-card p-4" aria-label="스캔 기록">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold">스캔 기록</h2>
        <span className="font-mono text-[11px]" style={{ color: "var(--scan-ink-soft)" }}>
          {runs.length}건
        </span>
      </div>

      {isLoading ? (
        <p className="mt-3 text-xs" style={{ color: "var(--scan-ink-soft)" }}>
          기록을 불러오는 중…
        </p>
      ) : runs.length === 0 ? (
        <div
          className="mt-3 rounded-lg p-4 text-center"
          style={{ background: "var(--scan-paper)", border: "1px dashed var(--scan-line)" }}
        >
          <p className="text-xs leading-relaxed" style={{ color: "var(--scan-ink-soft)" }}>
            아직 스캔한 사이트가 없어요.
            <br />
            첫 스캔을 시작하면 여기에 쌓여요.
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {runs.map((run) => (
            <li key={run.runId}>
              <a
                href={run.snapshotPath}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-lg p-2 transition hover:opacity-80"
                style={{ border: "1px solid var(--scan-line)", background: "#fff" }}
                title={`${run.title} 스냅샷 열기`}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md"
                  style={{ background: "var(--scan-blue-soft)" }}
                >
                  {run.thumbnailPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={run.thumbnailPath}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold" style={{ color: "var(--scan-blue)" }}>
                      {run.title.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{run.title}</span>
                  <span className="block truncate font-mono text-[10px]" style={{ color: "var(--scan-ink-soft)" }}>
                    {run.sourceUrl.replace(/^https?:\/\//, "")}
                  </span>
                </span>
                <span className="shrink-0 text-[10px]" style={{ color: "var(--scan-ink-soft)" }}>
                  {relativeTime(run.createdAt)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
