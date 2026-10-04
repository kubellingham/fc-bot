"use client";

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, Send, User, BotMessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { askAnalyst } from "@/lib/actions/ai";
import type { AnalystAnswer } from "@/lib/ai/schemas";

const SUGGESTIONS = [
  "Which of my holdings are below break-even?",
  "How has my trading performed over the last 30 days?",
  "Which tracked players moved the most recently, and is that supported by enough data?",
  "What's my average holding time on profitable vs losing trades?",
];

interface Turn {
  id: number;
  question: string;
  answer?: AnalystAnswer;
  error?: string;
}

export function AnalystChat({ enabled }: { enabled: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, start] = useTransition();
  const nextId = useRef(1);

  const ask = (q: string) => {
    const text = q.trim();
    if (text.length < 3 || pending) return;
    const id = nextId.current++;
    setTurns((t) => [...t, { id, question: text }]);
    setQuestion("");
    start(async () => {
      let update: Partial<Turn>;
      try {
        const r = await askAnalyst({ question: text });
        update = !r ? { error: "No response." } : r.ok ? { answer: r.data.answer } : { error: r.error };
      } catch {
        update = { error: "We couldn't reach the server. Please try again." };
      }
      setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, ...update } : turn)));
    });
  };

  if (!enabled) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Questions need an AI provider</p>
        <p className="mt-1">
          Set <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY</code> on the server to ask questions about your records.
          The automated briefing above works without it.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Button key={s} variant="outline" size="sm" className="h-auto py-1.5 text-left whitespace-normal" onClick={() => ask(s)}>
              {s}
            </Button>
          ))}
        </div>
      )}
      <ol className="grid gap-4" aria-live="polite">
        {turns.map((t) => (
          <li key={t.id} className="grid gap-2">
            <div className="flex items-start gap-2 text-sm">
              <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium">{t.question}</p>
            </div>
            <div className="ml-6 rounded-lg border bg-card p-3 text-sm">
              {!t.answer && !t.error && (
                <div className="grid gap-2" aria-label="Waiting for answer">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              )}
              {t.error && (
                <p role="alert" className="flex items-start gap-2 text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {t.error}
                </p>
              )}
              {t.answer && (
                <div className="grid gap-2">
                  <div className="flex items-start gap-2">
                    <BotMessageSquare className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <p className="whitespace-pre-line">{t.answer.answer}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={t.answer.confidence === "high" ? "gain" : t.answer.confidence === "medium" ? "info" : "warning"}>
                      {t.answer.confidence} confidence
                    </Badge>
                    {t.answer.isSpeculative && <Badge variant="warning">Contains speculation</Badge>}
                  </div>
                  {t.answer.basis.length > 0 && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Based on</summary>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4">
                        {t.answer.basis.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {t.answer.dataLimitations.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                      {t.answer.dataLimitations.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <label htmlFor="analyst-question" className="sr-only">
          Ask about your trading records
        </label>
        <Textarea
          id="analyst-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Ask about your holdings, trades or recorded prices…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(question);
            }
          }}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{question.length}/500 · Enter to send, Shift+Enter for a new line</span>
          <Button type="submit" size="sm" disabled={pending || question.trim().length < 3}>
            <Send />
            {pending ? "Thinking…" : "Ask"}
          </Button>
        </div>
      </form>
    </div>
  );
}
