import { parseMonth, parseNumber, type Mapping } from "./analysis";
import type { QueryPlan } from "./ai";

export type GenericPlan = Extract<QueryPlan, { intent: "aggregate" | "ranked_rows" | "group" }>;
export type QueryResult = { answer: string; breakdown: string; details: { label: string; value: string }[] };

function numeric(raw: string, mapping: Mapping): number | null {
  const value = parseNumber(raw, mapping);
  return value !== null && Number.isFinite(value) ? value : null;
}

function format(value: number, column: string, mapping: Mapping): string {
  const unit = column === mapping.measure ? (mapping.unit ? ` ${mapping.unit}` : " units (unit not specified)") : "";
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)}${unit}`;
}

function aggregate(values: number[], operation: "sum" | "average" | "median" | "min" | "max"): number {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((total, value) => total + value, 0);
  switch (operation) {
    case "sum": return sum;
    case "average": return sum / values.length;
    case "median": return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
    case "min": return sorted[0];
    case "max": return sorted[sorted.length - 1];
  }
}

function filterMatches(raw: string, operator: GenericPlan["filters"][number]["operator"], expected: string, mapping: Mapping): boolean {
  const left = raw.trim(); const right = expected.trim();
  if (operator === "eq") return left.toLowerCase() === right.toLowerCase();
  if (operator === "neq") return left.toLowerCase() !== right.toLowerCase();
  if (operator === "contains") return left.toLowerCase().includes(right.toLowerCase());
  const a = numeric(left, mapping); const b = numeric(right, mapping);
  const comparable = a !== null && b !== null ? [a, b] : /^\d{4}-\d{2}-\d{2}$/.test(left) && /^\d{4}-\d{2}-\d{2}$/.test(right) ? [left, right] : null;
  if (!comparable) return false;
  const [x, y] = comparable;
  switch (operator) {
    case "gt": return x > y;
    case "gte": return x >= y;
    case "lt": return x < y;
    case "lte": return x <= y;
  }
}

export function executeGenericQuery(rows: Record<string, string>[], columns: string[], plan: GenericPlan, mapping: Mapping): QueryResult {
  const known = new Set(columns);
  const referenced = [...plan.filters.map((filter) => filter.column)];
  if (plan.intent === "aggregate") { if (plan.column) referenced.push(plan.column); }
  if (plan.intent === "ranked_rows") referenced.push(plan.sortColumn, plan.measureColumn);
  if (plan.intent === "group") referenced.push(plan.groupColumn, plan.measureColumn);
  if (referenced.some((column) => !known.has(column))) throw new Error("The proposed question references a column outside this CSV.");
  if (plan.intent === "group" && plan.period === "month" && plan.groupColumn !== mapping.date) throw new Error("Monthly grouping requires the selected date column.");

  const filtered = rows.filter((row) => plan.filters.every((filter) => filterMatches(row[filter.column] ?? "", filter.operator, filter.value, mapping)));
  const baseDetails = [{ label: "Matching rows", value: filtered.length.toLocaleString() }];
  if (!filtered.length) return { answer: "No rows match this question.", breakdown: "Check the requested filters and available values.", details: baseDetails };

  if (plan.intent === "aggregate") {
    if (plan.operation === "count") return { answer: filtered.length.toLocaleString(), breakdown: "Count of matching rows.", details: baseDetails };
    if (plan.operation === "distinct_count") {
      const count = new Set(filtered.map((row) => (row[plan.column] ?? "").trim()).filter(Boolean)).size;
      return { answer: count.toLocaleString(), breakdown: `Distinct nonempty values in ${plan.column}.`, details: baseDetails };
    }
    const values = filtered.map((row) => numeric(row[plan.column] ?? "", mapping)).filter((value): value is number => value !== null);
    if (!values.length) return { answer: "No valid numeric values match this question.", breakdown: `${plan.column} had no usable values after filtering.`, details: baseDetails };
    const value = aggregate(values, plan.operation);
    return { answer: format(value, plan.column, mapping), breakdown: `${plan.operation} of ${values.length} valid ${plan.column} values; ${filtered.length - values.length} invalid or missing excluded.`, details: baseDetails };
  }

  if (plan.intent === "ranked_rows") {
    const ranked = filtered.map((row) => ({ row, sort: numeric(row[plan.sortColumn] ?? "", mapping) })).filter((entry): entry is { row: Record<string, string>; sort: number } => entry.sort !== null).sort((a, b) => plan.direction === "asc" ? a.sort - b.sort : b.sort - a.sort);
    const selected = ranked.slice(0, plan.limit);
    if (!selected.length) return { answer: "No valid ranked values are available.", breakdown: `Check ${plan.sortColumn}.`, details: baseDetails };
    const details = selected.map((entry, index) => ({ label: `#${index + 1}`, value: format(entry.sort, plan.sortColumn, mapping) }));
    if (plan.operation === "list") return { answer: details.map((item) => item.value).join(", "), breakdown: `${selected.length} ${plan.direction === "asc" ? "lowest" : "highest"} ${plan.sortColumn} values.`, details };
    const values = selected.map((entry) => numeric(entry.row[plan.measureColumn] ?? "", mapping)).filter((value): value is number => value !== null);
    if (!values.length) return { answer: "No valid values are available for that calculation.", breakdown: `Check ${plan.measureColumn}.`, details };
    return { answer: format(aggregate(values, plan.operation), plan.measureColumn, mapping), breakdown: `${plan.operation} of ${values.length} values from the ${selected.length} ${plan.direction === "asc" ? "lowest" : "highest"} ${plan.sortColumn} rows.`, details };
  }

  const groups = new Map<string, number[]>();
  for (const row of filtered) {
    const label = plan.period === "month" ? parseMonth(row[plan.groupColumn] ?? "", mapping.dateFormat) : (row[plan.groupColumn] ?? "").trim();
    if (!label) continue;
    const value = plan.operation === "count" ? 1 : numeric(row[plan.measureColumn] ?? "", mapping);
    if (value === null) continue;
    groups.set(label, [...(groups.get(label) ?? []), value]);
  }
  const ranked = [...groups].map(([label, values]) => ({ label, value: plan.operation === "count" ? values.length : aggregate(values, plan.operation) })).sort((a, b) => (plan.direction === "asc" ? a.value - b.value : b.value - a.value) || a.label.localeCompare(b.label)).slice(0, plan.limit);
  if (!ranked.length) return { answer: "No valid groups are available.", breakdown: "Check the grouping column and numeric values.", details: baseDetails };
  const measure = plan.operation === "count" ? "" : plan.measureColumn;
  return { answer: ranked.map((item) => `${item.label}: ${format(item.value, measure, mapping)}`).join(" · "), breakdown: `${plan.operation} by ${plan.period === "month" ? "month" : plan.groupColumn}, ordered ${plan.direction === "asc" ? "lowest" : "highest"} first.`, details: ranked.map((item) => ({ label: item.label, value: format(item.value, measure, mapping) })) };
}
