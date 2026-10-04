import "server-only";
import { cache } from "react";

/** One timestamp per request, so every component renders against the same "now". */
export const getRequestTime = cache((): number => Date.now());
