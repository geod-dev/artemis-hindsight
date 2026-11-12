import { validateAvatar, type AvatarDefinition } from "open-bot-avatar";

/** Where the bot's shape is served from. Generated and documented in public/avatar/README.md. */
const DEFINITION_URL = "/avatar/definition.json";

let loading: Promise<AvatarDefinition> | undefined;

/**
 * The bot's shape, fetched from public/avatar/definition.json and checked against the open-bot-avatar contract.
 * Fetched once per page load and shared by every avatar on the page. A failed load is not cached, so the next call retries.
 */
export function loadAvatarDefinition(): Promise<AvatarDefinition> {
  loading ??= fetch(DEFINITION_URL)
    .then(async (response) => {
      if (!response.ok) throw new Error(`avatar definition: HTTP ${response.status}`);
      const result = validateAvatar(await response.json());
      if (!result.ok) throw new Error(`avatar definition is invalid: ${JSON.stringify(result.errors)}`);
      return result.value;
    })
    .catch((error: unknown) => {
      loading = undefined;
      throw error;
    });
  return loading;
}
