import { ProjectWorkspace } from "@/components/v2/project-workspace";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  return <ProjectWorkspace projectId={id} />;
}
