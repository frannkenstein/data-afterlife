"use client";

import { useEffect, useState } from "react";
import { answerQuestion, makePacket, queryPlanSchema, type QueryPlan } from "@/lib/ai";
import type { Analysis, Mapping } from "@/lib/analysis";
import { runCsvWorker } from "@/lib/worker-client";
import type { GenericPlan, QueryResult } from "@/lib/query";
import { evidenceTarget } from "@/lib/story";

type Props = { result: Analysis; mapping: Mapping };
type AskProps = Props & { rows: Record<string, string>[]; columns: string[] };
type Insight = { text: string; evidenceIds: string[] };

async function request(path: string, body: object) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Local AI request failed.");
  return data;
}

export function AskDataAfterlife({ result, mapping, rows, columns }: AskProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<QueryResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(value = question) {
    if (!value.trim()) return;
    setBusy(true); setMessage(""); setAnswer(null); setQuestion(value);
    try {
      const data = await request("/api/query-plan", { question: value, hasDate: !!mapping.date, hasCategory: !!mapping.category, columns, measureColumn: mapping.measure, dateColumn: mapping.date });
      const plan: QueryPlan = queryPlanSchema.parse(data.plan);
      if (plan.intent === "aggregate" || plan.intent === "ranked_rows" || plan.intent === "group") {
        setAnswer(await runCsvWorker<QueryResult>({ kind: "query", rows, columns, mapping, plan: plan as GenericPlan }));
      } else {
        setAnswer({ ...answerQuestion(plan, result, mapping), details: [] });
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not interpret this question."); }
    finally { setBusy(false); }
  }

  const suggestions = [
    `What is the total of ${mapping.measure}?`,
    `What is the average of ${mapping.measure}?`,
    `What is the median ${mapping.measure}?`,
    `What is the average of the three lowest ${mapping.measure} values?`,
    ...(mapping.date ? [`Which month had the highest ${mapping.measure}?`] : []),
    ...(mapping.date ? [`Which month had the second highest ${mapping.measure}?`] : []),
    ...(mapping.category ? [`Which ${mapping.category} had the highest total ${mapping.measure}?`] : []),
  ];

  return <section className="rounded-2xl border border-[#cbd2c7] bg-white p-6" aria-labelledby="ask-heading">
    <h3 id="ask-heading" className="text-xl font-semibold">Ask DataAfterlife</h3>
    <p className="mt-2 text-sm text-[#657168]">Ask about totals, filters, rankings, groups, or individual values. Gemma interprets the question using column names; the browser calculates from the rows. Some questions cannot be answered from the CSV.</p>
    <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void ask(); }}><input className="min-w-0 flex-1 rounded-lg border border-[#a8b9a9] p-3" aria-label="Question about this dataset" maxLength={300} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={`What is the total of ${mapping.measure}?`} /><button disabled={busy} className="rounded-lg bg-[#285640] px-4 font-semibold text-white disabled:opacity-50">Ask</button></form>
    <div className="mt-3 flex flex-wrap gap-2">{suggestions.map((suggestion) => <button key={suggestion} className="rounded-full border border-[#a8b9a9] px-3 py-1 text-sm" onClick={() => void ask(suggestion)}>{suggestion}</button>)}</div>
    {answer && <div className="mt-5 rounded-lg bg-[#e8eee7] p-4"><p className="text-xl font-semibold">{answer.answer}</p><p className="mt-2 text-sm">{answer.breakdown}</p>{(answer.details?.length ?? 0) > 0 && <dl className="mt-3 grid gap-1 text-sm">{answer.details.map((item, index) => <div key={`${item.label}-${index}`} className="flex justify-between gap-4 border-t border-[#ced8cd] py-1"><dt>{item.label}</dt><dd className="font-medium">{item.value}</dd></div>)}</dl>}</div>}
    {message && <p className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-900" role="status">{message}</p>}
  </section>;
}

export function AiInsights({ result, mapping }: Props) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [modelStatus, setModelStatus] = useState<{ available: boolean; model: string } | null>(null);
  const [statusRevision, setStatusRevision] = useState(0);
  const packet = makePacket(result);

  useEffect(() => {
    let active = true;
    fetch("/api/model-status").then((response) => response.json()).then((status) => { if (active) setModelStatus(status); }).catch(() => { if (active) setModelStatus({ available: false, model: "gemma3:4b" }); });
    return () => { active = false; };
  }, [statusRevision]);

  async function loadInsights() {
    setBusy(true); setMessage("");
    try {
      const data = await request("/api/insights", packet);
      setInsights(data.insights);
      if (!data.insights.length) setMessage("Could not verify an AI insight from these facts.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Local AI request failed."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-[#cbd2c7] bg-white p-6" aria-labelledby="insights-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 id="insights-heading" className="text-xl font-semibold">What this data remembers</h3><span className={`rounded-full px-3 py-1 text-xs font-semibold ${modelStatus?.available ? "bg-[#e3f1e7] text-[#285640]" : "bg-[#f5eee1] text-[#755a32]"}`}>{modelStatus === null ? "Checking local model…" : modelStatus.available ? `${modelStatus.model} ready` : `${modelStatus.model} offline`}</span></div>
    <p className="mt-2 text-sm text-[#657168]">Local Gemma adds context to verified turning points; every figure is calculated in your browser and linked to its evidence. The model sees only aggregate facts and category labels, which may still be sensitive.</p>
    <details className="mt-4 text-sm print:hidden"><summary className="cursor-pointer font-semibold">Preview facts sent to local Ollama</summary><pre className="mt-2 max-h-48 overflow-auto rounded bg-[#f3f5ef] p-3 text-xs">{JSON.stringify(packet, null, 2)}</pre></details>
    <button disabled={busy || !modelStatus?.available} onClick={loadInsights} className="mt-4 rounded-lg bg-[#285640] px-4 py-2 font-semibold text-white disabled:opacity-50 print:hidden">{busy ? "Recovering story…" : "Recover its story with Gemma"}</button>
    {modelStatus && !modelStatus.available && <p className="mt-2 text-sm text-[#755a32] print:hidden">To enable the story, run <code>ollama pull {modelStatus.model}</code> and start Ollama. <button className="font-semibold underline" onClick={() => { setModelStatus(null); setStatusRevision((value) => value + 1); }}>Check again</button></p>}
    {insights.length > 0 && <ol className="mt-5 grid gap-3 md:grid-cols-2">{insights.map((insight, index) => <li key={index} className="rounded-xl border border-[#d5dfd2] bg-[#f3f5ef] p-4"><p className="text-xs font-bold uppercase tracking-widest text-[#56806a]">Memory {index + 1}</p><p className="mt-2 text-lg leading-snug">{insight.text}{mapping.unit && <span className="ml-1 text-sm text-[#657168]">({mapping.unit})</span>}</p><div className="mt-3 flex flex-wrap gap-2">{insight.evidenceIds.map((id) => { const fact = packet.facts.find((item) => item.id === id); return fact ? <a key={id} href={evidenceTarget(fact)} className="rounded-full border border-[#a8b9a9] px-3 py-1 text-xs font-semibold text-[#285640] hover:bg-[#e8eee7]">Evidence {id} · view {evidenceTarget(fact) === "#monthly-trend" ? "trend" : evidenceTarget(fact) === "#category-totals" ? "category" : "summary"}</a> : null; })}</div></li>)}</ol>}
    {message && <p className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-900" role="status">{message}</p>}
  </section>;
}
