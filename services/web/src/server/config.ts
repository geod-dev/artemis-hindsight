import { z } from "zod";

// All server-side configuration comes from environment variables, validated once.
// Parsed lazily so `next build` does not need runtime secrets.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  /** Speech to text (Groq Whisper). Optional: without it the dictation endpoint answers 503 and chat still works. */
  GROQ_API_KEY: z.string().min(1).optional(),
  CHAT_MODEL: z.string().default("claude-haiku-5-5"),
  MAX_AGENT_STEPS: z.coerce.number().int().min(1).max(50).default(12),

  HINDSIGHT_URL: z.string().url().default("http://hindsight:8888"),
  HINDSIGHT_BANK_ID: z.string().min(1).default("artemis"),
  HINDSIGHT_API_KEY: z.string().optional(),
  MEMORY_RECALL_BUDGET: z.enum(["low", "mid", "high"]).default("low"),
  MEMORY_RECALL_MAX_TOKENS: z.coerce.number().int().min(0).max(8192).default(1024),

  TOOLBOX_URL: z.string().url().default("http://toolbox:8080"),
  /** Where the sandbox keeps session folders. Used to show the agent the absolute path of an attachment. */
  SANDBOX_DATA_ROOT: z.string().min(1).default("/data"),
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
