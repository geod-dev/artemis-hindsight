import { SkillServiceError } from "./skills-service";

/** The response for an error from the skills routes: the service's own errors keep their status and message. */
export function skillErrorResponse(error: unknown, action: string): Response {
  if (error instanceof SkillServiceError) return Response.json({ error: error.message }, { status: error.status });
  console.error(`skills: ${action} failed`, error);
  const reason = error instanceof Error ? error.message : String(error);
  return Response.json({ error: `could not ${action}: ${reason}` }, { status: 502 });
}
