"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

/** Applies the theme saved in the user's settings once per session load. */
export function ThemeSync({ theme, persisted }: { theme: "system" | "dark" | "light"; persisted: boolean }) {
  const { setTheme } = useTheme();
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || !persisted) return;
    applied.current = true;
    setTheme(theme);
  }, [theme, persisted, setTheme]);
  return null;
}
