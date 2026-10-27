import type { Fact } from "./ai";

export function describeFact(fact: Fact): string {
  const value = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Math.abs(fact.value));
  if (fact.label.startsWith("Highest month ")) return `${fact.label.slice(14)} was the archive's highest recorded month, reaching ${value}.`;
  if (fact.label.startsWith("Lowest month ")) return `${fact.label.slice(13)} was the quietest recorded month, at ${value}.`;
  if (fact.label.startsWith("Largest monthly rise ")) return `The sharpest month-to-month rise came from ${fact.label.slice(21)}: up ${value}.`;
  if (fact.label.startsWith("Largest monthly fall ")) return `The sharpest month-to-month fall came from ${fact.label.slice(21)}: down ${value}.`;
  if (fact.label.startsWith("Highest category ")) return `${fact.label.slice(17)} contributed the highest category total: ${value}.`;
  if (fact.label.startsWith("First month ")) return `The record begins in ${fact.label.slice(12)}, with a total of ${value}.`;
  if (fact.label.startsWith("Last month ")) return `The last recorded month, ${fact.label.slice(11)}, totals ${value}.`;
  return `${fact.label} is ${value} across the valid rows.`;
}

export function evidenceTarget(fact: Fact): string {
  if (/month|rise|fall/i.test(fact.label)) return "#monthly-trend";
  if (/category/i.test(fact.label)) return "#category-totals";
  return "#analysis-summary";
}
