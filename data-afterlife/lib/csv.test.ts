import { describe, expect, it } from "vitest";
import { parseCsvText } from "./csv";

describe("CSV parsing limits", () => {
  it("handles quoted commas and empty cells", () => {
    const result = parseCsvText('date,category,amount\n2024-01-01,"Food, Drink",12\n2024-01-02,,\n', "sample.csv");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].category).toBe("Food, Drink");
    expect(result.rows[1].amount).toBe("");
  });
  it("stops after the row limit", () => {
    const body = "date,amount\n" + "2024-01-01,1\n".repeat(10_001);
    expect(() => parseCsvText(body, "large.csv")).toThrow("10,000 rows");
  });
  it("rejects more than 50 columns", () => {
    const header = Array.from({ length: 51 }, (_, index) => `c${index}`).join(",");
    expect(() => parseCsvText(`${header}\n${"1,".repeat(50)}1`, "wide.csv")).toThrow("50 columns");
  });
});
