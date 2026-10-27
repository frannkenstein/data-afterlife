import Papa from "papaparse";

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 10_000;
export const MAX_COLUMNS = 50;
export type Dataset = { name: string; columns: string[]; rows: Record<string, string>[]; warnings: string[] };

export function parseCsvText(text: string, name: string): Dataset {
  const rows: Record<string, string>[] = [];
  const warnings: string[] = [];
  let columns: string[] = [];
  let failure = "";

  Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
    step(result, parser) {
      if (!columns.length) {
        columns = result.meta.fields ?? [];
        if (!columns.length || columns.every((column) => !column)) failure = "This CSV has no meaningful header columns.";
        else if (columns.length > MAX_COLUMNS) failure = `This CSV has more than ${MAX_COLUMNS} columns; the limit is ${MAX_COLUMNS}.`;
        if (failure) { parser.abort(); return; }
      }
      if (rows.length >= MAX_ROWS) { failure = `This CSV has more than ${MAX_ROWS.toLocaleString("en-US")} rows; the limit is ${MAX_ROWS.toLocaleString("en-US")}.`; parser.abort(); return; }
      rows.push(result.data);
      for (const error of result.errors) {
        if (warnings.length < 20) warnings.push(`Row ${typeof error.row === "number" ? error.row + 1 : "unknown"}: ${error.message}`);
      }
    },
  });

  if (failure) throw new Error(failure);
  if (!columns.length || columns.every((column) => !column)) throw new Error("This CSV has no meaningful header columns.");
  if (!rows.length) throw new Error("This CSV has no data rows.");
  return { name, columns, rows, warnings };
}
