/**
 * Shared helpers for the local Supabase stack: secret generation and API keys.
 * Imported by scripts/local-supabase.mjs and the integration tests.
 */
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const root = path.resolve(import.meta.dirname, "..");
export const localDir = path.join(root, "supabase", "local");
export const stackEnvFile = path.join(localDir, ".env.local-stack");
export const API_PORT = process.env.API_PORT ?? "54321";
export const DB_PORT = process.env.DB_PORT ?? "54322";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

export function signJwt(payload, secret) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function loadOrCreateSecrets() {
  if (existsSync(stackEnvFile)) {
    return Object.fromEntries(
      readFileSync(stackEnvFile, "utf8")
        .split("\n")
        .filter((line) => line.includes("="))
        .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
    );
  }
  const secrets = {
    POSTGRES_PASSWORD: randomBytes(18).toString("base64url"),
    JWT_SECRET: randomBytes(32).toString("base64url"),
  };
  writeFileSync(stackEnvFile, Object.entries(secrets).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", { mode: 0o600 });
  return secrets;
}

export function keys(secrets) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 10 * 365 * 24 * 3600;
  return {
    anonKey: signJwt({ iss: "supabase-local", role: "anon", iat, exp }, secrets.JWT_SECRET),
    serviceKey: signJwt({ iss: "supabase-local", role: "service_role", iat, exp }, secrets.JWT_SECRET),
  };
}

export function stackConfig() {
  const secrets = loadOrCreateSecrets();
  const { anonKey, serviceKey } = keys(secrets);
  return {
    url: `http://127.0.0.1:${API_PORT}`,
    anonKey,
    serviceKey,
    dbUrl: `postgres://postgres:${secrets.POSTGRES_PASSWORD}@127.0.0.1:${DB_PORT}/postgres`,
  };
}
