// tests/phase6.test.ts｜Phase 6：人生大目標（core/lifeGoals.ts、simulate 整合、匯入檢查、驗收 G／H）
import { describe, it, expect } from "vitest";
import {
  amortizedMonthlyPayment, downPaymentOf, loanAmountOf, loanPrincipalNominal,
  monthlyPaymentNominal, goalFlowAt, validateLifeGoals, goalShortfallWarnings,
  goalsImpact, type LifeGoal,
} from "../core/lifeGoals";
import { computePhase1 } from "../core/compute";
import { simulate, type SimInput } from "../core/simulate";
import { migrateLegacyForm, pickKnownFields, sanitizeLifeGoals } from "../core/importForm";
import { resolveSocialInput, type SocialChoice } from "../core/socialEstimate";
import { paramValue } from "../config/defaults";
import { defaultFormInput } from "./helpers";

const house: LifeGoal = { name: "買房", type: "house", purchaseAge: 40, price: 10000000, downMode: "pct", downValue: 20, extraCosts: 0, loanRatePct: 2.5, loanYears: 30 };
const car: LifeGoal = { name: "買車", type: "car", purchaseAge: 35, price: 900000, downMode: "amount", downValue: 300000, extraCosts: 0, loanRatePct: 3, loanYears: 5 };
const close = (a: number, b: number, tol = 0.01) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe("第十節 1｜攤還公式（獨立程式核算值）", () => {
  it("四組月付金", () => {
    close(amortizedMonthlyPayment(8000000, 2.5, 30), 31609.6719, 0.001);
    close(amortizedMonthlyPayment(600000, 3, 5), 10781.2144, 0.001);
    close(amortizedMonthlyPayment(1200000, 0, 10), 10000.0, 0.001);
    close(amortizedMonthlyPayment(1000000, 12, 1), 88848.7887, 0.001);
  });
  it("年數 0 或本金 0 時月付金為 0", () => {
    expect(amortizedMonthlyPayment(1000000, 3, 0)).toBe(0);
    expect(amortizedMonthlyPayment(0, 3, 10)).toBe(0);
  });
});

describe("第十節 2｜帳面本金與帳面月付金", () => {
  it("30 歲、通膨 2%、40 歲買 1,000 萬房、頭期 20%", () => {
    expect(downPaymentOf(house)).toBe(2000000);
    expect(loanAmountOf(house)).toBe(8000000);
    close(loanPrincipalNominal(house, 30, 2), 9751955.36);
    close(monthlyPaymentNominal(house, 30, 2), 38532.01);
  });
});

describe("第十節 3｜goalFlowAt", () => {
  const g = { ...house, extraCosts: 100000 };
  it("購買年：lump = 頭期 + 額外費用、pay = 0", () => {
    const f = goalFlowAt([g], 30, 10, 2);
    expect(f.lump).toBe(2100000);
    expect(f.pay).toBe(0);
  });
  it("隔年起 pay = 12 × M ÷ 1.02^t", () => {
    const f = goalFlowAt([g], 30, 11, 2);
    expect(f.lump).toBe(0);
    expect(Math.round(f.pay)).toBe(371878);
  });
  it("最後還款年（tp+年數）有 pay、隔年歸 0", () => {
    expect(goalFlowAt([g], 30, 40, 2).pay).toBeGreaterThan(0);
    expect(goalFlowAt([g], 30, 41, 2).pay).toBe(0);
  });
  it("null／空陣列回傳 0", () => {
    expect(goalFlowAt(null, 30, 10, 2)).toEqual({ lump: 0, pay: 0 });
    expect(goalFlowAt([], 30, 10, 2)).toEqual({ lump: 0, pay: 0 });
  });
});

describe("第十節 6｜頭期 ≥ 總價與年數 0", () => {
  it("頭期 ≥ 總價時貸款為 0", () => {
    const g = { ...car, downValue: 900000 };
    expect(loanAmountOf(g)).toBe(0);
    expect(monthlyPaymentNominal(g, 30, 2)).toBe(0);
    const g2 = { ...car, downMode: "pct" as const, downValue: 150 };
    expect(downPaymentOf(g2)).toBe(900000); // 百分比超過 100 時以總價為上限
  });
  it("年數 0 時只有一次性支出", () => {
    const g = { ...car, loanYears: 0 };
    expect(goalFlowAt([g], 30, 5, 2).lump).toBe(300000);
    expect(goalFlowAt([g], 30, 6, 2).pay).toBe(0);
  });
});

describe("第十節 5｜頭期款大於資產", () => {
  it("資產以 0 為下限、workGap > 0、警告出現", () => {
    const inp: SimInput = {
      ...defaultFormInput(), retPre: 6.5, retPost: 4.5, social: null,
      monthlyIncome: 20000, initAssets: 0,
      lifeGoals: [{ name: "買房", type: "house", purchaseAge: 35, price: 5000000, downMode: "pct", downValue: 50, extraCosts: 0, loanRatePct: 2.5, loanYears: 30 }],
    };
    const { res } = computePhase1(inp);
    expect(res.workGap).toBeGreaterThan(0);
    const warnings = goalShortfallWarnings(inp);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("不夠付頭期款");
  });
  it("validate：購買年齡與利率／年數範圍", () => {
    const bad = { ...house, purchaseAge: 30 };
    expect(validateLifeGoals([bad], 30, 85).errors.length).toBeGreaterThan(0);
    const long = { ...house, loanYears: 40, purchaseAge: 50 };
    const v = validateLifeGoals([long], 30, 85);
    expect(v.warnings.some((w) => w.includes("還沒繳完"))).toBe(true);
  });
});

describe("第十節 7｜lifeGoals 為 [] 或 null 時與 5.9 逐位相同", () => {
  it("模擬結果完全一致", () => {
    const base = defaultFormInput();
    const a = simulate(base, base.ageRetire, 0);
    const b = simulate({ ...base, lifeGoals: [] }, base.ageRetire, 0);
    const c = simulate({ ...base, lifeGoals: null }, base.ageRetire, 0);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(JSON.stringify(c)).toBe(JSON.stringify(a));
  });
});

describe("第十節 8｜JSON 匯入", () => {
  it("version 2 舊檔匯入後 lifeGoals = []", () => {
    const v2 = { ageNow: "30", expenses: [], socialEnabled: true };
    const picked = pickKnownFields(migrateLegacyForm(v2), { lifeGoals: [] as unknown[], laborInsured: "" });
    expect(picked.lifeGoals).toEqual([]);
  });
  it("含一筆格式錯誤目標時只略過那一筆", () => {
    const good = { name: "買房", type: "house", purchaseAge: "40", price: "10000000", downMode: "pct", downValue: "20", extraCosts: "0", loanRatePct: "2.5", loanYears: "30" };
    const bad = { name: "壞掉的", type: "house", purchaseAge: "40" }; // 缺欄位
    const out = sanitizeLifeGoals([good, bad, "not-an-object"]);
    expect(out.goals.length).toBe(1);
    expect(out.skipped).toBe(2);
    expect(sanitizeLifeGoals(undefined)).toEqual({ goals: [], skipped: 0 });
  });
});

// ---- 第十節 9｜新驗收情境 G／H（UI 預設口徑：retPre 6.5／retPost 4.5＋勞保勞退幫我估） ----
function defaultChoice(over: Partial<SocialChoice> = {}): SocialChoice {
  return {
    laborInsured: "yes", socialInputMode: "estimate",
    ageNow: 30, startWorkAge: 30, grossSalary: NaN, monthlyIncome: 50000,
    liExistingYears: 0, liAvgSalary: 0, liSalaryManual: false, lrBalance: 0, lrEmployeeRate: 0,
    liPlannedYears: null, liClaimAge: 65, liDiscountPct: 0, liIndexed: true,
    lrWage: 0, lrWageManual: false, lrEmployerRate: 6, lrFundReturn: 2, lrMode: "lump", lrClaimAge: 60,
    ...over,
  };
}
function uiDefault(over: Partial<SimInput> = {}): SimInput {
  return { ...defaultFormInput(), retPre: paramValue("retPre"), retPost: paramValue("retPost"), social: resolveSocialInput(defaultChoice()), ...over };
}
const wan = (v: number) => Math.round(v / 1000) / 10;

describe("第十節 9｜驗收情境 G／H", () => {
  it("G：預設值＋買房（房租或房貸到 40 歲結束、貸款跨進退休期）", () => {
    const inp = uiDefault({
      expenses: defaultFormInput().expenses.map((e) => (e.name === "房租或房貸" ? { ...e, endAge: 40 } : e)),
      lifeGoals: [house],
    });
    const { res, earliest } = computePhase1(inp);
    expect(earliest).toEqual({ type: "age", age: 56 });
    expect(wan(res.retireAssets)).toBe(1058.6);
    expect(wan(res.required)).toBe(88.4);
    expect(res.achieve !== null && Math.round(res.achieve * 1000) / 10).toBe(1197.5);
    expect(wan(res.finalAssets)).toBe(1574.6);
    expect(Math.round(res.workGap)).toBe(0);
    close(monthlyPaymentNominal(house, 30, 2), 38532.01);
    const row = (age: number) => res.rows.find((r) => r.age === age)!;
    expect(Math.round(row(40).goalLump)).toBe(2000000);
    expect(Math.round(row(40).goalPay)).toBe(0);
    expect(Math.round(row(40).assets)).toBe(1088170);
    expect(Math.round(row(41).goalPay)).toBe(371878);
    expect(Math.round(row(41).assets)).toBe(1178368);
    // 貸款跨進退休期：70 歲（退休期）仍在還款、71 歲還清
    expect(Math.round(row(70).goalPay)).toBe(209409);
    expect(Math.round(row(70).assets)).toBe(10950410);
    expect(Math.round(row(71).goalPay)).toBe(0);
    expect(Math.round(row(71).assets)).toBe(11218802);
    // 所需資金改走逐年折現（含退休期還款）：大於無目標情境
    const noGoal = computePhase1({ ...inp, lifeGoals: null });
    expect(res.required).toBeGreaterThan(noGoal.res.required);
    const impact = goalsImpact(inp);
    expect(impact.earliestDiffYears).toBe(12);
    expect(wan(impact.retireAssetsDiff)).toBe(-1950.0);
    expect(wan(impact.finalAssetsDiff)).toBe(-3308.4);
  });

  it("H：預設值＋買車（35 歲、90 萬、頭期 30 萬、3%、5 年）", () => {
    const inp = uiDefault({ lifeGoals: [car] });
    const { res, earliest } = computePhase1(inp);
    expect(earliest).toEqual({ type: "age", age: 47 });
    expect(wan(res.retireAssets)).toBe(2068.7);
    expect(wan(res.required)).toBe(0);
    expect(res.achieve).toBeNull();
    expect(wan(res.finalAssets)).toBe(3357.5);
    expect(Math.round(res.workGap)).toBe(0);
    close(monthlyPaymentNominal(car, 30, 2), 11903.33);
    const row = (age: number) => res.rows.find((r) => r.age === age)!;
    expect(Math.round(row(35).goalLump)).toBe(300000);
    expect(Math.round(row(35).assets)).toBe(1041544);
    expect(Math.round(row(36).goalPay)).toBe(126838);
    expect(Math.round(row(36).assets)).toBe(1215507);
    expect(Math.round(row(40).goalPay)).toBe(117179);
    expect(Math.round(row(40).assets)).toBe(2048719);
    expect(Math.round(row(41).goalPay)).toBe(0);
    expect(Math.round(row(41).assets)).toBe(2409173);
    const impact = goalsImpact(inp);
    expect(impact.earliestDiffYears).toBe(2);
    expect(wan(impact.retireAssetsDiff)).toBe(-305.9);
    expect(wan(impact.finalAssetsDiff)).toBe(-496.4);
  });
});
