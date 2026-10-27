import { z } from "zod";
import { packetSchema } from "@/lib/ai";
import { ollamaJson } from "@/lib/ollama";

const insightSchema = z.object({ evidenceIds: z.array(z.string()).min(1).max(4) }).strict();
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 8_000) return Response.json({ error: "Request too large." }, { status: 413 });
    const packet = packetSchema.parse(await request.json());
    const candidate = insightSchema.parse(await ollamaJson(`Select up to four distinct fact IDs most useful for explaining this dataset. Prefer highest month and leading category when present. Return only IDs from this packet: ${JSON.stringify(packet)}`, z.toJSONSchema(insightSchema)));
    const known = new Set(packet.facts.map((fact) => fact.id));
    const insights = [...new Set(candidate.evidenceIds)].filter((id) => known.has(id)).map((id) => {
      const fact = packet.facts.find((item) => item.id === id)!;
      return { text: fact.label.startsWith("Highest month") ? "This month has the highest recorded monthly total." : fact.label.startsWith("Highest category") ? "This category has the highest recorded category total." : `${fact.label} is calculated from the valid numeric rows.`, evidenceIds: [id] };
    });
    return Response.json({ insights });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid aggregate fact request or model response." }, { status: 400 });
    return Response.json({ error: "Local AI is unavailable. Start Ollama and pull gemma3:4b; computed results remain available." }, { status: 503 });
  }
}
