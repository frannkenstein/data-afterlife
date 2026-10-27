import { z } from "zod";
import { packetSchema } from "@/lib/ai";
import { ollamaJson } from "@/lib/ollama";
import { readLimitedJson } from "@/lib/request";
import { describeFact } from "@/lib/story";

const insightSchema = z.object({ evidenceIds: z.array(z.string()).min(1).max(4) }).strict();
export async function POST(request: Request) {
  try {
    const packet = packetSchema.parse(await readLimitedJson(request, 8_000));
    const candidate = insightSchema.parse(await ollamaJson(`You are curating a brief story from a forgotten data archive. Select up to four distinct fact IDs in an order that tells the most interesting truthful arc. Prefer a low point, a month-to-month change, and a high point when available. Do not infer causes. Return only IDs from this packet: ${JSON.stringify(packet)}`, z.toJSONSchema(insightSchema)));
    const known = new Set(packet.facts.map((fact) => fact.id));
    const insights = [...new Set(candidate.evidenceIds)].filter((id) => known.has(id)).map((id) => {
      const fact = packet.facts.find((item) => item.id === id)!;
      return { text: describeFact(fact), evidenceIds: [id] };
    });
    return Response.json({ insights });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid aggregate fact request or model response." }, { status: 400 });
    if (error instanceof Error && error.message === "Request too large.") return Response.json({ error: error.message }, { status: 413 });
    return Response.json({ error: "Local AI is unavailable. Start Ollama and pull gemma3:4b; computed results remain available." }, { status: 503 });
  }
}
