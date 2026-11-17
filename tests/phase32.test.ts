// tests/phase32.test.ts｜Phase 3.2：級距表、勞保擇優、勞退月領資格提示
import { describe, it, expect } from "vitest";
import { LI_SALARY_BRACKETS, LR_WAGE_BRACKETS, bracketFor, socialParamValue } from "../config/social";
import { laborInsuranceMonthly, laborPensionMonthlyEligibilityWarning, type LaborPensionInput } from "../core/social";

describe("Phase 3.2｜115 年版級距表", () => {
  it("勞保分級表：一般勞工 11 級，最低 29,500、最高 45,800", () => {
    expect(LI_SALARY_BRACKETS).toHaveLength(11);
    expect(LI_SALARY_BRACKETS[0]).toBe(29500);
    expect(LI_SALARY_BRACKETS[LI_SALARY_BRACKETS.length - 1]).toBe(45800);
    // 月收入低於 29,500 對應 29,500
    expect(bracketFor(28000, LI_SALARY_BRACKETS, socialParamValue("liSalaryCap"))).toBe(29500);
    expect(bracketFor(10000, LI_SALARY_BRACKETS, socialParamValue("liSalaryCap"))).toBe(29500);
  });
  it("勞退分級表：62 級、嚴格遞增、最後一級 150,000、含 28590/29500、不含 23800/28800", () => {
    expect(LR_WAGE_BRACKETS).toHaveLength(62);
    for (let i = 1; i < LR_WAGE_BRACKETS.length; i++) {
      expect(LR_WAGE_BRACKETS[i]).toBeGreaterThan(LR_WAGE_BRACKETS[i - 1]);
    }
    expect(LR_WAGE_BRACKETS[LR_WAGE_BRACKETS.length - 1]).toBe(150000);
    expect(LR_WAGE_BRACKETS).toContain(28590);
    expect(LR_WAGE_BRACKETS).toContain(29500);
    expect(LR_WAGE_BRACKETS).not.toContain(23800);
    expect(LR_WAGE_BRACKETS).not.toContain(28800);
    // 月收入 28,000 → 勞退對應 28,590
    expect(bracketFor(28000, LR_WAGE_BRACKETS, socialParamValue("lrWageCap"))).toBe(28590);
  });
});

describe("Phase 3.2｜勞保老年年金兩式擇優（第 58-1 條）", () => {
  const li = (salary: number) => ({
    existingYears: 0, plannedYears: null, avgInsuredSalary: salary,
    claimAge: 65, discountPct: 0, indexed: true,
  });
  it("(a) 預設範例 45,800 × 35 年 → 第二式勝出，月領 24,846.5（顯示 24,847，與原本相同）", () => {
    const m = laborInsuranceMonthly(li(45800), 35);
    expect(Math.abs(m - 24846.5)).toBeLessThan(0.01);
    expect(Math.round(m)).toBe(24847);
  });
  it("(b) 29,500 × 15 年 → 第一式 6,429.4、第二式 6,858.75，取 6,858.75", () => {
    const m = laborInsuranceMonthly(li(29500), 15);
    expect(Math.abs(m - 6858.75)).toBeLessThan(0.01);
  });
  it("(c) 29,500 × 10 年 → 第一式勝出，取 5,286.3", () => {
    const m = laborInsuranceMonthly(li(29500), 10);
    expect(Math.abs(m - 5286.25)).toBeLessThan(0.01);
  });
});

describe("Phase 3.2｜勞退月領資格提示（第 24 條）", () => {
  const lp = (mode: "lump" | "monthly"): LaborPensionInput => ({
    monthlyWage: 40000, employerRatePct: 6, employeeRatePct: 0,
    fundReturnPct: 2, currentBalance: 0, mode, claimAge: 60,
  });
  it("30 歲、40 歲退休（年資近似 10 年 < 15）、選月領 → 提示旗標 true", () => {
    expect(laborPensionMonthlyEligibilityWarning(lp("monthly"), 30, 40)).toBe(true);
  });
  it("30 歲、65 歲退休（35 年）選月領 → 無提示；年資不足但選一次領 → 無提示", () => {
    expect(laborPensionMonthlyEligibilityWarning(lp("monthly"), 30, 65)).toBe(false);
    expect(laborPensionMonthlyEligibilityWarning(lp("lump"), 30, 40)).toBe(false);
  });
});
