import "server-only";
import { storedBriefingSchema, type StoredBriefing } from "@/lib/ai/schemas";
import { requireAuth } from "./auth";

export interface SavedBriefing extends StoredBriefing {
  id: string;
  source: "ai" | "rules";
  model: string | null;
  generatedAt: string;
}

/** Latest saved briefing, re-validated on read so stored JSON is never trusted blindly. */
export async function getLatestBriefing(): Promise<SavedBriefing | null> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("kind", "briefing")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const parsed = storedBriefingSchema.safeParse(data.content);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    id: data.id,
    source: data.source === "ai" ? "ai" : "rules",
    model: data.model,
    generatedAt: data.generated_at,
  };
}
