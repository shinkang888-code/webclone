import { NextResponse } from "next/server";
import { listCloneRuns } from "@/lib/clone/history";
import type { CloneHistoryResponse } from "@/types/clone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runs = await listCloneRuns();
    return NextResponse.json<CloneHistoryResponse>({ ok: true, runs });
  } catch {
    return NextResponse.json<CloneHistoryResponse>(
      { ok: false, runs: [], error: "기록을 불러오지 못했어요." },
      { status: 500 },
    );
  }
}
