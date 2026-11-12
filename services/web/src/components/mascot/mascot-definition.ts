import { validateAvatar, type AvatarDefinition } from "open-bot-avatar";

/** Where the bot's shape is served from. Generated and documented in public/mascot/README.md. */
const DEFINITION_URL = "/mascot/definition.json";

let loading: Promise<AvatarDefinition> | undefined;

/**
 * The mascot's shape, fetched from public/mascot/definition.json and checked against the open-bot-avatar contract.
 * Fetched once per page load and shared by every mascot on the page. A failed load is not cached, so the next call retries.
 */
export function loadMascotDefinition(): Promise<AvatarDefinition> {
  loading ??= fetch(DEFINITION_URL)
    .then(async (response) => {
      if (!response.ok) throw new Error(`mascot definition: HTTP ${response.status}`);
      const result = validateAvatar(await response.json());
      if (!result.ok) throw new Error(`mascot definition is invalid: ${JSON.stringify(result.errors)}`);
      return result.value;
    })
    .catch((error: unknown) => {
      loading = undefined;
      throw error;
    });
  return loading;
}
