"use client";

import { useState } from "react";
import type { ImageSlot, ProjectDetail } from "@/types/project";

interface Props {
  project: ProjectDetail;
  onComplete: () => void;
}

export function ImagePanel({ project, onComplete }: Props) {
  const slots =
    project.capture?.structure.sections.flatMap((s) => s.imageSlots) ?? [];
  const [processing, setProcessing] = useState<string | null>(null);
  const [batching, setBatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (slot: ImageSlot, action: "generate" | "keep") => {
    setProcessing(slot.key);
    setError(null);
    try {
      const res = await fetch(`/api/v2/projects/${project.id}/images`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotKey: slot.key, action }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 처리 실패");
    } finally {
      setProcessing(null);
    }
  };

  const handleBatch = async () => {
    setBatching(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/projects/${project.id}/images`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batch: true }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        processed?: number;
        skipped?: number;
      };
      if (!data.ok) throw new Error(data.error);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "일괄 생성 실패");
    } finally {
      setBatching(false);
    }
  };

  if (!project.brandNew) {
    return (
      <p className="text-sm text-neutral-500">먼저 리브랜딩 단계를 완료해 주세요.</p>
    );
  }

  if (slots.length === 0) {
    return <p className="text-sm text-neutral-500">교체할 이미지 슬롯이 없어요.</p>;
  }

  const assetMap = new Map(project.assets.map((a) => [a.slotKey, a]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">
          {slots.length}개 슬롯 · AI 생성 또는 원본 유지 선택
        </p>
        <button
          onClick={handleBatch}
          disabled={batching}
          className="rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--scan-blue)" }}
        >
          {batching ? "생성 중…" : "전체 AI 생성"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {slots.map((slot) => {
          const asset = assetMap.get(slot.key);
          return (
            <div
              key={slot.key}
              className="rounded-lg border p-3"
              style={{ borderColor: "var(--scan-line)" }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="rounded px-2 py-0.5 text-xs font-medium"
                  style={{ background: "var(--scan-blue-soft)", color: "var(--scan-blue)" }}
                >
                  {slot.role}
                </span>
                {asset?.isGenerated && (
                  <span className="text-xs text-green-600">AI 생성됨</span>
                )}
              </div>
              {asset?.blobUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.blobUrl}
                  alt={slot.alt ?? slot.key}
                  className="mb-2 h-24 w-full rounded object-cover"
                />
              )}
              <p className="mb-2 truncate text-xs text-neutral-500">
                {slot.alt ?? slot.src}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(slot, "generate")}
                  disabled={processing === slot.key}
                  className="rounded px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: "var(--scan-blue)" }}
                >
                  AI 생성
                </button>
                <button
                  onClick={() => handleAction(slot, "keep")}
                  disabled={processing === slot.key}
                  className="rounded border px-3 py-1 text-xs"
                  style={{ borderColor: "var(--scan-line)" }}
                >
                  원본 유지
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
