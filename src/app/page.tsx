import Link from "next/link";
import {
  Bell,
  BotMessageSquare,
  ChartNoAxesCombined,
  FileSpreadsheet,
  LineChart,
  Lock,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { TaxCalculator } from "@/components/landing/tax-calculator";
import { Button } from "@/components/ui/button";
import { getAuth } from "@/lib/data/auth";

const FEATURES = [
  {
    icon: Wallet,
    title: "Portfolio & coin ledger",
    body: "Every copy you hold, average cost, realized and unrealized P&L — with available coins and invested capital kept strictly separate.",
  },
  {
    icon: LineChart,
    title: "Price history you control",
    body: "Record the prices you see in game and chart them over time. Every price shows its age; nothing pretends to be live.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Performance analytics",
    body: "Daily, weekly and monthly P&L, win rate, holding time, capital utilisation and your best and worst players.",
  },
  {
    icon: Bell,
    title: "Targets & alerts",
    body: "Buy and sell targets on your watchlist, plus alerts for price levels and percentage moves — in-app only.",
  },
  {
    icon: BotMessageSquare,
    title: "AI analyst, grounded",
    body: "Ask questions about your own records. Answers cite your data, state their confidence and never invent prices.",
  },
  {
    icon: FileSpreadsheet,
    title: "Import & export",
    body: "CSV import with a validated preview before anything is saved, and full exports of your data at any time.",
  },
];

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const [auth, { deleted }] = await Promise.all([getAuth(), searchParams]);
  const signedIn = Boolean(auth);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Brand />
        <nav className="flex items-center gap-2">
          {signedIn ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="flex-1">
        {deleted && (
          <p role="status" className="mx-auto mb-4 max-w-6xl px-4 text-sm text-muted-foreground sm:px-6">
            Your account and all of its data have been deleted.
          </p>
        )}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-20">
          <div className="grid gap-6">
            <p className="w-fit rounded-full border px-3 py-1 text-xs text-muted-foreground">
              Companion analytics for EA Sports FC Ultimate Team
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Know your real profit — <span className="text-primary">after tax</span>, on every card.
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              FC Market Intelligence is a private trading journal and analytics terminal for your Ultimate Team trades. Track
              holdings, record prices, measure performance and get grounded AI insights. You make every trade yourself, in game.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={signedIn ? "/dashboard" : "/signup"}>{signedIn ? "Open dashboard" : "Create a free account"}</Link>
              </Button>
              {!signedIn && (
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">Sign in</Link>
                </Button>
              )}
            </div>
          </div>
          <TaxCalculator />
        </section>

        <section aria-labelledby="features" className="border-y bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 id="features" className="text-2xl font-semibold tracking-tight">
              Everything a manual trader needs
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feat) => (
                <div key={feat.title} className="grid gap-2 rounded-xl border bg-card p-5">
                  <feat.icon className="size-5 text-primary" aria-hidden="true" />
                  <h3 className="font-medium">{feat.title}</h3>
                  <p className="text-sm text-muted-foreground">{feat.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="compliance" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="grid content-start gap-3">
              <ShieldCheck className="size-6 text-primary" aria-hidden="true" />
              <h2 id="compliance" className="text-2xl font-semibold tracking-tight">
                Built to stay on the right side of the rules
              </h2>
              <p className="text-muted-foreground">
                This is an analytics companion, not a bot. It cannot buy, sell, bid or list anything, and it never connects to
                the game or the Companion App.
              </p>
            </div>
            <ul className="grid gap-3 text-sm">
              {[
                "We never ask for, store or use your EA account or credentials.",
                "No automation of purchases, sales, bids or listings — every transaction is yours to make.",
                "No scraping of protected endpoints and no live market feed: prices are the ones you record.",
                "Market insights are analysis of your own history, never a promise of profit.",
              ].map((line) => (
                <li key={line} className="flex gap-3 rounded-lg border bg-card p-3">
                  <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
          <p>FC Market Intelligence is an independent tool and is not affiliated with or endorsed by Electronic Arts.</p>
          <Link href="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">
            Privacy & data
          </Link>
        </div>
      </footer>
    </div>
  );
}
