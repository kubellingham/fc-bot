/**
 * RFC 4180 CSV writer with spreadsheet formula-injection protection: text cells
 * starting with = + - @ tab or CR are prefixed with an apostrophe so Excel /
 * Sheets treat them as text. Numbers are written as-is (negative profits stay numeric).
 */
export type CsvValue = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  let text = value;
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns: readonly string[], rows: readonly Record<string, CsvValue>[]): string {
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(","));
  // Leading BOM so Excel opens UTF-8 (accented player names) correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}
