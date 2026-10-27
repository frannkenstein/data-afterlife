"use client";

import { useState } from "react";
import Papa from "papaparse";

const MAX_BYTES = 5 * 1024 * 1024;
type Dataset = { name: string; columns: string[]; rows: Record<string, string>[]; warnings: string[] };

function parseCsv(text: string, name: string): Dataset {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: (header) => header.trim() });
  const columns = result.meta.fields ?? [];
  if (!columns.length || columns.every((column) => !column)) throw new Error("This CSV has no meaningful header columns.");
  if (columns.length > 50) throw new Error(`This CSV has ${columns.length} columns; the limit is 50.`);
  if (new Set(columns).size !== columns.length) throw new Error("Column headers must be unique.");
  if (!result.data.length) throw new Error("This CSV has no data rows.");
  if (result.data.length > 10_000) throw new Error(`This CSV has ${result.data.length} rows; the limit is 10,000.`);
  return { name, columns, rows: result.data, warnings: result.errors.map((error) => `Row ${typeof error.row === "number" ? error.row + 1 : "unknown"}: ${error.message}`).slice(0, 20) };
}

export default function Home() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function load(file: File) {
    setError(""); setLoading(true);
    try {
      if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a .csv file.");
      if (file.size > MAX_BYTES) throw new Error("Choose a CSV smaller than 5 MB.");
      if (!file.size) throw new Error("This file is empty.");
      const text = await file.text();
      if (text.includes("\uFFFD")) throw new Error("This CSV must use UTF-8 encoding.");
      setDataset(parseCsv(text, file.name));
    } catch (cause) { setDataset(null); setError(cause instanceof Error ? cause.message : "Could not read this CSV."); }
    finally { setLoading(false); }
  }
  return <main className="min-h-screen bg-[#f7f5ef] px-5 py-10 text-[#26352f] sm:px-10"><div className="mx-auto max-w-6xl">
    <header className="mb-14 flex items-center justify-between border-b border-[#cbd2c7] pb-5"><span className="text-xl font-bold tracking-tight">✦ DataAfterlife</span><span className="text-sm text-[#647269]">Historical data, understood.</span></header>
    <section className="mb-10 max-w-3xl"><p className="mb-3 text-sm font-bold uppercase tracking-[.2em] text-[#56806a]">A second look at old records</p><h1 className="text-4xl font-semibold leading-tight sm:text-6xl">Give your forgotten CSV files a second life.</h1><p className="mt-5 max-w-2xl text-lg text-[#657168]">Bring an old export into focus. Start with a safe, local preview of the records you already have.</p></section>
    <section className="rounded-2xl border border-[#cbd2c7] bg-white p-6 shadow-sm sm:p-8" aria-label="Upload CSV"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-semibold">Open a CSV</h2><p className="mt-1 text-sm text-[#657168]">UTF-8 · up to 5 MB · 10,000 rows · 50 columns</p></div><div className="flex flex-wrap gap-3"><label className="cursor-pointer rounded-lg bg-[#285640] px-5 py-3 font-semibold text-white hover:bg-[#19422f]">Choose CSV<input className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void load(file); event.target.value = ""; }} /></label><button className="rounded-lg border border-[#9dae9f] px-5 py-3 font-semibold hover:bg-[#eef3ec]" onClick={async () => { const response = await fetch("/examples/sample-expenses.csv"); void load(new File([await response.blob()], "sample-expenses.csv", { type: "text/csv" })); }}>Try synthetic sample</button></div></div><p className="mt-5 text-sm text-[#657168]">Your file is parsed in your browser. Nothing is uploaded when you preview it. Data is cleared on reload.</p></section>
    {loading && <p className="mt-6" role="status">Reading CSV…</p>}{error && <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-800" role="alert">{error}</p>}
    {dataset && <section className="mt-8 rounded-2xl border border-[#cbd2c7] bg-white p-6 shadow-sm sm:p-8"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-[#657168]">Dataset preview</p><h2 className="text-2xl font-semibold">{dataset.name}</h2></div><p className="font-medium">{dataset.rows.length.toLocaleString()} rows · {dataset.columns.length} columns</p></div>{dataset.warnings.length > 0 && <div className="mb-5 rounded-lg bg-amber-50 p-4 text-amber-900"><h3 className="font-semibold">Parse warnings</h3><ul className="mt-2 list-inside list-disc text-sm">{dataset.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}<div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><caption className="sr-only">First ten rows of {dataset.name}</caption><thead><tr>{dataset.columns.map((column) => <th className="border-b border-[#cbd2c7] px-3 py-3 font-semibold" key={column}>{column}</th>)}</tr></thead><tbody>{dataset.rows.slice(0, 10).map((row, index) => <tr key={index} className="odd:bg-[#f7f8f4]">{dataset.columns.map((column) => <td className="max-w-72 truncate border-b border-[#e5e9e2] px-3 py-3" key={column} title={row[column] ?? ""}>{row[column] || <span className="text-[#9aa79c]">—</span>}</td>)}</tr>)}</tbody></table></div></section>}
  </div></main>;
}
