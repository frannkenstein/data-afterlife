import { z } from "zod";
import { explicitQuestionPlan, queryPlanSchema, verifyQuestionPlan } from "@/lib/ai";
import { ollamaJson } from "@/lib/ollama";
import { readLimitedJson } from "@/lib/request";

const requestSchema = z.object({ question: z.string().trim().min(1).max(300), hasDate: z.boolean(), hasCategory: z.boolean() }).strict();
export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await readLimitedJson(request, 2_000));
    const explicit = explicitQuestionPlan(input.question);
    if (explicit) {
      if (explicit.intent === "second_highest_month" && !input.hasDate) return Response.json({ plan: { intent: "unsupported", reason: "Map a date column first." } });
      return Response.json({ plan: explicit });
    }
    const candidate = queryPlanSchema.parse(await ollamaJson(`Classify this question into one plan. Allowed: total, average, extreme_month (highest/lowest), second_highest_month, extreme_category (highest/lowest), change_month (from/to YYYY-MM), unsupported. Use unsupported if ambiguous or outside this set. Never map second-highest to highest, or half/fractions/percentages to average. Date mapped: ${input.hasDate}; category mapped: ${input.hasCategory}. Question: ${JSON.stringify(input.question)}`, z.toJSONSchema(queryPlanSchema)));
    const plan = verifyQuestionPlan(input.question, candidate);
    if ((plan.intent === "extreme_month" || plan.intent === "change_month") && !input.hasDate || plan.intent === "extreme_category" && !input.hasCategory) return Response.json({ plan: { intent: "unsupported", reason: "Map the required date or category column first." } });
    return Response.json({ plan });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Unsupported or invalid question plan." }, { status: 400 });
    if (error instanceof Error && error.message === "Request too large.") return Response.json({ error: error.message }, { status: 413 });
    return Response.json({ error: "Local AI is unavailable. Start Ollama and pull gemma3:4b." }, { status: 503 });
  }
}
