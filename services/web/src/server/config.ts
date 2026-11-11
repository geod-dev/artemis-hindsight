import { z } from "zod";

// All server-side configuration comes from environment variables, validated once.
// Parsed lazily so `next build` does not need runtime secrets.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  /**
   * Speech to text (Groq Whisper). Optional: without it the dictation endpoint answers 503 and chat still works.
   * An empty value (as in .env.example, or a compose variable that is not set) counts as unset.
   */
  GROQ_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  CHAT_MODEL: z.string().default("claude-haiku-5-5"),
  /** Names a new conversation from its first message, in the background. Its prompt is prompts/conversation-title.md. */
  TITLE_MODEL: z.string().default("claude-haiku-5-5"),
  MAX_AGENT_STEPS: z.coerce.number().int().min(1).max(50).default(12),

  /** Signs the login tokens (HS256). Changing it signs everyone out. */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  /** Sent in the x-admin-key header with every admin operation. Checked on the server. */
  ADMIN_ACCESS_KEY: z.string().min(16, "ADMIN_ACCESS_KEY must be at least 16 characters"),

  HINDSIGHT_URL: z.string().url().default("http://hindsight:8888"),
  HINDSIGHT_API_KEY: z.string().optional(),
  MEMORY_RECALL_BUDGET: z.enum(["low", "mid", "high"]).default("low"),
  MEMORY_RECALL_MAX_TOKENS: z.coerce.number().int().min(0).max(8192).default(1024),

  TOOLBOX_URL: z.string().url().default("http://toolbox:8080"),
  /** Where the sandbox keeps session folders. Used to show the agent the absolute path of an attachment. */
  SANDBOX_DATA_ROOT: z.string().min(1).default("/data"),
  /** Where the sandbox keeps user workspaces: <root>/<username>. Shown to the agent in the user metadata tag. */
  SANDBOX_WORKSPACE_ROOT: z.string().min(1).default("/workspace"),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`Invalid environment configuration:\n${details}`);
    }
    cached = parsed.data;
  }
  return cached;
}
