import { z } from "zod";

// A username names the user's Hindsight memory bank and their workspace folder (/workspace/<username>),
// so it is restricted to characters that are safe in both. Usernames are stored lowercase and never change.
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,31}$/;

export const usernameSchema = z
  .string()
  .regex(USERNAME_PATTERN, "username must be 3-32 characters: a-z, 0-9, _ or -, starting with a letter or digit");
