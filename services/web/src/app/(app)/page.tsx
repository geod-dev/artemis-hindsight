import { redirect } from "next/navigation";
import { NewChat } from "@/components/chat/new-chat";
import { getCurrentUser } from "@/server/auth/session";
import { projectJson } from "@/server/projects/project-service";
import { listProjects } from "@/server/repositories/project-repository";

/**
 * The new chat. `?project=<id>` opens it with that project selected (the sidebar's project links). Without it, or with
 * a project that is not the user's, no project is selected.
 */
export default async function NewChatPage({ searchParams }: { searchParams: Promise<{ project?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { project } = await searchParams;
  const projects = (await listProjects(user.id)).map(projectJson);
  const requested = typeof project === "string" ? project : null;
  const initialProjectId = projects.find((candidate) => candidate.id === requested)?.id ?? null;

  // A new key for each project in the URL: a link to another project, or to no project, starts a fresh chat.
  return <NewChat key={initialProjectId ?? "none"} projects={projects} initialProjectId={initialProjectId} />;
}
