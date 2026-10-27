import { z } from "zod";
import { explicitQuestionPlan, queryPlanSchema, verifyQuestionPlan } from "@/lib/ai";
import { ollamaJson } from "@/lib/ollama";
import { readLimitedJson } from "@/lib/request";

const requestSchema = z.object({ question: z.string().trim().min(1).max(300), hasDate: z.boolean(), hasCategory: z.boolean(), columns: z.array(z.string().min(1).max(100)).min(1).max(50), measureColumn: z.string().max(100), dateColumn: z.string().max(100) }).strict();
export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await readLimitedJson(request, 8_000));
    const known = new Set(input.columns);
    if (input.measureColumn && !known.has(input.measureColumn) || input.dateColumn && !known.has(input.dateColumn)) return Response.json({ error: "Invalid column mapping." }, { status: 400 });
    const explicit = explicitQuestionPlan(input.question, input.measureColumn);
    if (explicit) {
      if ((explicit.intent === "second_highest_month" || explicit.intent === "extreme_month") && !input.hasDate) return Response.json({ plan: { intent: "unsupported", reason: "Map a date column first." } });
      return Response.json({ plan: explicit });
    }
    const schema = z.toJSONSchema(queryPlanSchema);
    const prompt = `Translate the question into one JSON analysis plan. Exact CSV columns: ${JSON.stringify(input.columns)}. Selected numeric measure: ${JSON.stringify(input.measureColumn)}. Selected date column: ${JSON.stringify(input.dateColumn)}. Date mapped: ${input.hasDate}; category mapped: ${input.hasCategory}. Use aggregate for whole-column statistics, optionally with filters. Use ranked_rows when a question selects N lowest or highest row values and then asks for their average, sum, or list. Use group for category or time breakdowns. For a mapped date, period can be year, quarter, or month; use the exact selected date column as groupColumn. For "which year has the highest amount", group by year, sum the measure, sort desc, limit 1. For "which quarter had the lowest average amount", group by quarter, average the measure, sort asc, limit 1. A question about highest/lowest month of amount means monthly SUM unless it explicitly says average. For all generic plans include filters: [] when none. Example "average of three lowest amounts" -> ranked_rows, sortColumn amount, direction asc, limit 3, operation average, measureColumn amount, filters []. Never turn a subset question into an overall average. If the data cannot establish an answer, return unsupported. Do not invent columns, values, or code. Question: ${JSON.stringify(input.question)}`;
    const candidate = queryPlanSchema.parse(await ollamaJson(prompt, schema));
    let plan = verifyQuestionPlan(input.question, candidate, input.measureColumn, input.dateColumn);
    if (candidate.intent !== "unsupported" && plan.intent === "unsupported") {
      const revised = queryPlanSchema.parse(await ollamaJson(`${prompt}\nYour first plan was ${JSON.stringify(candidate)}. It failed validation: ${plan.reason} Revise the plan to answer the exact question; return unsupported only if the requested calculation is impossible from these columns.`, schema));
      plan = verifyQuestionPlan(input.question, revised, input.measureColumn, input.dateColumn);
    }
    if (plan.intent === "aggregate" || plan.intent === "ranked_rows" || plan.intent === "group") {
      const references = [...plan.filters.map((filter) => filter.column)];
      if (plan.intent === "aggregate" && plan.column) references.push(plan.column);
      if (plan.intent === "ranked_rows") references.push(plan.sortColumn, plan.measureColumn);
      if (plan.intent === "group") references.push(plan.groupColumn, plan.measureColumn);
      if (references.some((column) => !known.has(column))) return Response.json({ plan: { intent: "unsupported", reason: "The question plan referenced a column outside this CSV." } });
      if (plan.intent === "group" && plan.period !== "none" && (!input.hasDate || plan.groupColumn !== input.dateColumn)) return Response.json({ plan: { intent: "unsupported", reason: "Map a date column before grouping by time." } });
    }
    if ((plan.intent === "extreme_month" || plan.intent === "change_month") && !input.hasDate || plan.intent === "extreme_category" && !input.hasCategory) return Response.json({ plan: { intent: "unsupported", reason: "Map the required date or category column first." } });
    return Response.json({ plan });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Unsupported or invalid question plan." }, { status: 400 });
    if (error instanceof Error && error.message === "Request too large.") return Response.json({ error: error.message }, { status: 413 });
    return Response.json({ error: "Local AI is unavailable. Start Ollama and pull gemma3:4b." }, { status: 503 });
  }
}
