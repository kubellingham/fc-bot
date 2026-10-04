import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ImportWizard } from "@/components/features/import-wizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Import & export" };

const EXPORTS = [
  { entity: "players", label: "Players", hint: "Your catalog" },
  { entity: "holdings", label: "Holdings", hint: "One row per open purchase" },
  { entity: "trades", label: "Trades", hint: "Every sale + unsold remainders, with tax and profit" },
  { entity: "observations", label: "Price observations", hint: "All recorded prices" },
  { entity: "adjustments", label: "Coin adjustments", hint: "Ledger entries" },
];

export default function DataPage() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Import & export" description="Bring in records from a spreadsheet, or take all of your data with you." />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Import from CSV</CardTitle>
          <CardDescription className="text-xs">
            Every row is validated and shown in a preview first. Nothing is saved until you confirm.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportWizard />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Export</CardTitle>
          <CardDescription className="text-xs">CSV files use the same columns as the importer.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXPORTS.map((e) => (
            <a
              key={e.entity}
              href={`/api/export/${e.entity}`}
              download
              className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Download className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="block font-medium">{e.label} (CSV)</span>
                <span className="text-xs text-muted-foreground">{e.hint}</span>
              </span>
            </a>
          ))}
          <Button asChild variant="outline" className="h-auto justify-start p-3">
            <a href="/api/export/all" download>
              <Download />
              <span className="text-left">
                <span className="block font-medium">Everything (JSON)</span>
                <span className="text-xs font-normal text-muted-foreground">Full account export</span>
              </span>
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
