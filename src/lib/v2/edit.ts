import { uploadV2Html } from "@/lib/v2/blob";
import {
  getNextEditVersion,
  getProjectById,
  insertEditDocument,
  updateProjectStatus,
} from "@/lib/v2/db";

export async function saveEdit(
  projectId: string,
  html: string,
  docJson?: unknown,
): Promise<{ version: number; htmlUrl: string }> {
  const project = await getProjectById(projectId);
  if (!project) throw new Error("프로젝트를 찾을 수 없어요.");

  const version = await getNextEditVersion(projectId);
  const htmlUrl = await uploadV2Html(projectId, html, `edit-v${version}`);
  const editId = `${projectId}-edit-${version}`;

  await insertEditDocument({
    id: editId,
    projectId,
    version,
    docJson: docJson ?? null,
    renderedHtmlBlob: htmlUrl,
  });

  await updateProjectStatus(projectId, "ready");

  return { version, htmlUrl };
}
