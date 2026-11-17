import type { ProjectSummary } from "@/lib/projects";

// The project requests of the web app. Each one throws with the server's message when it is refused.

async function send(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.ok) return res;
  const body: unknown = await res.json().catch(() => null);
  const message = typeof body === "object" && body !== null && "error" in body ? String(body.error) : "";
  throw new Error(message || `the request failed (HTTP ${res.status})`);
}

export async function createProject(form: FormData): Promise<ProjectSummary> {
  return (await send("/api/projects", { method: "POST", body: form })).json() as Promise<ProjectSummary>;
}

export async function updateProject(projectId: string, form: FormData): Promise<ProjectSummary> {
  const url = `/api/projects/${encodeURIComponent(projectId)}`;
  return (await send(url, { method: "PATCH", body: form })).json() as Promise<ProjectSummary>;
}

/** Saves the order of the user's projects: every project id, in the order they show. */
export async function saveProjectOrder(ids: string[]): Promise<void> {
  await send("/api/projects/order", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  await send(`/api/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" });
}
