"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { analyze, parseMonth, parseNumber, type Mapping } from "@/lib/analysis";
import { AiPanel } from "@/components/ai-panel";

const MAX_BYTES = 5 * 1024 * 1024;
type Dataset = { name: string; columns: string[]; rows: Record<string, string>[]; warnings: string[] };
function inferredType(rows: Record<string, string>[], column: string): string {
  const values = rows.slice(0, 100).map((row) => (row[column] ?? "").trim()).filter(Boolean);
  if (!values.length) return "empty";
  if (values.every((value) => parseMonth(value, "iso"))) return "date";
  const defaults: Mapping = { measure: column, date: "", category: "", dateFormat: "iso", unit: "", stripCurrency: false, groupSeparator: false };
  if (values.every((value) => Number.isFinite(parseNumber(value, defaults)))) return "number";
  return "text";
}

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
  const [mapping, setMapping] = useState<Mapping>({ measure: "", date: "", category: "", dateFormat: "iso", unit: "", stripCurrency: false, groupSeparator: false });
  const [analyzed, setAnalyzed] = useState(false);
  async function load(file: File) {
    setError(""); setLoading(true);
    try {
      if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a .csv file.");
      if (file.size > MAX_BYTES) throw new Error("Choose a CSV smaller than 5 MB.");
      if (!file.size) throw new Error("This file is empty.");
      const text = await file.text();
      if (text.includes("\uFFFD")) throw new Error("This CSV must use UTF-8 encoding.");
      const next = parseCsv(text, file.name);
      setDataset(next);
      setMapping({ measure: next.columns.find((column) => /amount|total|price|value/i.test(column)) ?? "", date: next.columns.find((column) => /date|time/i.test(column)) ?? "", category: next.columns.find((column) => /category|type|group/i.test(column)) ?? "", dateFormat: "iso", unit: "", stripCurrency: false, groupSeparator: false });
      setAnalyzed(false);
    } catch (cause) { setDataset(null); setError(cause instanceof Error ? cause.message : "Could not read this CSV."); }
    finally { setLoading(false); }
  }
  return <main className="min-h-screen bg-[#f7f5ef] px-5 py-10 text-[#26352f] sm:px-10"><div className="mx-auto max-w-6xl">
    <header className="mb-14 flex items-center justify-between border-b border-[#cbd2c7] pb-5"><span className="text-xl font-bold tracking-tight">✦ DataAfterlife</span><span className="text-sm text-[#647269]">Historical data, understood.</span></header>
    <section className="mb-10 max-w-3xl"><p className="mb-3 text-sm font-bold uppercase tracking-[.2em] text-[#56806a]">A second look at old records</p><h1 className="text-4xl font-semibold leading-tight sm:text-6xl">Give your forgotten CSV files a second life.</h1><p className="mt-5 max-w-2xl text-lg text-[#657168]">Bring an old export into focus. Start with a safe, local preview of the records you already have.</p></section>
    <section className="rounded-2xl border border-[#cbd2c7] bg-white p-6 shadow-sm sm:p-8" aria-label="Upload CSV"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-semibold">Open a CSV</h2><p className="mt-1 text-sm text-[#657168]">UTF-8 · up to 5 MB · 10,000 rows · 50 columns</p></div><div className="flex flex-wrap gap-3"><label className="cursor-pointer rounded-lg bg-[#285640] px-5 py-3 font-semibold text-white hover:bg-[#19422f]">Choose CSV<input className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void load(file); event.target.value = ""; }} /></label><button className="rounded-lg border border-[#9dae9f] px-5 py-3 font-semibold hover:bg-[#eef3ec]" onClick={async () => { const response = await fetch("/examples/sample-expenses.csv"); void load(new File([await response.blob()], "sample-expenses.csv", { type: "text/csv" })); }}>Try synthetic sample</button></div></div><p className="mt-5 text-sm text-[#657168]">Your file is parsed in your browser. Nothing is uploaded when you preview it. Data is cleared on reload.</p></section>
    {loading && <p className="mt-6" role="status">Reading CSV…</p>}{error && <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-800" role="alert">{error}</p>}
    {dataset && <section className="mt-8 rounded-2xl border border-[#cbd2c7] bg-white p-6 shadow-sm sm:p-8"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-[#657168]">Dataset preview</p><h2 className="text-2xl font-semibold">{dataset.name}</h2></div><p className="font-medium">{dataset.rows.length.toLocaleString()} rows · {dataset.columns.length} columns</p></div>{dataset.warnings.length > 0 && <div className="mb-5 rounded-lg bg-amber-50 p-4 text-amber-900"><h3 className="font-semibold">Parse warnings</h3><ul className="mt-2 list-inside list-disc text-sm">{dataset.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}<div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><caption className="sr-only">First ten rows of {dataset.name}</caption><thead><tr>{dataset.columns.map((column) => <th className="border-b border-[#cbd2c7] px-3 py-3 font-semibold" key={column}>{column}<span className="ml-2 rounded-full bg-[#e8eee7] px-2 py-0.5 text-xs font-normal">{inferredType(dataset.rows, column)}</span></th>)}</tr></thead><tbody>{dataset.rows.slice(0, 10).map((row, index) => <tr key={index} className="odd:bg-[#f7f8f4]">{dataset.columns.map((column) => <td className="max-w-72 truncate border-b border-[#e5e9e2] px-3 py-3" key={column} title={row[column] ?? ""}>{row[column] || <span className="text-[#9aa79c]">—</span>}</td>)}</tr>)}</tbody></table></div></section>}
    {dataset && <section className="mt-8 rounded-2xl border border-[#cbd2c7] bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-semibold">Map your columns</h2><p className="mt-2 text-sm text-[#657168]">Confirm the fields before calculating. Ambiguous dates require an explicit format.</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{(["measure", "date", "category"] as const).map((field) => <label key={field} className="text-sm font-semibold capitalize">{field === "measure" ? "Numeric measure" : `${field} (optional)`}<select className="mt-2 w-full rounded-lg border border-[#a8b9a9] bg-white p-3" value={mapping[field]} onChange={(event) => { setMapping({ ...mapping, [field]: event.target.value }); setAnalyzed(false); }}><option value="">{field === "measure" ? "Select a number column" : "None"}</option>{dataset.columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>)}<label className="text-sm font-semibold">Date format<select className="mt-2 w-full rounded-lg border border-[#a8b9a9] bg-white p-3" value={mapping.dateFormat} onChange={(event) => { setMapping({ ...mapping, dateFormat: event.target.value as Mapping["dateFormat"] }); setAnalyzed(false); }}><option value="iso">YYYY-MM-DD</option><option value="dmy">DD/MM/YYYY</option><option value="mdy">MM/DD/YYYY</option></select></label></div><div className="mt-4 flex flex-wrap gap-5 text-sm"><label>Unit label <input className="ml-2 rounded border border-[#a8b9a9] px-2 py-1" maxLength={20} value={mapping.unit} onChange={(event) => setMapping({ ...mapping, unit: event.target.value })} placeholder="optional" /></label><label><input type="checkbox" checked={mapping.stripCurrency} onChange={(event) => { setMapping({ ...mapping, stripCurrency: event.target.checked }); setAnalyzed(false); }} /> Strip leading currency symbol</label><label><input type="checkbox" checked={mapping.groupSeparator} onChange={(event) => { setMapping({ ...mapping, groupSeparator: event.target.checked }); setAnalyzed(false); }} /> Remove comma group separators</label></div><button disabled={!mapping.measure} onClick={() => setAnalyzed(true)} className="mt-6 rounded-lg bg-[#285640] px-5 py-3 font-semibold text-white disabled:opacity-50">Analyze data</button></section>}
    {dataset && analyzed && <Dashboard rows={dataset.rows} mapping={mapping} />}
  </div></main>;
}

function Dashboard({ rows, mapping }: { rows: Record<string, string>[]; mapping: Mapping }) {
  const result = analyze(rows, mapping);
  const format = (value: number) => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)}${mapping.unit ? ` ${mapping.unit}` : ""}`;
  return <section className="mt-8 space-y-6"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Total", format(result.sum)], ["Average", format(result.average)], ["Minimum", format(result.min)], ["Maximum", format(result.max)]].map(([label, value]) => <div className="rounded-xl border border-[#cbd2c7] bg-white p-5" key={label}><p className="text-sm text-[#657168]">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div><p className="rounded-xl bg-[#e8eee7] p-4 text-sm">Calculated from {result.count} valid numeric rows. {result.missing} missing and {result.invalid} invalid numeric values excluded.{mapping.date ? ` ${result.invalidDates} rows with invalid or missing dates excluded from monthly totals.` : ""} {mapping.unit ? "" : "Units not specified."}</p><div className="grid gap-6 lg:grid-cols-2"><ChartPanel title="Monthly trend" groups={result.months} kind="line" format={format} empty={mapping.date ? "No valid dates for the selected format." : "Select a date column to see a trend."} /><ChartPanel title="Category totals" groups={result.categories} kind="bar" format={format} empty={mapping.category ? "No category values available." : "Select a category column to compare groups."} /></div><AiPanel result={result} mapping={mapping} /></section>;
}

function ChartPanel({ title, groups, kind, format, empty }: { title: string; groups: { label: string; total: number }[]; kind: "line" | "bar"; format: (value: number) => string; empty: string }) {
  return <div className="rounded-2xl border border-[#cbd2c7] bg-white p-6"><h3 className="text-xl font-semibold">{title}</h3>{groups.length ? <><div className="mt-5 h-64" role="img" aria-label={`${title} chart`}><ResponsiveContainer width="100%" height="100%">{kind === "line" ? <LineChart data={groups}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip formatter={(value) => format(Number(value))} /><Line dataKey="total" stroke="#285640" strokeWidth={3} /></LineChart> : <BarChart data={groups.slice(0, 10)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip formatter={(value) => format(Number(value))} /><Bar dataKey="total" fill="#56806a" /></BarChart>}</ResponsiveContainer></div><table className="mt-4 w-full text-sm"><thead><tr><th className="py-2 text-left">{kind === "line" ? "Month" : "Category"}</th><th className="py-2 text-right">Total</th></tr></thead><tbody>{groups.slice(0, 10).map((group) => <tr key={group.label} className="border-t border-[#e5e9e2]"><td className="py-2">{group.label}</td><td className="py-2 text-right">{format(group.total)}</td></tr>)}</tbody></table></> : <p className="mt-5 text-[#657168]">{empty}</p>}</div>;
}
