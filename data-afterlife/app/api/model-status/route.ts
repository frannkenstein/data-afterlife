export async function GET() {
  const model = process.env.OLLAMA_MODEL ?? "gemma3:4b";
  try {
    const base = new URL(process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434");
    if (!["127.0.0.1", "localhost", "::1"].includes(base.hostname)) throw new Error("Ollama must be local.");
    const response = await fetch(new URL("/api/tags", base), { signal: AbortSignal.timeout(2_500), cache: "no-store" });
    if (!response.ok) throw new Error("Ollama is unavailable.");
    const data = await response.json() as { models?: { name?: string }[] };
    return Response.json({ available: !!data.models?.some((item) => item.name === model), model }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ available: false, model }, { headers: { "cache-control": "no-store" } });
  }
}
