import { z } from "zod";
import { queryPlanSchema } from "@/lib/ai";
import { ollamaJson } from "@/lib/ollama";

const requestSchema = z.object({ question: z.string().trim().min(1).max(300), hasDate: z.boolean(), hasCategory: z.boolean() }).strict();
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 2_000) return Response.json({ error: "Request too large." }, { status: 413 });
    const input = requestSchema.parse(await request.json());
    const plan = queryPlanSchema.parse(await ollamaJson(`Classify this question into one plan. Allowed: total, average, extreme_month (highest/lowest), extreme_category (highest/lowest), change_month (from/to YYYY-MM), unsupported. Use unsupported if ambiguous or outside this set. Date mapped: ${input.hasDate}; category mapped: ${input.hasCategory}. Question: ${JSON.stringify(input.question)}`, z.toJSONSchema(queryPlanSchema)));
    if ((plan.intent === "extreme_month" || plan.intent === "change_month") && !input.hasDate || plan.intent === "extreme_category" && !input.hasCategory) return Response.json({ plan: { intent: "unsupported", reason: "Map the required date or category column first." } });
    return Response.json({ plan });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Unsupported or invalid question plan." }, { status: 400 });
    return Response.json({ error: "Local AI is unavailable. Start Ollama and pull gemma3:4b." }, { status: 503 });
  }
}
