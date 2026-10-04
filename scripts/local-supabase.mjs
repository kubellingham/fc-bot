#!/usr/bin/env node
/**
 * Local Supabase stack manager (Docker). Used when the Supabase CLI is not available.
 *
 *   node scripts/local-supabase.mjs start    # start containers, apply migrations, print env
 *   node scripts/local-supabase.mjs migrate  # apply supabase/migrations/*.sql in order
 *   node scripts/local-supabase.mjs env      # print the env vars for .env.local
 *   node scripts/local-supabase.mjs stop     # stop containers (keeps nothing: volumes are anonymous)
 *   node scripts/local-supabase.mjs reset    # stop + start from an empty database
 *   node scripts/local-supabase.mjs types    # regenerate src/lib/supabase/database.types.ts
 *
 * Secrets are generated once per checkout into supabase/local/.env.local-stack (git-ignored).
 * They only protect a database bound to 127.0.0.1 and must never be reused in production.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { API_PORT, DB_PORT, keys, loadOrCreateSecrets, localDir, root } from "./local-supabase-lib.mjs";

const composeFile = path.join(localDir, "docker-compose.yml");
const migrationsDir = path.join(root, "supabase", "migrations");

function compose(args, secrets, opts = {}) {
  const result = spawnSync("docker", ["compose", "-f", composeFile, ...args], {
    stdio: opts.capture ? "pipe" : "inherit",
    encoding: "utf8",
    env: { ...process.env, ...secrets, API_PORT, DB_PORT },
  });
  if (result.status !== 0 && !opts.allowFailure) {
    throw new Error(`docker compose ${args.join(" ")} failed\n${result.stderr ?? ""}`);
  }
  return result.stdout ?? "";
}

function psql(secrets, sql, { file } = {}) {
  const args = ["compose", "-f", composeFile, "exec", "-T", "db", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-q"];
  if (!file) args.push("-c", sql);
  return execFileSync("docker", args, {
    input: file ? readFileSync(file) : undefined,
    env: { ...process.env, ...secrets, API_PORT, DB_PORT },
    encoding: "utf8",
  });
}

async function waitFor(url, label, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

async function waitForAuthSchema(secrets) {
  const start = Date.now();
  while (Date.now() - start < 120_000) {
    try {
      // GoTrue creates auth.identities in its own migrations; wait until they have run.
      const out = psql(secrets, "select to_regclass('auth.identities') is not null and to_regclass('auth.users') is not null;");
      if (out.includes("t")) return;
    } catch {
      // database still starting
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Timed out waiting for the auth schema.");
}

function migrate(secrets) {
  psql(
    secrets,
    "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, applied_at timestamptz not null default now());",
  );
  const applied = new Set(
    psql(secrets, "copy (select version from supabase_migrations.schema_migrations) to stdout;")
      .split("\n")
      .filter(Boolean),
  );
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const version = file.split("_")[0];
    if (applied.has(version)) continue;
    process.stdout.write(`Applying ${file}… `);
    psql(secrets, "", { file: path.join(migrationsDir, file) });
    psql(secrets, `insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${file.replace(/'/g, "")}');`);
    console.log("done");
  }
  // Ask PostgREST to reload its schema cache.
  psql(secrets, "notify pgrst, 'reload schema';");
}

function printEnv(secrets) {
  const { anonKey, serviceKey } = keys(secrets);
  console.log(`
# Local Supabase stack (copy into .env.local)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${API_PORT}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${anonKey}

# For integration tests only — never configure the app with these.
SUPABASE_TEST_DB_URL=postgres://postgres:${secrets.POSTGRES_PASSWORD}@127.0.0.1:${DB_PORT}/postgres
SUPABASE_TEST_SERVICE_ROLE_KEY=${serviceKey}
`);
}

const command = process.argv[2] ?? "start";
const secrets = loadOrCreateSecrets();

switch (command) {
  case "start": {
    compose(["up", "-d", "--wait"], secrets);
    await waitFor(`http://127.0.0.1:${API_PORT}/auth/v1/health`, "auth");
    await waitForAuthSchema(secrets);
    migrate(secrets);
    await waitFor(`http://127.0.0.1:${API_PORT}/rest/v1/`, "rest");
    printEnv(secrets);
    break;
  }
  case "migrate":
    migrate(secrets);
    break;
  case "env":
    printEnv(secrets);
    break;
  case "stop":
    compose(["down", "-v"], secrets);
    break;
  case "reset":
    compose(["down", "-v"], secrets);
    compose(["up", "-d", "--wait"], secrets);
    await waitFor(`http://127.0.0.1:${API_PORT}/auth/v1/health`, "auth");
    await waitForAuthSchema(secrets);
    migrate(secrets);
    printEnv(secrets);
    break;
  case "types": {
    // Generate src/lib/supabase/database.types.ts with postgres-meta (the generator the Supabase CLI uses).
    const name = "fcmi-pgmeta";
    spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" });
    execFileSync("docker", [
      "run", "-d", "--name", name, "--network", "fcmi-supabase_default", "-p", "127.0.0.1:58080:8080",
      "-e", "PG_META_PORT=8080",
      "-e", `PG_META_DB_URL=postgres://postgres:${secrets.POSTGRES_PASSWORD}@db:5432/postgres`,
      "supabase/postgres-meta:v0.91.0",
    ]);
    try {
      await waitFor("http://127.0.0.1:58080/health", "postgres-meta");
      const res = await fetch("http://127.0.0.1:58080/generators/typescript?included_schemas=public");
      if (!res.ok) throw new Error(`Type generation failed: ${res.status}`);
      writeFileSync(path.join(root, "src", "lib", "supabase", "database.types.ts"), await res.text());
      console.log("Wrote src/lib/supabase/database.types.ts");
    } finally {
      spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" });
    }
    break;
  }
  case "psql":
    console.log(psql(secrets, process.argv.slice(3).join(" ")));
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
