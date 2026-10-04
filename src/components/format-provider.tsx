"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createFormatter, DEFAULT_FORMAT_PREFS, type FormatPrefs, type Formatter } from "@/lib/format";

const FormatContext = createContext<FormatPrefs>(DEFAULT_FORMAT_PREFS);
const NowContext = createContext<number>(0);

/**
 * Makes the signed-in user's number/date preferences available to client
 * components, along with a shared "now" captured on the server so relative
 * times ("3h ago") render identically on server and client.
 */
export function FormatProvider({ prefs, now, children }: { prefs: FormatPrefs; now: number; children: React.ReactNode }) {
  return (
    <FormatContext.Provider value={prefs}>
      <NowContext.Provider value={now}>{children}</NowContext.Provider>
    </FormatContext.Provider>
  );
}

export function useFormatter(): Formatter {
  const prefs = useContext(FormatContext);
  return useMemo(() => createFormatter(prefs), [prefs]);
}

/** Current time in ms: the server's render time first, then refreshed every minute. */
export function useNow(): number {
  const initial = useContext(NowContext);
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now || initial;
}
