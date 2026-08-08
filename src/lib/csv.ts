// RFC 4180 CSV writing. Kept dependency-free and separate from the export query
// so the escaping rules can be unit-tested on their own.

/**
 * A field needs quoting if it contains a comma, quote, or newline. Quotes inside
 * are doubled. A leading =, +, - or @ is also prefixed with a tab: spreadsheets
 * otherwise treat such a value as a formula, which is both wrong and a known
 * injection vector when the data came from user input (vendor names here).
 */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `\t${text}`;

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function csvRow(values: readonly unknown[]): string {
  return values.map(csvField).join(",");
}

/// CRLF line endings per RFC 4180, and a UTF-8 BOM so Excel on Windows reads
/// accented and Arabic text correctly instead of mojibake.
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines = [csvRow(header), ...rows.map(csvRow)];
  return `﻿${lines.join("\r\n")}\r\n`;
}
