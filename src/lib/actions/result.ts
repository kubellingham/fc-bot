/** Shape returned by every Server Action. Never contains stack traces or internal details. */
export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function isOk<T>(r: ActionResult<T>): r is { ok: true; data: T; message?: string } {
  return r.ok;
}
