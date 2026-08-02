function escapeCsvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** metaLines (e.g. "Generated: ...", "Range: ...") print as plain text above the header row, followed by a blank line. */
export function downloadCsv(filename: string, headers: string[], rows: unknown[][], metaLines: string[] = []): void {
  const meta = metaLines.length ? [...metaLines, ""] : [];
  const lines = [...meta, headers.join(","), ...rows.map((row) => row.map(escapeCsvCell).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
