import { describe, expect, it } from "vitest";
import { analyze, parseMonth, parseNumber, type Mapping } from "./analysis";

const mapping: Mapping = { measure: "amount", date: "date", category: "category", dateFormat: "iso", unit: "", stripCurrency: false, groupSeparator: false };
const rows = [
  ["2024-01-10", "Food", "500"], ["2024-01-18", "Travel", "300"],
  ["2024-02-03", "Food", "900"], ["2024-02-20", "Travel", "100"],
  ["2024-03-05", "Food", "750"], ["2024-03-27", "Travel", "1250"],
].map(([date, category, amount]) => ({ date, category, amount }));

describe("deterministic analysis", () => {
  it("computes the documented synthetic totals", () => {
    const result = analyze(rows, mapping);
    expect(result.sum).toBe(3800);
    expect(result.average).toBeCloseTo(3800 / 6);
    expect(result.months.map(({ total }) => total)).toEqual([800, 1000, 2000]);
    expect(result.categories.map(({ label, total }) => [label, total])).toEqual([["Food", 2150], ["Travel", 1650]]);
  });
  it("does not silently coerce invalid values or ambiguous dates", () => {
    expect(parseNumber("$1,000", mapping)).toBeNaN();
    expect(parseMonth("03/04/2024", "iso")).toBeNull();
    expect(analyze([{ date: "2024-02-30", category: "A", amount: "bad" }, { date: "", category: "A", amount: "" }], mapping)).toMatchObject({ count: 0, invalid: 1, missing: 1 });
  });
});
