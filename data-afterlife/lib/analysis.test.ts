import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { analyze, parseMonth, parseNumber, type Mapping } from "./analysis";
import { alignTimeGrouping, answerQuestion, explicitQuestionPlan, makePacket, queryPlanSchema, verifyQuestionPlan } from "./ai";
import { parseCsvText } from "./csv";
import { executeGenericQuery } from "./query";
import { describeFact, evidenceTarget } from "./story";

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
  it("does not confuse half of the total with the average", () => {
    const question = "What is the half of the total amount?";
    const plan = explicitQuestionPlan(question);
    expect(plan).toEqual({ intent: "half_total" });
    expect(verifyQuestionPlan(question, { intent: "average" })).toEqual(plan);
    expect(answerQuestion(plan!, analyze(rows, mapping), mapping).answer).toContain("1,900");
    expect(explicitQuestionPlan("What is half of the average amount?")?.intent).toBe("unsupported");
  });
  it("answers half of the generated 1,000-row CSV total", () => {
    const csv = readFileSync(new URL("../public/examples/synthetic-1000x50.csv", import.meta.url), "utf8");
    const dataset = parseCsvText(csv, "synthetic-1000x50.csv");
    const result = analyze(dataset.rows, mapping);
    expect(result.sum).toBeCloseTo(236465.6);
    expect(answerQuestion({ intent: "half_total" }, result, mapping).answer).toContain("118,232.8");
    expect(answerQuestion({ intent: "extreme_month", direction: "highest" }, result, mapping).answer).toContain("2023-05: 15,803.54");
    expect(answerQuestion({ intent: "second_highest_month" }, result, mapping).answer).toContain("2023-07: 15,779.98");
    expect(executeGenericQuery(dataset.rows, dataset.columns, { intent: "ranked_rows", sortColumn: "amount", direction: "asc", limit: 3, operation: "average", measureColumn: "amount", filters: [] }, mapping).answer).toContain("18.32");
  });
  it("distinguishes highest and second-highest months", () => {
    const result = analyze(rows, mapping);
    const secondQuestion = "Which month had the second highest amount?";
    const plan = explicitQuestionPlan(secondQuestion);
    expect(plan).toEqual({ intent: "second_highest_month" });
    expect(verifyQuestionPlan(secondQuestion, { intent: "extreme_month", direction: "highest" })).toEqual(plan);
    expect(answerQuestion({ intent: "extreme_month", direction: "highest" }, result, mapping).answer).toContain("2024-03: 2,000");
    expect(answerQuestion(plan!, result, mapping).answer).toContain("2024-02: 1,000");
    expect(explicitQuestionPlan("Which category had the second highest amount?")?.intent).toBe("unsupported");
    expect(explicitQuestionPlan("Which month had the highest amount?")).toEqual({ intent: "extreme_month", direction: "highest" });
    expect(explicitQuestionPlan("Which month had the highest amount for Food?")).toBeNull();
  });
  it("handles tied and unavailable second-highest totals", () => {
    const tied = analyze([{ date: "2024-01-01", category: "A", amount: "20" }, { date: "2024-02-01", category: "A", amount: "10" }, { date: "2024-03-01", category: "A", amount: "10" }], mapping);
    expect(answerQuestion({ intent: "second_highest_month" }, tied, mapping).answer).toContain("2024-02, 2024-03: 10");
    const oneMonth = analyze([{ date: "2024-01-01", category: "A", amount: "20" }], mapping);
    expect(answerQuestion({ intent: "second_highest_month" }, oneMonth, mapping).answer).toBe("No second-highest month is available.");
  });
  it("computes averages over selected lowest values", () => {
    const question = "What is the average of the three lowest amounts?";
    const plan = explicitQuestionPlan(question, "amount");
    expect(plan).toMatchObject({ intent: "ranked_rows", direction: "asc", limit: 3, operation: "average" });
    expect(verifyQuestionPlan(question, { intent: "average" }).intent).toBe("unsupported");
    if (!plan || plan.intent !== "ranked_rows") throw new Error("Expected ranked plan");
    expect(executeGenericQuery(rows, ["date", "category", "amount"], plan, mapping).answer).toContain("300");
  });
  it("supports filtered, grouped, and median questions from row data", () => {
    const columns = ["date", "category", "amount"];
    expect(executeGenericQuery(rows, columns, { intent: "aggregate", operation: "median", column: "amount", filters: [] }, mapping).answer).toContain("625");
    expect(executeGenericQuery(rows, columns, { intent: "aggregate", operation: "sum", column: "amount", filters: [{ column: "category", operator: "eq", value: "Food" }] }, mapping).answer).toContain("2,150");
    expect(executeGenericQuery(rows, columns, { intent: "group", groupColumn: "date", period: "month", measureColumn: "amount", operation: "sum", direction: "desc", limit: 2, filters: [] }, mapping).answer).toContain("2024-03: 2,000");
    expect(() => executeGenericQuery(rows, columns, { intent: "aggregate", operation: "sum", column: "fake", filters: [] }, mapping)).toThrow("outside this CSV");
  });
  it("groups calendar years and quarters and rejects plans that discard the requested period", () => {
    const csv = readFileSync(new URL("../public/examples/forgotten-cinema-ledger.csv", import.meta.url), "utf8");
    const dataset = parseCsvText(csv, "forgotten-cinema-ledger.csv");
    const plan = { intent: "group" as const, groupColumn: "date", period: "year" as const, measureColumn: "amount", operation: "sum" as const, direction: "desc" as const, limit: 1, filters: [] };
    expect(verifyQuestionPlan("Which year has the highest amount?", plan, "amount", "date")).toEqual(plan);
    expect(verifyQuestionPlan("What year recorded the most amount?", plan, "amount", "date")).toEqual(plan);
    expect(executeGenericQuery(dataset.rows, dataset.columns, plan, mapping).answer).toContain("2000: 32,033");
    const mistaken = { intent: "aggregate" as const, operation: "max" as const, column: "amount", filters: [] };
    expect(alignTimeGrouping("Which year has the highest amount?", mistaken, "amount", "date")).toEqual(plan);
    expect(alignTimeGrouping("Which quarter had the lowest average amount?", mistaken, "amount", "date")).toMatchObject({ intent: "group", period: "quarter", operation: "average", direction: "asc" });
    expect(alignTimeGrouping("What is the highest individual amount?", mistaken, "amount", "date")).toEqual(mistaken);
    expect(verifyQuestionPlan("Which year has the highest amount?", { intent: "aggregate", operation: "max", column: "amount", filters: [] }, "amount", "date").intent).toBe("unsupported");
    expect(verifyQuestionPlan("Which year has the highest amount?", { ...plan, period: "month" }, "amount", "date").intent).toBe("unsupported");
    expect(executeGenericQuery(dataset.rows, dataset.columns, { ...plan, period: "quarter" }, mapping).answer).toMatch(/\d{4}-Q\d:/);
  });
  it("does not infer causes or forecasts from recorded rows", () => {
    expect(explicitQuestionPlan("Why did spending rise in May?")?.intent).toBe("unsupported");
    expect(explicitQuestionPlan("Forecast next month")?.intent).toBe("unsupported");
  });
  it("grounds the cinema story in verified turning points", () => {
    const csv = readFileSync(new URL("../public/examples/forgotten-cinema-ledger.csv", import.meta.url), "utf8");
    const dataset = parseCsvText(csv, "forgotten-cinema-ledger.csv");
    const result = analyze(dataset.rows, mapping);
    const packet = makePacket(result);
    expect(dataset.rows).toHaveLength(72);
    expect(result.sum).toBe(62477);
    expect(packet.facts.find((fact) => fact.id === "F7")).toMatchObject({ label: "Lowest month 2000-04", value: 541 });
    expect(packet.facts.find((fact) => fact.id === "F5")).toMatchObject({ label: "Highest month 2000-10", value: 7199 });
    const rise = packet.facts.find((fact) => fact.id === "F8")!;
    expect(describeFact(rise)).toContain("up");
    expect(evidenceTarget(rise)).toBe("#monthly-trend");
  });
  it("does not describe a gap in records as a monthly change", () => {
    const sparse = analyze([
      { date: "2024-01-01", category: "A", amount: "10" },
      { date: "2024-03-01", category: "A", amount: "50" },
    ], mapping);
    expect(makePacket(sparse).facts.some((fact) => fact.id === "F8" || fact.id === "F9")).toBe(false);
  });
});
