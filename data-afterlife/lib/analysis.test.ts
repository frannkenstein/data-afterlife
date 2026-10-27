import { describe, expect, it } from "vitest";
import { analyze, parseMonth, parseNumber, type Mapping } from "./analysis";
import { answerQuestion, queryPlanSchema } from "./ai";

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
  it("answers only validated supported plans from computed groups", () => {
    const result = analyze(rows, mapping);
    expect(answerQuestion({ intent: "extreme_month", direction: "highest" }, result, mapping).answer).toContain("2024-03: 2,000");
    expect(answerQuestion({ intent: "change_month", from: "2024-01", to: "2024-03" }, result, mapping).answer).toContain("1,200");
    expect(queryPlanSchema.safeParse({ intent: "total", code: "alert(1)" }).success).toBe(false);
  });
});
