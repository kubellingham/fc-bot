import type { Metadata } from "next";
import Link from "next/link";
import { Download, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DeleteAccountDialog } from "@/components/features/delete-account";
import { SettingsForm } from "@/components/features/settings-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/data/auth";
import { getSettings } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [{ user }, settings] = await Promise.all([requireAuth(), getSettings()]);
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title="Settings" description={user.email ? `Signed in as ${user.email}` : undefined} />
      <SettingsForm settings={settings} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Your data</CardTitle>
          <CardDescription className="text-xs">Download everything you have stored, as CSV or JSON.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/data">
              <Download />
              Import & export
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href="/api/export/all" download>
              Download full JSON export
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <p>Your records are visible only to your account, enforced by row level security in the database.</p>
          <p>We never ask for or store EA account credentials, and nothing here can trade on your behalf.</p>
          <p>
            AI features send a summary of your own records to Anthropic only when you request them.{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              Read the privacy notes
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Delete account</CardTitle>
          <CardDescription className="text-xs">Permanently delete your account and all associated data.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog />
        </CardContent>
      </Card>
    </div>
  );
}
