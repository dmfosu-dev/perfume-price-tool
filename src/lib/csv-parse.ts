// RFC 4180 CSV reader. Pairs with src/lib/csv.ts (the writer) and is kept
// dependency-free and side-effect-free so it can be unit-tested directly.

/**
 * Splits CSV text into rows of fields. Handles quoted fields containing commas,
 * newlines and doubled quotes, plus CRLF or LF endings and a leading UTF-8 BOM
 * (which Excel writes, and which would otherwise corrupt the first header).
 */
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index++;
        continue;
      }
      field += char;
      index++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      index++;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      index++;
      continue;
    }
    if (char === "\r" || char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      index += char === "\r" && input[index + 1] === "\n" ? 2 : 1;
      continue;
    }

    field += char;
    index++;
  }

  // Trailing field/row, unless the file simply ended with a newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value.trim() !== ""));
}

/// Header matching is case- and space-insensitive, so "SKU Code", "sku_code"
/// and "skucode" all work — spreadsheets mangle these constantly.
export function normaliseHeader(value: string): string {
  return value
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export type HeaderMap = Record<string, number>;

export function mapHeaders(header: readonly string[]): HeaderMap {
  const map: HeaderMap = {};
  header.forEach((name, index) => {
    const key = normaliseHeader(name);
    // First occurrence wins; a duplicated column is a mistake, not intent.
    if (key !== "" && !(key in map)) map[key] = index;
  });
  return map;
}

export function cell(row: readonly string[], map: HeaderMap, key: string): string {
  const index = map[key];
  if (index === undefined) return "";
  // Strip the tab the writer adds to neutralise spreadsheet formulas.
  return (row[index] ?? "").replace(/^\t/, "").trim();
}
