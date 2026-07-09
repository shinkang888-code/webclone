import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { CloneResult, CloneRunSummary, SavedAssetInfo } from "@/types/clone";

/**
 * Run metadata (everything needed to list scan history) lives in
 * Neon Postgres. The actual files (HTML, images) live in Vercel Blob;
 * see blob.ts. This keeps the serverless function stateless between
 * invocations while still giving persistent history.
 */

const MAX_HISTORY = 30;

let sqlClient: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (sqlClient) return sqlClient;
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "데이터베이스가 연결되어 있지 않아요. Vercel 프로젝트의 Storage 탭에서 Neon Postgres를 연결해 주세요.",
    );
  }
  sqlClient = neon(connectionString);
  return sqlClient;
}

let schemaReady = false;

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS clone_runs (
      run_id TEXT PRIMARY KEY,
      source_url TEXT NOT NULL,
      final_url TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      html_bytes INTEGER NOT NULL,
      snapshot_url TEXT NOT NULL,
      total_detected_assets INTEGER NOT NULL,
      downloaded_assets JSONB NOT NULL DEFAULT '[]',
      skipped_assets JSONB NOT NULL DEFAULT '[]',
      structure JSONB NOT NULL DEFAULT '{"sections":[],"nav":[]}',
      inlined_stylesheets INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Additive migration for stores created before P0 columns existed.
  await sql`ALTER TABLE clone_runs ADD COLUMN IF NOT EXISTS structure JSONB NOT NULL DEFAULT '{"sections":[],"nav":[]}'`;
  await sql`ALTER TABLE clone_runs ADD COLUMN IF NOT EXISTS inlined_stylesheets INTEGER NOT NULL DEFAULT 0`;
  await sql`
    CREATE INDEX IF NOT EXISTS clone_runs_created_at_idx
    ON clone_runs (created_at DESC)
  `;
  schemaReady = true;
}

export async function insertCloneRun(result: CloneResult): Promise<void> {
  const sql = getSql();
  await ensureSchema();
  await sql`
    INSERT INTO clone_runs (
      run_id, source_url, final_url, title, description, html_bytes,
      snapshot_url, total_detected_assets, downloaded_assets,
      skipped_assets, structure, inlined_stylesheets, duration_ms, created_at
    ) VALUES (
      ${result.runId}, ${result.sourceUrl}, ${result.finalUrl}, ${result.title},
      ${result.description}, ${result.htmlBytes}, ${result.snapshotPath},
      ${result.totalDetectedAssets}, ${JSON.stringify(result.downloadedAssets)},
      ${JSON.stringify(result.skippedAssets)}, ${JSON.stringify(result.structure)},
      ${result.inlinedStylesheets}, ${result.durationMs}, ${result.createdAt}
    )
    ON CONFLICT (run_id) DO NOTHING
  `;
}

interface CloneRunRow {
  run_id: string;
  source_url: string;
  final_url: string;
  title: string;
  snapshot_url: string;
  downloaded_assets: SavedAssetInfo[];
  created_at: string;
}

export async function listCloneRunSummaries(): Promise<CloneRunSummary[]> {
  const sql = getSql();
  await ensureSchema();

  const rows = (await sql`
    SELECT run_id, source_url, final_url, title, snapshot_url,
           downloaded_assets, created_at
    FROM clone_runs
    ORDER BY created_at DESC
    LIMIT ${MAX_HISTORY}
  `) as unknown as CloneRunRow[];

  return rows.map((row) => {
    const assets = row.downloaded_assets ?? [];
    const firstImage = assets.find(
      (asset) =>
        asset.kind === "image" ||
        /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(asset.localPath),
    );

    return {
      runId: row.run_id,
      sourceUrl: row.source_url,
      finalUrl: row.final_url,
      title: row.title,
      snapshotPath: row.snapshot_url,
      downloadedAssetCount: assets.length,
      thumbnailPath: firstImage?.localPath ?? null,
      createdAt: new Date(row.created_at).toISOString(),
    };
  });
}
