export type Mapping = { measure: string; date: string; category: string; dateFormat: "iso" | "dmy" | "mdy"; unit: string; stripCurrency: boolean; groupSeparator: boolean };
export type Group = { label: string; total: number; count: number };
export type Analysis = { count: number; missing: number; invalid: number; sum: number; average: number; min: number; max: number; months: Group[]; categories: Group[]; invalidDates: number };

export function parseNumber(raw: string, mapping: Mapping): number | null {
  let value = raw.trim();
  if (!value) return null;
  if (mapping.stripCurrency) value = value.replace(/^[₹$€£]\s*/, "");
  if (mapping.groupSeparator) value = value.replace(/,/g, "");
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value)) return NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

export function parseMonth(raw: string, format: Mapping["dateFormat"]): string | null {
  const value = raw.trim();
  let year: number; let month: number; let day: number;
  if (format === "iso") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    [, year, month, day] = match.map(Number);
  } else {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (!match) return null;
    const [, first, second, last] = match.map(Number);
    year = last; month = format === "dmy" ? second : first; day = format === "dmy" ? first : second;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day ? `${year}-${String(month).padStart(2, "0")}` : null;
}

export function analyze(rows: Record<string, string>[], mapping: Mapping): Analysis {
  const months = new Map<string, Group>(); const categories = new Map<string, Group>();
  let count = 0, missing = 0, invalid = 0, invalidDates = 0, sum = 0, min = Infinity, max = -Infinity;
  function add(map: Map<string, Group>, label: string, value: number) {
    const group = map.get(label) ?? { label, total: 0, count: 0 };
    group.total += value; group.count++; map.set(label, group);
  }
  for (const row of rows) {
    const number = parseNumber(row[mapping.measure] ?? "", mapping);
    if (number === null) { missing++; continue; }
    if (Number.isNaN(number)) { invalid++; continue; }
    count++; sum += number; min = Math.min(min, number); max = Math.max(max, number);
    if (mapping.date) { const month = parseMonth(row[mapping.date] ?? "", mapping.dateFormat); if (month) add(months, month, number); else invalidDates++; }
    if (mapping.category) { const category = (row[mapping.category] ?? "").trim(); if (category) add(categories, category, number); }
  }
  return { count, missing, invalid, sum, average: count ? sum / count : 0, min: count ? min : 0, max: count ? max : 0, months: [...months.values()].sort((a, b) => a.label.localeCompare(b.label)), categories: [...categories.values()].sort((a, b) => b.total - a.total), invalidDates };
}
