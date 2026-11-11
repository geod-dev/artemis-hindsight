import { usernameSchema } from "@artemis/contracts";
import { createBank, deleteBank } from "../clients/hindsight-client";
import { ensureWorkspace, removeSession, removeWorkspace } from "../clients/toolbox-client";
import { hashPassword, passwordProblem, verifyPassword } from "../auth/passwords";
import { conversationIdsOf } from "../repositories/conversation-repository";
import {
  deleteUserRow,
  findUserByUsername,
  insertUser,
  updatePasswordHash,
  updateStatus,
  type UserRow,
} from "../repositories/user-repository";
import { stopTurn } from "../agent/turn-registry";

/** A rule the caller broke. The message is safe to show to the admin or the user. */
export class UserServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Normalizes and checks a username typed by a person. Usernames are stored lowercase. */
export function parseUsername(raw: unknown): string {
  const parsed = usernameSchema.safeParse(typeof raw === "string" ? raw.trim().toLowerCase() : raw);
  if (!parsed.success) throw new UserServiceError(parsed.error.issues[0]?.message ?? "invalid username", 400);
  return parsed.data;
}

function checkPassword(password: unknown): string {
  if (typeof password !== "string") throw new UserServiceError("password is required", 400);
  const problem = passwordProblem(password);
  if (problem) throw new UserServiceError(problem, 400);
  return password;
}

/**
 * Creates a user: the Hindsight bank and the workspace folder first (both are idempotent), then the login row.
 * A username is taken for good once created, and it can never change.
 */
export async function createAccount(usernameInput: unknown, passwordInput: unknown): Promise<UserRow> {
  const username = parseUsername(usernameInput);
  const password = checkPassword(passwordInput);

  if (await findUserByUsername(username)) throw new UserServiceError("this username is already taken", 409);

  await createBank(username);
  await ensureWorkspace(username);

  const row = await insertUser(username, await hashPassword(password));
  if (!row) throw new UserServiceError("this username is already taken", 409);
  return row;
}

/** Checks a login. Returns the user for a correct username and password, or null otherwise. */
export async function authenticate(usernameInput: unknown, passwordInput: unknown): Promise<UserRow | null> {
  if (typeof usernameInput !== "string" || typeof passwordInput !== "string") return null;
  const row = await findUserByUsername(usernameInput.trim().toLowerCase());
  if (!row) return null;
  return (await verifyPassword(passwordInput, row.passwordHash)) ? row : null;
}

export async function resetPassword(username: string, passwordInput: unknown): Promise<void> {
  const password = checkPassword(passwordInput);
  const updated = await updatePasswordHash(username, await hashPassword(password));
  if (!updated) throw new UserServiceError("no such user", 404);
}

/**
 * Archives or restores a user. An archived user cannot sign in, and their running turns are stopped at once.
 * Their data stays until the admin deletes them for good.
 */
export async function setArchived(username: string, archived: boolean): Promise<void> {
  const row = await findUserByUsername(username);
  if (!row) throw new UserServiceError("no such user", 404);
  await updateStatus(username, archived ? "archived" : "active");
  if (archived) {
    for (const conversationId of await conversationIdsOf(row.id)) stopTurn(conversationId);
  }
}

/**
 * Deletes an archived user and everything they own: conversations, messages, session folders, workspace,
 * memory bank and login. Only an archived user can be deleted, and the caller must confirm the username.
 * External data is removed before the login row, so a failure part-way can be retried.
 */
export async function deletePermanently(username: string, confirmation: unknown): Promise<void> {
  const row = await findUserByUsername(username);
  if (!row) throw new UserServiceError("no such user", 404);
  if (row.status !== "archived") throw new UserServiceError("archive the user before deleting them", 409);
  if (confirmation !== username) throw new UserServiceError("type the username to confirm the deletion", 400);

  for (const conversationId of await conversationIdsOf(row.id)) {
    await removeSession(conversationId);
  }
  await removeWorkspace(username);
  await deleteBank(username);
  await deleteUserRow(username);
}
