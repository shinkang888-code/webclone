"use client";

import "grapesjs/dist/css/grapes.min.css";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  projectId: string;
  onSaved: () => void;
}

export function GrapesEditor({ projectId, onSaved }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof import("grapesjs").default.init> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initEditor = useCallback(async () => {
    if (!containerRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v2/projects/${projectId}/edit`);
      const data = (await res.json()) as { ok: boolean; html?: string; error?: string };
      if (!data.ok || !data.html) throw new Error(data.error ?? "HTML 로드 실패");

      const grapesjs = (await import("grapesjs")).default;

      if (editorRef.current) {
        editorRef.current.destroy();
      }

      const editor = grapesjs.init({
        container: containerRef.current,
        height: "600px",
        width: "auto",
        fromElement: false,
        storageManager: false,
        panels: { defaults: [] },
        deviceManager: {
          devices: [
            { name: "Desktop", width: "" },
            { name: "Tablet", width: "768px" },
            { name: "Mobile", width: "375px" },
          ],
        },
      });

      editor.setComponents(data.html);
      editorRef.current = editor;
    } catch (err) {
      setError(err instanceof Error ? err.message : "에디터 초기화 실패");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void initEditor();
    return () => {
      editorRef.current?.destroy();
    };
  }, [initEditor]);

  const handleSave = async () => {
    if (!editorRef.current) return;
    setSaving(true);
    setError(null);
    try {
      const html = editorRef.current.getHtml();
      const css = editorRef.current.getCss();
      const full = `<style>${css}</style>${html}`;
      const res = await fetch(`/api/v2/projects/${projectId}/edit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ html: full }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">
          블록을 드래그하고 텍스트를 클릭해 편집하세요.
        </p>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--scan-blue)" }}
        >
          {saving ? "저장 중…" : "편집 저장"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-neutral-500">에디터 로딩 중…</p>}
      <div ref={containerRef} className="rounded-lg border" style={{ borderColor: "var(--scan-line)" }} />
    </div>
  );
}
