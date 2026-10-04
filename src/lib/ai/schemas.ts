import { z } from "zod";

/**
 * Two layers of schema:
 * - `*OutputSchema` is sent to the API as the structured-output format. It uses
 *   only plain types so it converts cleanly to JSON Schema.
 * - `*Schema` is the stricter application contract every response must pass
 *   before it is shown or stored (lengths, list sizes, trimming).
 */

const insightItemOutput = z.object({
  statement: z.string().describe("One concise finding."),
  evidence: z.string().describe("Which supplied figures support it (cite numbers and dates from the data)."),
  players: z.array(z.string()).describe("Exact player labels from the data that this item refers to; empty if none."),
});

export const briefingOutputSchema = z.object({
  summary: z.string(),
  observations: z.array(insightItemOutput),
  risks: z.array(insightItemOutput),
  opportunities: z.array(insightItemOutput),
  confidence: z.enum(["low", "medium", "high"]),
  dataLimitations: z.array(z.string()),
});

export const answerOutputSchema = z.object({
  answer: z.string(),
  basis: z.array(z.string()).describe("The specific supplied figures the answer relies on."),
  players: z.array(z.string()).describe("Exact player labels from the data the answer refers to; empty if none."),
  confidence: z.enum(["low", "medium", "high"]),
  isSpeculative: z.boolean().describe("True if any part of the answer goes beyond what the data shows."),
  dataLimitations: z.array(z.string()),
});

const text = (max: number) => z.string().trim().min(1).max(max);

export const insightItemSchema = z.object({
  statement: text(400),
  evidence: text(600),
  players: z.array(text(120)).max(10),
});

export const briefingSchema = z.object({
  summary: text(1200),
  observations: z.array(insightItemSchema).max(8),
  risks: z.array(insightItemSchema).max(6),
  opportunities: z.array(insightItemSchema).max(6),
  confidence: z.enum(["low", "medium", "high"]),
  dataLimitations: z.array(text(300)).max(8),
});
export type Briefing = z.infer<typeof briefingSchema>;
export type InsightItem = z.infer<typeof insightItemSchema>;

export const answerSchema = z.object({
  answer: text(3000),
  basis: z.array(text(400)).max(10),
  players: z.array(text(120)).max(20),
  confidence: z.enum(["low", "medium", "high"]),
  isSpeculative: z.boolean(),
  dataLimitations: z.array(text(300)).max(8),
});
export type AnalystAnswer = z.infer<typeof answerSchema>;

/** Stored in ai_insights.content. */
export const storedBriefingSchema = z.object({
  briefing: briefingSchema,
  removedStatements: z.number().int().min(0).default(0),
});
export type StoredBriefing = z.infer<typeof storedBriefingSchema>;
