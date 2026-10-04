import { Database } from "lucide-react";
import { Brand } from "@/components/brand";

export function SetupRequired() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4 py-12">
      <Brand />
      <div className="grid gap-3 rounded-xl border bg-card p-6">
        <Database className="size-6 text-primary" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Database connection required</h1>
        <p className="text-sm text-muted-foreground">
          FC Market Intelligence stores your data in Supabase. Set <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, apply the migrations in{" "}
          <code className="rounded bg-muted px-1">supabase/migrations</code>, then restart the app. The README walks through it.
        </p>
      </div>
    </main>
  );
}
