import type { AnalystAnswer, Briefing, InsightItem } from "./schemas";

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Drops insight items that reference players absent from the supplied data —
 * a cheap, reliable check against invented players.
 */
export function guardItems(items: InsightItem[], known: Set<string>): { kept: InsightItem[]; removed: number } {
  const allowed = new Set([...known].map(norm));
  const kept = items.filter((item) => item.players.every((p) => allowed.has(norm(p))));
  return { kept, removed: items.length - kept.length };
}

export function guardBriefing(briefing: Briefing, known: Set<string>): { briefing: Briefing; removedStatements: number } {
  const obs = guardItems(briefing.observations, known);
  const risks = guardItems(briefing.risks, known);
  const opps = guardItems(briefing.opportunities, known);
  const removed = obs.removed + risks.removed + opps.removed;
  return {
    removedStatements: removed,
    briefing: {
      ...briefing,
      observations: obs.kept,
      risks: risks.kept,
      opportunities: opps.kept,
      confidence: removed > 0 && briefing.confidence === "high" ? "medium" : briefing.confidence,
      dataLimitations:
        removed > 0
          ? [...briefing.dataLimitations, `${removed} statement${removed === 1 ? " was" : "s were"} removed because ${removed === 1 ? "it" : "they"} referred to players not in your data.`].slice(0, 8)
          : briefing.dataLimitations,
    },
  };
}

export function guardAnswer(answer: AnalystAnswer, known: Set<string>): { answer: AnalystAnswer; unknownPlayers: string[] } {
  const allowed = new Set([...known].map(norm));
  const unknownPlayers = answer.players.filter((p) => !allowed.has(norm(p)));
  if (unknownPlayers.length === 0) return { answer, unknownPlayers };
  return {
    unknownPlayers,
    answer: {
      ...answer,
      confidence: "low",
      isSpeculative: true,
      dataLimitations: [
        ...answer.dataLimitations,
        `The answer mentions ${unknownPlayers.join(", ")}, which ${unknownPlayers.length === 1 ? "is" : "are"} not in your records — treat that part as unverified.`,
      ].slice(0, 8),
    },
  };
}
