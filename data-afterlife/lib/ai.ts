import { z } from "zod";
import type { Analysis, Mapping } from "./analysis";

export const factSchema = z.object({ id: z.string().regex(/^F\d+$/), label: z.string().max(80), value: z.number().finite() }).strict();
export const packetSchema = z.object({ facts: z.array(factSchema).min(1).max(20), validRows: z.number().int().nonnegative(), excludedRows: z.number().int().nonnegative() }).strict();
export type Fact = z.infer<typeof factSchema>;
export function makePacket(result: Analysis): z.infer<typeof packetSchema> {
  const facts: Fact[] = [{ id: "F1", label: "Total", value: result.sum }, { id: "F2", label: "Average", value: result.average }, { id: "F3", label: "Minimum value", value: result.min }, { id: "F4", label: "Maximum value", value: result.max }];
  const topMonth = [...result.months].sort((a, b) => b.total - a.total)[0];
  const topCategory = result.categories[0];
  if (topMonth) facts.push({ id: "F5", label: `Highest month ${topMonth.label}`, value: topMonth.total });
  if (topCategory) facts.push({ id: "F6", label: `Highest category ${topCategory.label.slice(0, 40)}`, value: topCategory.total });
  return { facts, validRows: result.count, excludedRows: result.missing + result.invalid };
}

export const queryPlanSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("total") }).strict(),
  z.object({ intent: z.literal("average") }).strict(),
  z.object({ intent: z.literal("extreme_month"), direction: z.enum(["highest", "lowest"]) }).strict(),
  z.object({ intent: z.literal("extreme_category"), direction: z.enum(["highest", "lowest"]) }).strict(),
  z.object({ intent: z.literal("change_month"), from: z.string().regex(/^\d{4}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}$/) }).strict(),
  z.object({ intent: z.literal("unsupported"), reason: z.string().max(150) }).strict(),
]);
export type QueryPlan = z.infer<typeof queryPlanSchema>;

export function answerQuestion(plan: QueryPlan, result: Analysis, mapping: Mapping): { answer: string; breakdown: string } {
  const unit = mapping.unit ? ` ${mapping.unit}` : " units (unit not specified)";
  const number = (value: number) => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)}${unit}`;
  if (plan.intent === "unsupported") return { answer: "This question is not supported yet.", breakdown: plan.reason };
  if (!result.count) return { answer: "No valid numeric rows are available.", breakdown: "Check the measure and normalization settings." };
  if (plan.intent === "total") return { answer: number(result.sum), breakdown: `Sum of ${result.count} valid ${mapping.measure} values.` };
  if (plan.intent === "average") return { answer: number(result.average), breakdown: `Total ${number(result.sum)} ÷ ${result.count} valid rows.` };
  if (plan.intent === "extreme_month" || plan.intent === "extreme_category") {
    const groups = plan.intent === "extreme_month" ? result.months : result.categories;
    if (!groups.length) return { answer: "No matching groups are available.", breakdown: "Check the selected date or category column." };
    const chosen = [...groups].sort((a, b) => plan.direction === "highest" ? b.total - a.total : a.total - b.total)[0];
    return { answer: `${chosen.label}: ${number(chosen.total)}`, breakdown: `${plan.direction} total among ${groups.length} ${plan.intent === "extreme_month" ? "months" : "categories"}; ${chosen.count} contributing rows.` };
  }
  const from = result.months.find((group) => group.label === plan.from);
  const to = result.months.find((group) => group.label === plan.to);
  if (!from || !to) return { answer: "Those months are not both available.", breakdown: `Available months: ${result.months.map((group) => group.label).join(", ") || "none"}.` };
  return { answer: `${number(to.total - from.total)} change`, breakdown: `${plan.from}: ${number(from.total)} → ${plan.to}: ${number(to.total)}.` };
}
