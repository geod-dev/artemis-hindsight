import { createHash, timingSafeEqual } from "node:crypto";
import { getConfig } from "../config";

// Admin operations are guarded by the access key from the environment. The browser sends it in the
// x-admin-key header on every admin request, and the server checks it each time.
export const ADMIN_KEY_HEADER = "x-admin-key";

export function isAdminRequest(req: Request): boolean {
  const provided = req.headers.get(ADMIN_KEY_HEADER);
  if (!provided) return false;
  // Hash both sides so the comparison runs in constant time whatever the lengths are.
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(getConfig().ADMIN_ACCESS_KEY).digest();
  return timingSafeEqual(a, b);
}

export function adminForbidden(): Response {
  return Response.json({ error: "the admin access key is missing or wrong" }, { status: 403 });
}
