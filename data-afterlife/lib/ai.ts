import { z } from "zod";
import type { Analysis, Mapping } from "./analysis";

export const factSchema = z.object({ id: z.string().regex(/^F\d+$/), label: z.string().max(80), value: z.number().finite() }).strict();
export const packetSchema = z.object({ facts: z.array(factSchema).min(1).max(20), validRows: z.number().int().nonnegative(), excludedRows: z.number().int().nonnegative() }).strict();
export type Fact = z.infer<typeof factSchema>;
export function makePacket(result: Analysis): z.infer<typeof packetSchema> {
  const facts: Fact[] = [{ id: "F1", label: "Total", value: result.sum }, { id: "F2", label: "Average", value: result.average }, { id: "F3", label: "Minimum value", value: result.min }, { id: "F4", label: "Maximum value", value: result.max }];
  const topMonth = [...result.months].sort((a, b) => b.total - a.total)[0];
  const lowMonth = [...result.months].sort((a, b) => a.total - b.total)[0];
  const topCategory = result.categories[0];
  if (topMonth) facts.push({ id: "F5", label: `Highest month ${topMonth.label}`, value: topMonth.total });
  if (topCategory) facts.push({ id: "F6", label: `Highest category ${topCategory.label.slice(0, 40)}`, value: topCategory.total });
  if (lowMonth && lowMonth.label !== topMonth?.label) facts.push({ id: "F7", label: `Lowest month ${lowMonth.label}`, value: lowMonth.total });
  const changes = result.months.slice(1).map((month, index) => ({ from: result.months[index], to: month, change: month.total - result.months[index].total })).filter(({ from, to }) => {
    const [fromYear, fromMonth] = from.label.split("-").map(Number);
    const [toYear, toMonth] = to.label.split("-").map(Number);
    return toYear * 12 + toMonth - (fromYear * 12 + fromMonth) === 1;
  });
  const rise = [...changes].sort((a, b) => b.change - a.change)[0];
  const fall = [...changes].sort((a, b) => a.change - b.change)[0];
  if (rise && rise.change > 0) facts.push({ id: "F8", label: `Largest monthly rise ${rise.from.label} to ${rise.to.label}`, value: rise.change });
  if (fall && fall.change < 0) facts.push({ id: "F9", label: `Largest monthly fall ${fall.from.label} to ${fall.to.label}`, value: fall.change });
  if (result.months.length > 1) {
    facts.push({ id: "F10", label: `First month ${result.months[0].label}`, value: result.months[0].total });
    facts.push({ id: "F11", label: `Last month ${result.months.at(-1)!.label}`, value: result.months.at(-1)!.total });
  }
  return { facts, validRows: result.count, excludedRows: result.missing + result.invalid };
}

export const queryPlanSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("total") }).strict(),
  z.object({ intent: z.literal("average") }).strict(),
  z.object({ intent: z.literal("half_total") }).strict(),
  z.object({ intent: z.literal("second_highest_month") }).strict(),
  z.object({ intent: z.literal("extreme_month"), direction: z.enum(["highest", "lowest"]) }).strict(),
  z.object({ intent: z.literal("extreme_category"), direction: z.enum(["highest", "lowest"]) }).strict(),
  z.object({ intent: z.literal("change_month"), from: z.string().regex(/^\d{4}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}$/) }).strict(),
  z.object({ intent: z.literal("aggregate"), operation: z.enum(["sum", "average", "median", "min", "max", "count", "distinct_count"]), column: z.string().max(100), filters: z.array(z.object({ column: z.string().max(100), operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains"]), value: z.string().max(100) }).strict()).max(3) }).strict(),
  z.object({ intent: z.literal("ranked_rows"), sortColumn: z.string().max(100), direction: z.enum(["asc", "desc"]), limit: z.number().int().min(1).max(100), operation: z.enum(["average", "sum", "min", "max", "list"]), measureColumn: z.string().max(100), filters: z.array(z.object({ column: z.string().max(100), operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains"]), value: z.string().max(100) }).strict()).max(3) }).strict(),
  z.object({ intent: z.literal("group"), groupColumn: z.string().max(100), period: z.enum(["none", "year", "quarter", "month"]), measureColumn: z.string().max(100), operation: z.enum(["sum", "average", "median", "min", "max", "count"]), direction: z.enum(["asc", "desc"]), limit: z.number().int().min(1).max(20), filters: z.array(z.object({ column: z.string().max(100), operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains"]), value: z.string().max(100) }).strict()).max(3) }).strict(),
  z.object({ intent: z.literal("unsupported"), reason: z.string().max(150) }).strict(),
]);
export type QueryPlan = z.infer<typeof queryPlanSchema>;

const unsupported = (reason: string): QueryPlan => ({ intent: "unsupported", reason });

export function alignTimeGrouping(question: string, plan: QueryPlan, measureColumn: string, dateColumn: string): QueryPlan {
  if (!dateColumn || !measureColumn || (plan.intent !== "aggregate" && plan.intent !== "group")) return plan;
  const text = question.toLowerCase();
  const period = /\b(year|years|yearly|annual|annually)\b/.test(text) ? "year" : /\b(quarter|quarters|quarterly)\b/.test(text) ? "quarter" : /\b(month|months|monthly)\b/.test(text) ? "month" : null;
  const direction = /\b(highest|largest|biggest|most|top)\b/.test(text) ? "desc" : /\b(lowest|smallest|least|bottom)\b/.test(text) ? "asc" : null;
  if (!period || !direction || (plan.intent === "aggregate" && plan.column !== measureColumn)) return plan;
  const operation = /\b(average|mean)\b/.test(text) ? "average" : /\bmedian\b/.test(text) ? "median" : /\b(count|number of|how many)\b/.test(text) ? "count" : /\b(individual|single|maximum|minimum)\b/.test(text) ? (direction === "desc" ? "max" : "min") : "sum";
  return { intent: "group", groupColumn: dateColumn, period, measureColumn, operation, direction, limit: 1, filters: plan.filters };
}

export function explicitQuestionPlan(question: string, measureColumn?: string): QueryPlan | null {
  const text = question.trim().toLowerCase();
  if (/^why\b|\b(cause|caused|reason for)\b/.test(text)) return unsupported("The CSV can show what changed, but it cannot establish why it happened.");
  if (/\b(predict|forecast|next month|next year)\b/.test(text)) return unsupported("This app analyzes recorded rows and does not forecast future values.");
  const qualified = /\b(for|where|among|only)\b/.test(text);
  const rankedAverage = /\baverage\s+of\s+(?:the\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(lowest|highest)\b/.exec(text);
  if (rankedAverage && measureColumn && text.includes(measureColumn.toLowerCase())) {
    const counts: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    return { intent: "ranked_rows", sortColumn: measureColumn, direction: rankedAverage[2] === "lowest" ? "asc" : "desc", limit: counts[rankedAverage[1]] ?? Number(rankedAverage[1]), operation: "average", measureColumn, filters: [] };
  }
  if (/\b(second|2nd|runner[\s-]?up)\b/.test(text)) {
    if (!qualified && /\b(highest|largest|biggest)\b/.test(text) && /\bmonths?\b/.test(text)) return { intent: "second_highest_month" };
    return unsupported("I can answer the second-highest month, but this wording is not clear enough.");
  }
  if (!qualified && /\bmonths?\b/.test(text) && !/\b(average|mean|single|individual)\b/.test(text)) {
    if (/\b(highest|largest|biggest)\b/.test(text)) return { intent: "extreme_month", direction: "highest" };
    if (/\b(lowest|smallest)\b/.test(text)) return { intent: "extreme_month", direction: "lowest" };
  }
  if (/\bhalf\b/.test(text)) {
    if (!qualified && /\bhalf\s+of\s+(?:the\s+)?total\b/.test(text) && !/\b(month|category|group|average|mean)\b/.test(text)) return { intent: "half_total" };
    return unsupported("I can calculate half of the overall total, but this wording is ambiguous.");
  }
  if (/\b(double|twice|triple|percent(?:age)?|ratio|multiply|divid(?:e|ed))\b/.test(text) || /\bquarter\s+of\b/.test(text)) {
    return unsupported("That calculation is not supported yet.");
  }
  return null;
}

export function verifyQuestionPlan(question: string, plan: QueryPlan, measureColumn?: string, dateColumn?: string): QueryPlan {
  const explicit = explicitQuestionPlan(question, measureColumn);
  if (explicit) return explicit;
  const text = question.toLowerCase();
  const requestedPeriod = /\b(year|years|yearly|annual|annually|per year)\b/.test(text) ? "year" : /\b(quarter|quarters|quarterly|per quarter)\b/.test(text) ? "quarter" : /\b(month|months|monthly|per month)\b/.test(text) ? "month" : null;
  if (requestedPeriod && (plan.intent !== "group" || plan.period !== requestedPeriod || plan.groupColumn !== dateColumn)) return unsupported(`The proposed calculation does not group by ${requestedPeriod}.`);
  if (plan.intent === "group" && plan.period !== "none" && !requestedPeriod && !/\b(date|time|period)\b/.test(text)) return unsupported("The proposed time grouping is not requested by the question.");
  if (plan.intent === "half_total") return unsupported("The question does not clearly ask for half of the overall total.");
  if (plan.intent === "second_highest_month") return unsupported("The question does not clearly ask for the second-highest month.");
  if (plan.intent === "average" && (!/\b(average|mean)\b/.test(text) || /\b(lowest|highest|smallest|largest|top|bottom|first|last)\b/.test(text))) return unsupported("The question asks for more than the overall average.");
  if (plan.intent === "total" && !/\b(total|sum)\b/.test(text)) return unsupported("The question does not clearly ask for a total.");
  if (plan.intent === "ranked_rows") {
    if (/\b(lowest|smallest|bottom)\b/.test(text) && plan.direction !== "asc") return unsupported("The proposed ranking does not match the question.");
    if (/\b(highest|largest|top)\b/.test(text) && plan.direction !== "desc") return unsupported("The proposed ranking does not match the question.");
  }
  if (plan.intent === "group" || plan.intent === "aggregate") {
    if (/\b(average|mean)\b/.test(text) && plan.operation !== "average") return unsupported("The proposed calculation does not match the requested average.");
    if (/\b(total|sum)\b/.test(text) && !/\b(average|mean)\b/.test(text) && plan.operation !== "sum") return unsupported("The proposed calculation does not match the requested total.");
  }
  if (plan.intent === "group") {
    if (/\b(highest|largest|biggest|most|top)\b/.test(text) && plan.direction !== "desc") return unsupported("The proposed group ranking is in the wrong direction.");
    if (/\b(lowest|smallest|least|bottom)\b/.test(text) && plan.direction !== "asc") return unsupported("The proposed group ranking is in the wrong direction.");
  }
  return plan;
}

export function answerQuestion(plan: QueryPlan, result: Analysis, mapping: Mapping): { answer: string; breakdown: string } {
  const unit = mapping.unit ? ` ${mapping.unit}` : " units (unit not specified)";
  const number = (value: number) => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)}${unit}`;
  if (plan.intent === "unsupported") return { answer: "This question is not supported yet.", breakdown: plan.reason };
  if (!result.count) return { answer: "No valid numeric rows are available.", breakdown: "Check the measure and normalization settings." };
  if (plan.intent === "total") return { answer: number(result.sum), breakdown: `Sum of ${result.count} valid ${mapping.measure} values.` };
  if (plan.intent === "average") return { answer: number(result.average), breakdown: `Total ${number(result.sum)} ÷ ${result.count} valid rows.` };
  if (plan.intent === "half_total") return { answer: number(result.sum / 2), breakdown: `Half of the overall total: ${number(result.sum)} ÷ 2.` };
  if (plan.intent === "second_highest_month") {
    const ranked = [...result.months].sort((a, b) => b.total - a.total);
    if (ranked.length < 2) return { answer: "No second-highest month is available.", breakdown: "At least two months with valid totals are needed." };
    const second = ranked.find((month) => month.total < ranked[0].total - 1e-9);
    if (!second) return { answer: "No distinct second-highest total is available.", breakdown: "All monthly totals are tied." };
    const tied = ranked.filter((month) => Math.abs(month.total - second.total) < 1e-9);
    return { answer: `${tied.map((month) => month.label).join(", ")}: ${number(second.total)}`, breakdown: `Second distinct monthly total among ${ranked.length} months. Highest: ${ranked[0].label} at ${number(ranked[0].total)}.` };
  }
  if (plan.intent === "extreme_month" || plan.intent === "extreme_category") {
    const groups = plan.intent === "extreme_month" ? result.months : result.categories;
    if (!groups.length) return { answer: "No matching groups are available.", breakdown: "Check the selected date or category column." };
    const chosen = [...groups].sort((a, b) => plan.direction === "highest" ? b.total - a.total : a.total - b.total)[0];
    return { answer: `${chosen.label}: ${number(chosen.total)}`, breakdown: `${plan.direction} total among ${groups.length} ${plan.intent === "extreme_month" ? "months" : "categories"}; ${chosen.count} contributing rows.` };
  }
  if (plan.intent === "change_month") {
    const from = result.months.find((group) => group.label === plan.from);
    const to = result.months.find((group) => group.label === plan.to);
    if (!from || !to) return { answer: "Those months are not both available.", breakdown: `Available months: ${result.months.map((group) => group.label).join(", ") || "none"}.` };
    return { answer: `${number(to.total - from.total)} change`, breakdown: `${plan.from}: ${number(from.total)} → ${plan.to}: ${number(to.total)}.` };
  }
  return { answer: "This question needs row-level analysis.", breakdown: "The browser is preparing a calculation from the selected CSV." };
}
