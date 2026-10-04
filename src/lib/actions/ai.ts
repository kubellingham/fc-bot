"use server";

import { z } from "zod";
import { AiError, answerQuestion, createAnalystClient, generateAiBriefing } from "@/lib/ai/analyst";
import { dataSufficiency } from "@/lib/ai/context";
import { loadAnalystContext } from "@/lib/ai/load";
import { rulesBriefing } from "@/lib/ai/rules";
import type { AnalystAnswer, Briefing } from "@/lib/ai/schemas";
import { getAiEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { aiQuestionSchema } from "@/lib/validation/schemas";
import { runAction, throwDb, UserFacingError } from "./runner";

const MAX_STORED_BRIEFINGS = 20;

export interface BriefingActionResult {
  source: "ai" | "rules";
  notice: string | null;
}

/**
 * Generates and saves a market briefing. Uses the AI analyst when configured;
 * otherwise — or if the AI request fails — saves a rule-based summary built from
 * the same data and says so.
 */
export async function generateBriefing(raw: unknown) {
  return runAction(
    z.object({ preferRules: z.boolean().default(false) }),
    raw,
    { name: "ai.briefing" },
    async ({ preferRules }, { supabase, user }): Promise<BriefingActionResult> => {
      const { context, prefs } = await loadAnalystContext();
      const sufficiency = dataSufficiency(context);
      if (!sufficiency.sufficient) throw new UserFacingError(sufficiency.reason!);

      const ai = preferRules ? null : getAiEnv();
      let briefing: Briefing;
      let source: "ai" | "rules" = "rules";
      let model: string | null = null;
      let removedStatements = 0;
      let notice: string | null = ai ? null : "AI is not configured on this server, so an automated summary was created instead.";

      if (ai) {
        const limited = await checkRateLimit(supabase, ["ai_short", "ai_daily"]);
        if (limited) throw new UserFacingError(limited);
        try {
          const result = await generateAiBriefing(createAnalystClient(ai.apiKey), ai.model, context);
          briefing = result.briefing;
          removedStatements = result.removedStatements;
          model = result.model;
          source = "ai";
        } catch (error) {
          const aiError = error instanceof AiError ? error : new AiError("failed", "The AI request failed.");
          logger.warn("ai.briefing_failed", { userId: user.id, kind: aiError.kind });
          briefing = rulesBriefing(context, prefs);
          notice = `${aiError.userMessage} An automated summary was created instead.`;
        }
      } else {
        briefing = rulesBriefing(context, prefs);
      }

      const { error } = await supabase.from("ai_insights").insert({
        kind: "briefing",
        source,
        model,
        content: { briefing, removedStatements },
      });
      throwDb(error);

      // Keep only the most recent briefings.
      const { data: old } = await supabase
        .from("ai_insights")
        .select("id")
        .eq("kind", "briefing")
        .order("generated_at", { ascending: false })
        .range(MAX_STORED_BRIEFINGS, MAX_STORED_BRIEFINGS + 50);
      if (old?.length) await supabase.from("ai_insights").delete().in("id", old.map((r) => r.id));

      return { source, notice };
    },
  );
}

export interface AnswerActionResult {
  answer: AnalystAnswer;
  model: string | null;
}

/** Answers a question about the user's own records. Not stored. */
export async function askAnalyst(raw: unknown) {
  return runAction(aiQuestionSchema, raw, { name: "ai.question", refresh: false }, async ({ question }, { supabase, user }): Promise<AnswerActionResult> => {
    const ai = getAiEnv();
    if (!ai) throw new UserFacingError("The AI analyst isn't configured on this server. Ask your administrator to set ANTHROPIC_API_KEY.");

    const { context } = await loadAnalystContext();
    const sufficiency = dataSufficiency(context);
    if (!sufficiency.sufficient) {
      // Answer honestly without spending an AI request.
      return {
        model: null,
        answer: {
          answer: sufficiency.reason!,
          basis: [],
          players: [],
          confidence: "low",
          isSpeculative: false,
          dataLimitations: ["Not enough recorded data for analysis."],
        },
      };
    }

    const limited = await checkRateLimit(supabase, ["ai_short", "ai_daily"]);
    if (limited) throw new UserFacingError(limited);

    try {
      const result = await answerQuestion(createAnalystClient(ai.apiKey), ai.model, context, question);
      return { answer: result.answer, model: result.model };
    } catch (error) {
      if (error instanceof AiError) {
        logger.warn("ai.question_failed", { userId: user.id, kind: error.kind });
        throw new UserFacingError(error.userMessage);
      }
      throw error;
    }
  });
}
