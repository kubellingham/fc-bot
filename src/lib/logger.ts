import "server-only";

/**
 * Minimal structured logger. Writes one JSON line per event so hosting logs
 * (Vercel) are searchable. Never pass free-text user content, tokens, emails or
 * request bodies — only identifiers, codes and counts. Keys that look sensitive
 * are redacted defensively.
 */
type Level = "info" | "warn" | "error";
type Fields = Record<string, string | number | boolean | null | undefined>;

const SENSITIVE = /pass(word)?|token|secret|key|authorization|cookie|email|notes?|question|content/i;

function write(level: Level, event: string, fields: Fields = {}) {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    safe[k] = SENSITIVE.test(k) ? "[redacted]" : typeof v === "string" ? v.slice(0, 200) : v;
  }
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...safe });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  error: (event: string, fields?: Fields) => write("error", event, fields),
};

export function errorFields(error: unknown): Fields {
  if (error && typeof error === "object") {
    const e = error as { name?: unknown; code?: unknown; status?: unknown };
    return {
      errorName: typeof e.name === "string" ? e.name : undefined,
      errorCode: typeof e.code === "string" || typeof e.code === "number" ? String(e.code) : undefined,
      status: typeof e.status === "number" ? e.status : undefined,
    };
  }
  return { errorName: typeof error };
}
