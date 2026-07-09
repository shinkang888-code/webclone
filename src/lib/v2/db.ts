import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type {
  BrandConcept,
  CaptureResult,
  EditDocument,
  ProjectAsset,
  ProjectDetail,
  ProjectStatus,
  ProjectSummary,
  PublishedSite,
  NavMap,
  StructureTree,
} from "@/types/project";

let sqlClient: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (sqlClient) return sqlClient;
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "데이터베이스가 연결되어 있지 않아요. Vercel Storage에서 Neon Postgres를 연결해 주세요.",
    );
  }
  sqlClient = neon(connectionString);
  return sqlClient;
}

let schemaReady = false;

export async function ensureV2Schema(): Promise<void> {
  if (schemaReady) return;
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      owner TEXT,
      source_url TEXT NOT NULL,
      brand_original TEXT,
      brand_new TEXT,
      concept JSONB,
      rebranded_html_url TEXT,
      status TEXT NOT NULL DEFAULT 'captured',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS captures (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      html_blob_url TEXT NOT NULL,
      css_blob_url TEXT,
      structure_json JSONB NOT NULL,
      navmap_json JSONB NOT NULL,
      render_mode TEXT NOT NULL DEFAULT 'fetch-fallback',
      asset_count INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      slot_key TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'unknown',
      blob_url TEXT NOT NULL,
      original_src TEXT,
      is_generated BOOLEAN NOT NULL DEFAULT false,
      aspect_ratio TEXT,
      prompt TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS edit_documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      doc_json JSONB,
      rendered_html_blob TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS published_sites (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      edit_version INTEGER NOT NULL DEFAULT 1,
      target TEXT NOT NULL DEFAULT 'blob',
      url TEXT NOT NULL,
      slug TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      published_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS captures_project_id_idx ON captures (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS assets_project_id_idx ON assets (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS edit_documents_project_id_idx ON edit_documents (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS published_sites_project_id_idx ON published_sites (project_id)`;

  schemaReady = true;
}

export function makeProjectId(url: string): string {
  const hostname = new URL(url).hostname.replaceAll(".", "-");
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  return `proj-${hostname}-${timestamp}`;
}

export function makeCaptureId(projectId: string): string {
  return `${projectId}-cap`;
}

export async function insertProject(input: {
  id: string;
  sourceUrl: string;
  title: string;
  status?: ProjectStatus;
}): Promise<void> {
  const sql = getSql();
  await ensureV2Schema();
  await sql`
    INSERT INTO projects (id, source_url, status)
    VALUES (${input.id}, ${input.sourceUrl}, ${input.status ?? "capturing"})
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus,
): Promise<void> {
  const sql = getSql();
  await sql`UPDATE projects SET status = ${status} WHERE id = ${projectId}`;
}

export async function updateProjectBrand(
  projectId: string,
  input: {
    brandOriginal: string;
    brandNew: string;
    concept: BrandConcept | null;
    rebrandedHtmlUrl: string;
    status: ProjectStatus;
  },
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE projects SET
      brand_original = ${input.brandOriginal},
      brand_new = ${input.brandNew},
      concept = ${input.concept ? JSON.stringify(input.concept) : null},
      rebranded_html_url = ${input.rebrandedHtmlUrl},
      status = ${input.status}
    WHERE id = ${projectId}
  `;
}

export async function insertCapture(input: {
  id: string;
  projectId: string;
  htmlBlobUrl: string;
  cssBlobUrl: string | null;
  structure: StructureTree;
  navmap: NavMap;
  renderMode: string;
  assetCount: number;
  durationMs: number;
}): Promise<void> {
  const sql = getSql();
  await ensureV2Schema();
  await sql`
    INSERT INTO captures (
      id, project_id, html_blob_url, css_blob_url,
      structure_json, navmap_json, render_mode, asset_count, duration_ms
    ) VALUES (
      ${input.id}, ${input.projectId}, ${input.htmlBlobUrl}, ${input.cssBlobUrl},
      ${JSON.stringify(input.structure)}, ${JSON.stringify(input.navmap)},
      ${input.renderMode}, ${input.assetCount}, ${input.durationMs}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function upsertAsset(input: {
  id: string;
  projectId: string;
  slotKey: string;
  role: string;
  blobUrl: string;
  originalSrc: string | null;
  isGenerated: boolean;
  aspectRatio: string | null;
  prompt: string | null;
}): Promise<void> {
  const sql = getSql();
  await ensureV2Schema();
  await sql`
    INSERT INTO assets (
      id, project_id, slot_key, role, blob_url, original_src,
      is_generated, aspect_ratio, prompt
    ) VALUES (
      ${input.id}, ${input.projectId}, ${input.slotKey}, ${input.role},
      ${input.blobUrl}, ${input.originalSrc}, ${input.isGenerated},
      ${input.aspectRatio}, ${input.prompt}
    )
    ON CONFLICT (id) DO UPDATE SET
      blob_url = EXCLUDED.blob_url,
      is_generated = EXCLUDED.is_generated,
      prompt = EXCLUDED.prompt
  `;
}

export async function listAssets(projectId: string): Promise<ProjectAsset[]> {
  const sql = getSql();
  await ensureV2Schema();
  const rows = (await sql`
    SELECT id, project_id, slot_key, role, blob_url, original_src,
           is_generated, aspect_ratio, prompt, created_at
    FROM assets WHERE project_id = ${projectId}
    ORDER BY created_at ASC
  `) as unknown as Array<{
    id: string;
    project_id: string;
    slot_key: string;
    role: string;
    blob_url: string;
    original_src: string | null;
    is_generated: boolean;
    aspect_ratio: string | null;
    prompt: string | null;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    slotKey: r.slot_key,
    role: r.role,
    blobUrl: r.blob_url,
    originalSrc: r.original_src,
    isGenerated: r.is_generated,
    aspectRatio: r.aspect_ratio,
    prompt: r.prompt,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function insertEditDocument(input: {
  id: string;
  projectId: string;
  version: number;
  docJson: unknown | null;
  renderedHtmlBlob: string;
}): Promise<void> {
  const sql = getSql();
  await ensureV2Schema();
  await sql`
    INSERT INTO edit_documents (id, project_id, version, doc_json, rendered_html_blob)
    VALUES (
      ${input.id}, ${input.projectId}, ${input.version},
      ${input.docJson ? JSON.stringify(input.docJson) : null},
      ${input.renderedHtmlBlob}
    )
  `;
}

export async function getLatestEdit(projectId: string): Promise<EditDocument | null> {
  const sql = getSql();
  await ensureV2Schema();
  const rows = (await sql`
    SELECT id, project_id, version, rendered_html_blob, updated_at
    FROM edit_documents
    WHERE project_id = ${projectId}
    ORDER BY version DESC LIMIT 1
  `) as unknown as Array<{
    id: string;
    project_id: string;
    version: number;
    rendered_html_blob: string;
    updated_at: string;
  }>;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    projectId: r.project_id,
    version: r.version,
    renderedHtmlBlob: r.rendered_html_blob,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function getNextEditVersion(projectId: string): Promise<number> {
  const sql = getSql();
  const rows = (await sql`
    SELECT COALESCE(MAX(version), 0) + 1 AS next_version
    FROM edit_documents WHERE project_id = ${projectId}
  `) as unknown as Array<{ next_version: number }>;
  return rows[0]?.next_version ?? 1;
}

export async function insertPublishedSite(input: {
  id: string;
  projectId: string;
  editVersion: number;
  target: "blob" | "vercel";
  url: string;
  slug: string;
}): Promise<void> {
  const sql = getSql();
  await ensureV2Schema();
  await sql`UPDATE published_sites SET is_active = false WHERE project_id = ${input.projectId}`;
  await sql`
    INSERT INTO published_sites (id, project_id, edit_version, target, url, slug, is_active)
    VALUES (
      ${input.id}, ${input.projectId}, ${input.editVersion},
      ${input.target}, ${input.url}, ${input.slug}, true
    )
  `;
  await sql`UPDATE projects SET status = 'published' WHERE id = ${input.projectId}`;
}

export async function listPublishHistory(projectId: string): Promise<PublishedSite[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, project_id, edit_version, target, url, slug, published_at
    FROM published_sites WHERE project_id = ${projectId}
    ORDER BY published_at DESC
  `) as unknown as Array<{
    id: string;
    project_id: string;
    edit_version: number;
    target: string;
    url: string;
    slug: string;
    published_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    editVersion: r.edit_version,
    target: r.target as "blob" | "vercel",
    url: r.url,
    slug: r.slug,
    publishedAt: new Date(r.published_at).toISOString(),
  }));
}

export async function rollbackPublish(
  projectId: string,
  publishId: string,
): Promise<PublishedSite | null> {
  const sql = getSql();
  await sql`UPDATE published_sites SET is_active = false WHERE project_id = ${projectId}`;
  await sql`
    UPDATE published_sites SET is_active = true
    WHERE id = ${publishId} AND project_id = ${projectId}
  `;
  const history = await listPublishHistory(projectId);
  return history.find((p) => p.id === publishId) ?? null;
}

interface ProjectRow {
  id: string;
  source_url: string;
  status: string;
  brand_original: string | null;
  brand_new: string | null;
  concept: BrandConcept | null;
  rebranded_html_url: string | null;
  created_at: string;
  structure_json: StructureTree | null;
  html_blob_url: string | null;
}

export async function listProjectSummaries(limit = 20): Promise<ProjectSummary[]> {
  const sql = getSql();
  await ensureV2Schema();

  const rows = (await sql`
    SELECT p.id, p.source_url, p.status, p.created_at,
           c.structure_json, c.html_blob_url
    FROM projects p
    LEFT JOIN LATERAL (
      SELECT structure_json, html_blob_url
      FROM captures WHERE project_id = p.id
      ORDER BY created_at DESC LIMIT 1
    ) c ON true
    ORDER BY p.created_at DESC LIMIT ${limit}
  `) as unknown as ProjectRow[];

  return rows.map((row) => {
    const structure = row.structure_json;
    const firstImage = structure?.sections
      .flatMap((s) => s.imageSlots)
      .find((slot) => slot.src && !slot.src.startsWith("data:"));

    return {
      id: row.id,
      sourceUrl: row.source_url,
      title: structure?.sections[0]?.textPreview?.slice(0, 60) ?? row.source_url,
      status: row.status as ProjectStatus,
      thumbnailUrl: firstImage?.src ?? null,
      sectionCount: structure?.totalBlocks ?? 0,
      createdAt: new Date(row.created_at).toISOString(),
    };
  });
}

export async function getCaptureByProjectId(
  projectId: string,
): Promise<CaptureResult | null> {
  const sql = getSql();
  await ensureV2Schema();

  const rows = (await sql`
    SELECT p.id AS project_id, p.source_url, c.id AS capture_id,
           c.html_blob_url, c.css_blob_url, c.structure_json, c.navmap_json,
           c.render_mode, c.asset_count, c.duration_ms, c.created_at
    FROM projects p
    JOIN captures c ON c.project_id = p.id
    WHERE p.id = ${projectId}
    ORDER BY c.created_at DESC LIMIT 1
  `) as unknown as Array<{
    project_id: string;
    source_url: string;
    capture_id: string;
    html_blob_url: string;
    css_blob_url: string | null;
    structure_json: StructureTree;
    navmap_json: NavMap;
    render_mode: string;
    asset_count: number;
    duration_ms: number;
    created_at: string;
  }>;

  const row = rows[0];
  if (!row) return null;

  return {
    projectId: row.project_id,
    captureId: row.capture_id,
    sourceUrl: row.source_url,
    finalUrl: row.source_url,
    title: row.structure_json.sections[0]?.label ?? "Untitled",
    htmlBlobUrl: row.html_blob_url,
    cssBlobUrl: row.css_blob_url,
    structure: row.structure_json,
    navmap: row.navmap_json,
    assetCount: row.asset_count,
    durationMs: row.duration_ms,
    renderMode: row.render_mode as "playwright" | "fetch-fallback",
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function getProjectById(projectId: string): Promise<ProjectDetail | null> {
  const sql = getSql();
  await ensureV2Schema();

  const rows = (await sql`
    SELECT id, source_url, status, brand_original, brand_new,
           concept, rebranded_html_url, created_at
    FROM projects WHERE id = ${projectId}
  `) as unknown as Array<{
    id: string;
    source_url: string;
    status: string;
    brand_original: string | null;
    brand_new: string | null;
    concept: BrandConcept | null;
    rebranded_html_url: string | null;
    created_at: string;
  }>;

  const row = rows[0];
  if (!row) return null;

  const capture = await getCaptureByProjectId(projectId);
  const assets = await listAssets(projectId);
  const latestEdit = await getLatestEdit(projectId);
  const publishHistory = await listPublishHistory(projectId);

  return {
    id: row.id,
    sourceUrl: row.source_url,
    status: row.status as ProjectStatus,
    brandOriginal: row.brand_original,
    brandNew: row.brand_new,
    concept: row.concept,
    capture,
    rebrandedHtmlUrl: row.rebranded_html_url,
    assets,
    latestEdit,
    latestPublish: publishHistory[0] ?? null,
    publishHistory,
    imagesReplaced: assets.some((a) => a.isGenerated),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** Current working HTML URL — latest edit > rebranded > capture */
export async function getWorkingHtmlUrl(projectId: string): Promise<string | null> {
  const project = await getProjectById(projectId);
  if (!project) return null;
  return (
    project.latestEdit?.renderedHtmlBlob ??
    project.rebrandedHtmlUrl ??
    (await getWorkingHtmlFromBlob(project)) ??
    project.capture?.htmlBlobUrl ??
    null
  );
}

async function getWorkingHtmlFromBlob(project: ProjectDetail): Promise<string | null> {
  // working.html is stored at predictable path but we don't track URL in DB;
  // derive from capture URL pattern
  const base = project.rebrandedHtmlUrl ?? project.capture?.htmlBlobUrl;
  if (!base) return null;
  const workingUrl = base.replace(/\/[^/]+\.html$/, "/working.html");
  try {
    const res = await fetch(workingUrl, { method: "HEAD", cache: "no-store" });
    return res.ok ? workingUrl : null;
  } catch {
    return null;
  }
}
