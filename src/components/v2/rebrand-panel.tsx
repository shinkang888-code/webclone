"use client";

import { useCallback, useEffect, useState } from "react";
import type { BrandConcept, BrandDetection } from "@/types/project";

interface Props {
  projectId: string;
  onComplete: () => void;
}

export function RebrandPanel({ projectId, onComplete }: Props) {
  const [detection, setDetection] = useState<BrandDetection | null>(null);
  const [brandOriginal, setBrandOriginal] = useState("");
  const [brandNew, setBrandNew] = useState("");
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState("modern");
  const [primaryColor, setPrimaryColor] = useState("");
  const [paletteTokens, setPaletteTokens] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detectRes, paletteRes] = await Promise.all([
        fetch(`/api/v2/projects/${projectId}/brand/detect`, { method: "POST" }),
        fetch(`/api/v2/projects/${projectId}/palette`),
      ]);
      const detectData = (await detectRes.json()) as {
        ok: boolean;
        detection?: BrandDetection;
      };
      const paletteData = (await paletteRes.json()) as { ok: boolean; tokens?: string[] };
      if (detectData.ok && detectData.detection) {
        setDetection(detectData.detection);
        setBrandOriginal(detectData.detection.candidate);
      }
      if (paletteData.ok && paletteData.tokens) {
        setPaletteTokens(paletteData.tokens.slice(0, 6));
      }
    } catch {
      setError("브랜드 정보를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async () => {
    if (!brandOriginal.trim() || !brandNew.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const concept: BrandConcept = { keywords, tone, primaryColor: primaryColor || undefined };
      const paletteRemap: Record<string, string> = {};
      if (primaryColor && paletteTokens[0]) {
        paletteRemap[paletteTokens[0]] = primaryColor;
      }

      const res = await fetch(`/api/v2/projects/${projectId}/rebrand`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandOriginal, brandNew, concept, paletteRemap }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; replacedCount?: number };
      if (!data.ok) throw new Error(data.error);
      setResult(`브랜드명 ${data.replacedCount ?? 0}곳 치환 완료`);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "리브랜딩 실패");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-sm text-neutral-500">브랜드 분석 중…</p>;

  return (
    <div className="space-y-4">
      {detection && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{ borderColor: "var(--scan-line)", background: "var(--scan-blue-soft)" }}
        >
          <p className="font-semibold">
            감지된 브랜드: {detection.candidate}
            <span className="ml-2 text-xs font-normal text-neutral-500">
              (신뢰도 {Math.round(detection.confidence * 100)}%)
            </span>
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-neutral-600">
            {detection.signals.map((s) => (
              <li key={s.source}>
                {s.source}: {s.value}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">원본 브랜드명</span>
          <input
            value={brandOriginal}
            onChange={(e) => setBrandOriginal(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            style={{ borderColor: "var(--scan-line)" }}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">새 브랜드명 *</span>
          <input
            value={brandNew}
            onChange={(e) => setBrandNew(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            style={{ borderColor: "var(--scan-line)" }}
            required
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">컨셉 키워드</span>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="따뜻한 동네 책방"
            className="w-full rounded-lg border px-3 py-2"
            style={{ borderColor: "var(--scan-line)" }}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">톤</span>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            style={{ borderColor: "var(--scan-line)" }}
          >
            <option value="modern">모던</option>
            <option value="minimal">미니멀</option>
            <option value="warm">따뜻한</option>
            <option value="retro">레트로</option>
            <option value="luxury">럭셔리</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">주요 색상</span>
          <input
            type="color"
            value={primaryColor || "#2447D9"}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-full rounded-lg border"
            style={{ borderColor: "var(--scan-line)" }}
          />
        </label>
      </div>

      {paletteTokens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-neutral-500">원본 팔레트:</span>
          {paletteTokens.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs"
              style={{ background: "#f5f5f5" }}
            >
              <span className="inline-block h-3 w-3 rounded" style={{ background: c }} />
              {c}
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && <p className="text-sm text-green-700">{result}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting || !brandNew.trim()}
        className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--scan-blue)" }}
      >
        {submitting ? "치환 중…" : "브랜드 적용"}
      </button>
    </div>
  );
}
