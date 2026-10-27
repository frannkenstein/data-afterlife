"use client";

import { useState } from "react";
import { answerQuestion, makePacket, queryPlanSchema, type QueryPlan } from "@/lib/ai";
import type { Analysis, Mapping } from "@/lib/analysis";

type Props = { result: Analysis; mapping: Mapping };
type Insight = { text: string; evidenceIds: string[] };

async function request(path: string, body: object) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Local AI request failed.");
  return data;
}

export function AskDataAfterlife({ result, mapping }: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ answer: string; breakdown: string } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(value = question) {
    if (!value.trim()) return;
    setBusy(true); setMessage(""); setAnswer(null); setQuestion(value);
    try {
      const data = await request("/api/query-plan", { question: value, hasDate: !!mapping.date, hasCategory: !!mapping.category });
      const plan: QueryPlan = queryPlanSchema.parse(data.plan);
      setAnswer(answerQuestion(plan, result, mapping));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not interpret this question."); }
    finally { setBusy(false); }
  }

  const suggestions = [
    `What is the total of ${mapping.measure}?`,
    `What is the average of ${mapping.measure}?`,
    ...(mapping.date ? [`Which month had the highest ${mapping.measure}?`] : []),
    ...(mapping.date ? [`Which month had the second highest ${mapping.measure}?`] : []),
    ...(mapping.category ? [`Which ${mapping.category} had the highest total ${mapping.measure}?`] : []),
  ];

  return <section className="rounded-2xl border border-[#cbd2c7] bg-white p-6" aria-labelledby="ask-heading">
    <h3 id="ask-heading" className="text-xl font-semibold">Ask DataAfterlife</h3>
    <p className="mt-2 text-sm text-[#657168]">The browser computes every answer. Some questions are interpreted locally; others are sent to local Ollama and could contain personal details.</p>
    <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void ask(); }}><input className="min-w-0 flex-1 rounded-lg border border-[#a8b9a9] p-3" aria-label="Question about this dataset" maxLength={300} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={`What is the total of ${mapping.measure}?`} /><button disabled={busy} className="rounded-lg bg-[#285640] px-4 font-semibold text-white disabled:opacity-50">Ask</button></form>
    <div className="mt-3 flex flex-wrap gap-2">{suggestions.map((suggestion) => <button key={suggestion} className="rounded-full border border-[#a8b9a9] px-3 py-1 text-sm" onClick={() => void ask(suggestion)}>{suggestion}</button>)}</div>
    {answer && <div className="mt-5 rounded-lg bg-[#e8eee7] p-4"><p className="text-xl font-semibold">{answer.answer}</p><p className="mt-2 text-sm">{answer.breakdown}</p></div>}
    {message && <p className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-900" role="status">{message}</p>}
  </section>;
}

export function AiInsights({ result, mapping }: Props) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const packet = makePacket(result);

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
    <h3 id="insights-heading" className="text-xl font-semibold">Local AI insights</h3>
    <p className="mt-2 text-sm text-[#657168]">Calculations come from your browser. AI interprets only the aggregate packet below. Group labels may still contain sensitive information.</p>
    <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Preview facts sent to local Ollama</summary><pre className="mt-2 max-h-48 overflow-auto rounded bg-[#f3f5ef] p-3 text-xs">{JSON.stringify(packet, null, 2)}</pre></details>
    <button disabled={busy} onClick={loadInsights} className="mt-4 rounded-lg bg-[#285640] px-4 py-2 font-semibold text-white disabled:opacity-50">Generate insights</button>
    {insights.length > 0 && <ul className="mt-5 space-y-4">{insights.map((insight, index) => <li key={index} className="rounded-lg bg-[#f3f5ef] p-4"><p>{insight.text}</p><p className="mt-2 text-sm font-semibold">Evidence: {insight.evidenceIds.map((id) => { const fact = packet.facts.find((item) => item.id === id); return fact ? `${id} ${fact.label}: ${fact.value.toLocaleString()}${mapping.unit ? ` ${mapping.unit}` : " units (unit not specified)"}` : ""; }).join(" · ")}</p></li>)}</ul>}
    {message && <p className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-900" role="status">{message}</p>}
  </section>;
}
