"use client";

import Papa from "papaparse";
import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Download, FileUp, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { commitImport, previewImport, type ImportPreview, type ImportResult } from "@/lib/actions/import";
import { IMPORT_COLUMNS, MAX_IMPORT_ROWS, type ImportEntity } from "@/lib/csv/definitions";
import { toCsv } from "@/lib/csv/write";

const MAX_BYTES = 2 * 1024 * 1024;
const ENTITY_LABELS: Record<ImportEntity, string> = {
  players: "Players",
  holdings: "Holdings (open purchases)",
  trades: "Trades (purchases with optional sale)",
  observations: "Price observations",
};
const STATUS_BADGE = {
  valid: { label: "Ready", variant: "gain" },
  invalid: { label: "Invalid", variant: "loss" },
  duplicate: { label: "Skipped", variant: "secondary" },
} as const;

function downloadTemplate(entity: ImportEntity) {
  const cols = IMPORT_COLUMNS[entity];
  const columns = [...cols.required, ...cols.optional];
  const example = Object.fromEntries(columns.map((c, i) => [c, cols.example[i] ?? ""]));
  const blob = new Blob([toCsv(columns, [example])], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fc-market-${entity}-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportWizard() {
  const [entity, setEntity] = useState<ImportEntity>("players");
  const [file, setFile] = useState<{ name: string; rows: Record<string, string>[]; headers: string[] } | null>(null);
  const [createMissing, setCreateMissing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setShowAll(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFile = (f: File | undefined) => {
    setPreview(null);
    setResult(null);
    setError(null);
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError("That file is larger than 2 MB. Split it into smaller files.");
      return;
    }
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.replace(/^﻿/, "").trim(),
      complete: (res) => {
        if (res.errors.length > 0 && res.data.length === 0) {
          setError(`Couldn't read that CSV: ${res.errors[0].message}`);
          return;
        }
        if (res.data.length === 0) {
          setError("The file has no data rows.");
          return;
        }
        if (res.data.length > MAX_IMPORT_ROWS) {
          setError(`The file has ${res.data.length} rows; import at most ${MAX_IMPORT_ROWS} at a time.`);
          return;
        }
        // Keep only string cells; strip formula-guard apostrophes added by our own exports.
        const rows = res.data.map((r) =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" ? v.replace(/^'(?=[=+\-@])/, "").slice(0, 2000) : ""])),
        );
        setFile({ name: f.name, rows, headers: res.meta.fields ?? [] });
      },
      error: (e) => setError(`Couldn't read that file: ${e.message}`),
    });
  };

  const request = () => ({ entity, rows: file!.rows, headers: file!.headers, createMissingPlayers: createMissing });

  const runPreview = () =>
    start(async () => {
      setError(null);
      try {
        const r = await previewImport(request());
        if (!r) return;
        if (r.ok) setPreview(r.data);
        else setError(r.error);
      } catch {
        setError("We couldn't reach the server. Please try again.");
      }
    });

  const runCommit = () =>
    start(async () => {
      setError(null);
      try {
        const r = await commitImport(request());
        if (!r) return;
        if (r.ok) {
          setResult(r.data);
          setPreview(null);
          toast.success(`Imported ${r.data.imported} row${r.data.imported === 1 ? "" : "s"}.`);
        } else setError(r.error);
      } catch {
        setError("We couldn't reach the server. Please try again.");
      }
    });

  const cols = IMPORT_COLUMNS[entity];
  const shownRows = preview ? (showAll ? preview.rows : preview.rows.filter((r) => r.status !== "valid" || r.messages.length > 0).concat(preview.rows.filter((r) => r.status === "valid" && r.messages.length === 0)).slice(0, 200)) : [];

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-[18rem_1fr] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="import-entity">What are you importing?</Label>
          <Select
            value={entity}
            onValueChange={(v) => {
              setEntity(v as ImportEntity);
              reset();
            }}
          >
            <SelectTrigger id="import-entity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ENTITY_LABELS) as ImportEntity[]).map((e) => (
                <SelectItem key={e} value={e}>
                  {ENTITY_LABELS[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground">
          Required columns: <span className="font-medium text-foreground">{cols.required.join(", ")}</span>
          {cols.optional.length > 0 && <> · optional: {cols.optional.join(", ")}</>}. Dates like 2026-09-01 18:30 use your time
          zone setting; ISO timestamps with an offset are also accepted.{" "}
          <button type="button" onClick={() => downloadTemplate(entity)} className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
            <Download className="size-3" aria-hidden="true" />
            Download template
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label
          htmlFor="import-file"
          className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm hover:bg-accent/50 focus-within:ring-2 focus-within:ring-ring"
        >
          <FileUp className="size-4 text-muted-foreground" aria-hidden="true" />
          {file ? (
            <span>
              {file.name} · {file.rows.length} rows
            </span>
          ) : (
            <span>Choose a CSV file (max 2 MB, {MAX_IMPORT_ROWS.toLocaleString()} rows)</span>
          )}
          <input
            id="import-file"
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        {entity !== "players" && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={createMissing} onCheckedChange={(v) => { setCreateMissing(v); setPreview(null); }} aria-label="Create missing players" />
            Create players that don&apos;t exist yet
          </label>
        )}
        <div className="flex gap-2 sm:ml-auto">
          {file && (
            <Button variant="ghost" size="sm" onClick={reset} disabled={pending}>
              <X />
              Cancel
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={runPreview} disabled={!file || pending}>
            {pending && !preview ? "Checking…" : "Preview"}
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {result && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-gain/30 bg-gain/5 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 size-5 text-gain" aria-hidden="true" />
          <div>
            <p className="font-medium">Import complete</p>
            <p className="text-muted-foreground">
              {result.imported} imported · {result.skipped} skipped
              {result.playersCreated > 0 && ` · ${result.playersCreated} players created`}. Existing records were not changed.
            </p>
            <Button variant="link" size="sm" className="h-auto px-0" onClick={reset}>
              Import another file
            </Button>
          </div>
        </div>
      )}

      {preview && (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="gain">{preview.counts.valid} ready</Badge>
            <Badge variant="loss">{preview.counts.invalid} invalid</Badge>
            <Badge variant="secondary">{preview.counts.duplicate} duplicates skipped</Badge>
            {preview.playersToCreate.length > 0 && (
              <span className="text-xs text-muted-foreground">Will create {preview.playersToCreate.length} new players.</span>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowAll((s) => !s)}>
                {showAll ? "Show issues first" : "Show all rows"}
              </Button>
              <Button size="sm" onClick={runCommit} disabled={pending || preview.counts.valid === 0}>
                <Upload />
                {pending ? "Importing…" : `Import ${preview.counts.valid} row${preview.counts.valid === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Nothing has been saved yet. Invalid and duplicate rows will be skipped; existing records are never overwritten.
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Line</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownRows.map((r) => (
                  <TableRow key={r.line}>
                    <TableCell className="text-muted-foreground">{r.line}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[r.status].variant}>{STATUS_BADGE[r.status].label}</Badge>
                    </TableCell>
                    <TableCell className="max-w-48 truncate">{r.label}</TableCell>
                    <TableCell className="whitespace-normal text-xs text-muted-foreground">{r.messages.join(" ") || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {preview.rows.length > shownRows.length && (
            <p className="text-xs text-muted-foreground">Showing {shownRows.length} of {preview.rows.length} rows.</p>
          )}
        </div>
      )}
    </div>
  );
}
