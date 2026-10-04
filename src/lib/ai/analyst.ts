import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { AnalystContext } from "./context";
import { knownPlayers, serializeContext } from "./context";
import { guardAnswer, guardBriefing } from "./guard";
import { BRIEFING_SYSTEM_PROMPT, QUESTION_SYSTEM_PROMPT, userDataMessage } from "./prompts";
import {
  answerOutputSchema,
  answerSchema,
  briefingOutputSchema,
  briefingSchema,
  type AnalystAnswer,
  type Briefing,
} from "./schemas";

/** Every failure carries a message that is safe to show to the user. */
export class AiError extends Error {
  constructor(
    public readonly kind: "unavailable" | "rate_limited" | "refused" | "invalid_output" | "misconfigured" | "failed",
    public readonly userMessage: string,
  ) {
    super(userMessage);
    this.name = "AiError";
  }
}

/** Models that accept server-side refusal fallbacks (`fallbacks: "default"`). */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

/** The subset of the SDK client the analyst uses — injectable for tests. */
export type AnalystClient = Pick<Anthropic, "beta">;

export function createAnalystClient(apiKey: string): AnalystClient {
  // Bounded latency for an interactive request; one retry for transient errors.
  return new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 });
}

const BRIEFING_MAX_TOKENS = 16_000;
const ANSWER_MAX_TOKENS = 12_000;

function requestOptions(model: string) {
  const supportsEffort = !model.startsWith("claude-haiku");
  return {
    effort: supportsEffort ? { effort: "medium" as const } : {},
    fallback: FALLBACK_MODELS.has(model)
      ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
      : {},
  };
}

function mapSdkError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError("rate_limited", "The AI service is busy right now. Please try again in a minute.");
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AiError("misconfigured", "The AI service is not configured correctly on the server.");
  }
  if (error instanceof Anthropic.APIConnectionError || error instanceof Anthropic.InternalServerError) {
    return new AiError("unavailable", "The AI service is temporarily unavailable. Please try again shortly.");
  }
  if (error instanceof Anthropic.APIError) {
    return new AiError("failed", "The AI request could not be completed.");
  }
  // JSON / schema parse failures from the SDK's structured-output helper.
  return new AiError("invalid_output", "The AI returned an unexpected response, so it was discarded.");
}

function checkStop(stopReason: string | null) {
  if (stopReason === "refusal") {
    throw new AiError("refused", "The AI declined to answer this request. Try rephrasing your question.");
  }
  if (stopReason === "max_tokens") {
    throw new AiError("invalid_output", "The AI response was cut off before it finished, so it was discarded.");
  }
}

export interface BriefingResult {
  briefing: Briefing;
  removedStatements: number;
  model: string;
}

export async function generateAiBriefing(client: AnalystClient, model: string, context: AnalystContext): Promise<BriefingResult> {
  const { effort, fallback } = requestOptions(model);
  let response;
  try {
    response = await client.beta.messages.parse({
      model,
      max_tokens: BRIEFING_MAX_TOKENS,
      system: BRIEFING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userDataMessage(serializeContext(context)) }],
      output_config: { format: betaZodOutputFormat(briefingOutputSchema), ...effort },
      ...fallback,
    });
  } catch (error) {
    throw mapSdkError(error);
  }
  checkStop(response.stop_reason);
  const strict = briefingSchema.safeParse(response.parsed_output);
  if (!strict.success) {
    throw new AiError("invalid_output", "The AI returned a briefing that didn't match the expected format, so it was discarded.");
  }
  const guarded = guardBriefing(strict.data, knownPlayers(context));
  return { ...guarded, model: response.model };
}

export interface AnswerResult {
  answer: AnalystAnswer;
  unknownPlayers: string[];
  model: string;
}

export async function answerQuestion(
  client: AnalystClient,
  model: string,
  context: AnalystContext,
  question: string,
): Promise<AnswerResult> {
  const { effort, fallback } = requestOptions(model);
  let response;
  try {
    response = await client.beta.messages.parse({
      model,
      max_tokens: ANSWER_MAX_TOKENS,
      system: QUESTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userDataMessage(serializeContext(context), question) }],
      output_config: { format: betaZodOutputFormat(answerOutputSchema), ...effort },
      ...fallback,
    });
  } catch (error) {
    throw mapSdkError(error);
  }
  checkStop(response.stop_reason);
  const strict = answerSchema.safeParse(response.parsed_output);
  if (!strict.success) {
    throw new AiError("invalid_output", "The AI returned an answer that didn't match the expected format, so it was discarded.");
  }
  const guarded = guardAnswer(strict.data, knownPlayers(context));
  return { ...guarded, model: response.model };
}
