import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";

export const metadata: Metadata = { title: "Privacy & data" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Brand />
      <article className="mt-10 grid gap-6 text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy & data</h1>
        <section className="grid gap-2">
          <h2>What we store</h2>
          <p>
            Your email address (for sign-in, handled by Supabase Auth) and the records you create: players, purchases, sales,
            price observations, watchlist targets, alerts, coin adjustments, settings and saved AI briefings. Passwords are
            managed by Supabase Auth and are never stored in application tables.
          </p>
        </section>
        <section className="grid gap-2">
          <h2>What we never store</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>EA account names, passwords, tokens or any game credentials.</li>
            <li>Payment details.</li>
          </ul>
        </section>
        <section className="grid gap-2">
          <h2>Who can see your data</h2>
          <p>
            Only you. Every table is protected by row level security in the database, so each request can only read or change
            rows that belong to the signed-in account.
          </p>
        </section>
        <section className="grid gap-2">
          <h2>AI analyst</h2>
          <p>
            When you request an AI briefing or ask a question, a summary of your own records (player names, prices, trades and
            computed metrics — not your email) is sent to Anthropic&apos;s API to generate the answer. Nothing is sent unless you
            ask. Responses are analysis of your history, not financial advice and not guarantees.
          </p>
        </section>
        <section className="grid gap-2">
          <h2>Your controls</h2>
          <p>
            Export all of your data as CSV or JSON from <Link href="/data" className="underline">Import & export</Link>. Delete
            your account from <Link href="/settings" className="underline">Settings</Link>; this permanently removes your account
            and every record linked to it.
          </p>
        </section>
        <section className="grid gap-2">
          <h2>Not affiliated with EA</h2>
          <p>
            FC Market Intelligence is an independent companion tool. It does not connect to EA services, automate any in-game
            action or access the Transfer Market.
          </p>
        </section>
      </article>
    </div>
  );
}
