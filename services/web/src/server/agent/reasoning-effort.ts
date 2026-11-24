import type { EffortDecision, ReasoningEffortChoice } from "../db/schema";
import { getConfig } from "../config";
import { recordModelCall } from "../usage/model-calls";
import type { NamingMessage } from "./conversation-title";

// Auto reasoning effort: Jev (TypeSafe AI, a decision model) reads the conversation and answers one typed choice, the
// effort the reply runs with. The API is https://docs.typesafe.ai (POST /v1/systemone, Bearer key). The question is
// the same on every reply, so the prompt is not a file: it is the choice itself.

const JEV_URL = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";
/** Jev answers in well under a second. A slow answer is not waited for: the reply runs at medium. */
const JEV_TIMEOUT_MS = 10_000;
const FALLBACK_EFFORT = "medium";

const EFFORT_QUESTION = {
  type: "choice",
  instructions: "Which reasoning effort to answer the user ?",
  criteria: {
    low: "Quick replies",
    medium: "Everyday tasks",
    high: "Complex works",
  },
};

type FixedEffort = Exclude<ReasoningEffortChoice, "auto">;

function isFixedEffort(value: unknown): value is FixedEffort {
  return value === "low" || value === "medium" || value === "high";
}

/**
 * The effort a reply runs with. A fixed choice is used as it is. Auto asks Jev with the conversation's transcript (the
 * same messages the naming model reads). A continued reply keeps the effort its first answer ran with. Never rejects:
 * when Jev cannot answer, the reply runs at medium and the decision says so.
 */
export async function resolveReasoningEffort(params: {
  requested: ReasoningEffortChoice;
  /** The effort the stopped reply ran with, when this turn continues it. */
  continued?: EffortDecision;
  transcript: NamingMessage[];
  userId: string;
  conversationId: string;
  replyId: string;
}): Promise<EffortDecision> {
  const { requested, continued, transcript, userId, conversationId, replyId } = params;

  if (requested !== "auto") return { requested, used: requested, decidedBy: "user" };
  if (continued) return { ...continued, requested: "auto", decidedBy: "continued" };

  const fallback: EffortDecision = { requested: "auto", used: FALLBACK_EFFORT, decidedBy: "fallback" };
  const apiKey = getConfig().TYPESAFE_API_KEY;
  if (!apiKey || transcript.length === 0) return fallback;

  try {
    const res = await fetch(JEV_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: JEV_MODEL,
        state: { transcript },
        questions: { reasoning_effort: EFFORT_QUESTION },
      }),
      signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Jev answered HTTP ${res.status}`);
    const body = (await res.json()) as {
      model?: string;
      answers?: { reasoning_effort?: { type?: string; choice?: unknown } };
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    // Jev has no request id in its answer, so the sourceKey is a fresh id: the call is recorded once, right here.
    await recordModelCall({
      userId,
      sourceKey: `typesafe:${crypto.randomUUID()}`,
      context: "effort",
      operation: "generate",
      cause: "message_sent",
      model: body.model ?? JEV_MODEL,
      tokens: {
        input: body.usage?.input_tokens ?? 0,
        cacheRead: 0,
        cacheWrite: 0,
        output: body.usage?.output_tokens ?? 0,
      },
      conversationId,
      messageId: replyId,
    });

    const answer = body.answers?.reasoning_effort;
    if (answer?.type !== "choice" || !isFixedEffort(answer.choice)) {
      throw new Error("Jev's answer has no effort choice");
    }
    return { requested: "auto", used: answer.choice, decidedBy: "jev" };
  } catch (error) {
    console.warn("auto reasoning effort fell back to medium", {
      conversationId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}
