import { compare, hash } from "bcryptjs";

// bcrypt reads at most 72 bytes of a password, so longer passwords are refused instead of silently truncated.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

const COST = 12;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
    return `password must be at most ${PASSWORD_MAX_BYTES} bytes`;
  }
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, COST);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}
