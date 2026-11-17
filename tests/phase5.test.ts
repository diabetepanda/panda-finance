// tests/phase5.test.ts｜Phase 5：勞保勞退「幫我估」、舊檔轉換、結論句、驗收 A–F
import { describe, it, expect } from "vitest";
import {
  estimateExistingYears, wageBasis, estimateInsuredSalary, estimateLrWage,
  estimateLrBalance, resolveSocialInput, validateSocialChoice, type SocialChoice,
} from "../core/socialEstimate";
import { migrateLegacyForm } from "../core/importForm";
import { plainConclusion, shortConclusionLine } from "../core/conclusion";
import { computePhase1 } from "../core/compute";
import { paramValue } from "../config/defaults";
import { defaultFormInput } from "./helpers";
import type { SimInput } from "../core/simulate";

describe("第八節｜估算函式", () => {
  it("estimateExistingYears", () => {
    expect(estimateExistingYears(30, 30)).toBe(0);
    expect(estimateExistingYears(30, 23)).toBe(7);
    expect(estimateExistingYears(25, 30)).toBe(0);
    expect(estimateExistingYears(30, NaN)).toBe(0);
  });
  it("wageBasis：空白或 0 用實領，有值用稅前", () => {
    expect(wageBasis(NaN, 50000)).toBe(50000);
    expect(wageBasis(0, 50000)).toBe(50000);
    expect(wageBasis(50000, 35000)).toBe(50000);
  });
  it("estimateInsuredSalary 對 115 年勞保級距", () => {
    expect(estimateInsuredSalary(50000)).toBe(45800);
    expect(estimateInsuredSalary(35000)).toBe(36300);
    expect(estimateInsuredSalary(38000)).toBe(38200);
    expect(estimateInsuredSalary(20000)).toBe(29500);
  });
  it("estimateLrWage 對 115 年勞退級距", () => {
    expect(estimateLrWage(50000)).toBe(50600);
    expect(estimateLrWage(35000)).toBe(36300);
    expect(estimateLrWage(38000)).toBe(38200);
  });
  it("estimateLrBalance 只算本金", () => {
    expect(estimateLrBalance(7, 50600, 6)).toBe(255024);
    expect(estimateLrBalance(6, 36300, 6)).toBe(156816);
    expect(estimateLrBalance(0, 50600, 6)).toBe(0);
  });
  it("validateSocialChoice 只提示不阻擋", () => {
    expect(validateSocialChoice({ ageNow: 30, startWorkAge: 35, grossSalary: NaN })
      .some((m) => m.includes("不能大於現在年齡"))).toBe(true);
    expect(validateSocialChoice({ ageNow: 30, startWorkAge: 30, grossSalary: -1 }).length).toBeGreaterThan(0);
    expect(validateSocialChoice({ ageNow: 30, startWorkAge: 23, grossSalary: NaN })).toEqual([]);
  });
});

/** 預設選擇（= Phase 5 預設表單：有＋幫我估、開始工作 30、稅前空白、實領 50,000） */
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

describe("第八節｜resolveSocialInput", () => {
  it("「沒有」→ null", () => {
    expect(resolveSocialInput(defaultChoice({ laborInsured: "no" }))).toBeNull();
  });
  it("預設選擇與 Phase 4.1 預設 toInput 的 social 逐欄相同", () => {
    const s = resolveSocialInput(defaultChoice());
    expect(s).toEqual({
      laborInsurance: { existingYears: 0, plannedYears: null, avgInsuredSalary: 45800, claimAge: 65, discountPct: 0, indexed: true },
      laborPension: { monthlyWage: 50600, employerRatePct: 6, employeeRatePct: 0, fundReturnPct: 2, currentBalance: 0, mode: "lump", claimAge: 60 },
    });
  });
  it("「不確定」與「有＋幫我估」相同", () => {
    const c = defaultChoice({ startWorkAge: 23, grossSalary: 50000 });
    expect(resolveSocialInput({ ...c, laborInsured: "unsure" })).toEqual(resolveSocialInput(c));
  });
});

describe("第八節｜migrateLegacyForm", () => {
  it("socialEnabled true → yes＋手動模式，舊欄位保留", () => {
    const out = migrateLegacyForm({ socialEnabled: true, liExistingYears: "7", lrBalance: "100" });
    expect(out.laborInsured).toBe("yes");
    expect(out.socialInputMode).toBe("manual");
    expect(out.liExistingYears).toBe("7");
    expect("socialEnabled" in out).toBe(false);
  });
  it("socialEnabled false → no", () => {
    expect(migrateLegacyForm({ socialEnabled: false }).laborInsured).toBe("no");
  });
  it("沒有 version、沒有 socialEnabled 的檔原樣通過；有 endAge 支出自動開開關", () => {
    const out = migrateLegacyForm({ ageNow: "40" });
    expect(out.laborInsured).toBeUndefined();
    const out2 = migrateLegacyForm({ expenses: [{ name: "房貸", amount: "1", endAge: "50" }] });
    expect(out2.showExpenseEndAge).toBe(true);
  });
});

describe("第六節｜plainConclusion", () => {
  const base = defaultFormInput();
  it("有最早年齡：兩句都在", () => {
    const inp: SimInput = { ...base, retPre: paramValue("retPre"), retPost: paramValue("retPost"), social: resolveSocialInput(defaultChoice()) };
    const { res, earliest } = computePhase1(inp);
    const s = plainConclusion({ earliest, res, retireAge: 65, lifeExpectancy: 85, cap: paramValue("earliestRetirementCap") });
    expect(s).toContain("你最早大約 45 歲就能退休");
    expect(s).toContain("你預計 65 歲退休，資產可以撐到 85 歲。");
    expect(shortConclusionLine({ earliest, res, retireAge: 65, lifeExpectancy: 85, cap: 75 })).toContain("最早約 45 歲可以退休");
  });
  it("無法達成", () => {
    const inp: SimInput = { ...base, monthlyIncome: 20000, social: null };
    const { res, earliest } = computePhase1(inp);
    expect(earliest.type).toBe("none");
    const s = plainConclusion({ earliest, res, retireAge: 65, lifeExpectancy: 85, cap: paramValue("earliestRetirementCap") });
    expect(s).toContain("還不能安心退休");
    expect(s).toContain("怎麼改善");
  });
  it("已退休", () => {
    const inp: SimInput = { ...base, ageNow: 65, ageRetire: 65, social: null };
    const { res, earliest } = computePhase1(inp);
    expect(earliest.type).toBe("already");
    expect(plainConclusion({ earliest, res, retireAge: 65, lifeExpectancy: 85, cap: 75 })).toContain("已屆退休年齡");
  });
});

const wan = (v: number) => Math.round(v / 1000) / 10; // 萬，一位小數

/** 第十節驗收用輸入：網站 UI 預設（retPre 6.5／retPost 4.5），不是 helpers 的 Phase 1 固定口徑 */
function uiDefaultInput(over: Partial<SimInput> = {}): SimInput {
  return { ...defaultFormInput(), retPre: paramValue("retPre"), retPost: paramValue("retPost"), social: null, ...over };
}

describe("第十節｜驗收數字 A–F", () => {
  it("A 預設範例（有＋幫我估）＝ Phase 4.1", () => {
    const inp = uiDefaultInput({ social: resolveSocialInput(defaultChoice()) });
    const { res, earliest } = computePhase1(inp);
    expect(wan(res.retireAssets)).toBe(2374.5);
    expect(res.required).toBe(0);
    expect(res.achieve).toBeNull();
    expect(earliest).toMatchObject({ type: "age", age: 45 });
    expect(wan(res.finalAssets)).toBe(3853.9);
    expect(res.socialDetail?.liYears).toBe(35);
    expect(Math.round(res.socialDetail!.liMonthlyToday)).toBe(24847);
    expect(Math.round(res.socialDetail!.lpBalance)).toBe(1387341);
  });
  it("B 勞保「沒有」＝ Phase 4.1 不含勞保勞退", () => {
    const inp = uiDefaultInput({ social: resolveSocialInput(defaultChoice({ laborInsured: "no" })) });
    const { res, earliest } = computePhase1(inp);
    expect(wan(res.retireAssets)).toBe(2235.8);
    expect(wan(res.required)).toBe(422.9);
    expect(Math.round((res.achieve ?? 0) * 1000) / 10).toBe(528.7);
    expect(earliest).toMatchObject({ type: "age", age: 48 });
    expect(wan(res.finalAssets)).toBe(2942.4);
  });
  it("C 23 歲開始工作、稅前 50,000", () => {
    const est = resolveSocialInput(defaultChoice({ startWorkAge: 23, grossSalary: 50000 }));
    expect(est?.laborInsurance.existingYears).toBe(7);
    expect(est?.laborInsurance.avgInsuredSalary).toBe(45800);
    expect(est?.laborPension.monthlyWage).toBe(50600);
    expect(est?.laborPension.currentBalance).toBe(255024);
    const inp = uiDefaultInput({ social: est });
    const { res, earliest } = computePhase1(inp);
    expect(wan(res.retireAssets)).toBe(2400.0);
    expect(res.required).toBe(0);
    expect(earliest).toMatchObject({ type: "age", age: 44 });
    expect(wan(res.finalAssets)).toBe(3895.3);
    expect(res.socialDetail?.liYears).toBe(42);
    expect(Math.round(res.socialDetail!.liMonthlyToday)).toBe(29816);
    expect(Math.round(res.socialDetail!.lpBalance)).toBe(1642365);
    // 稅前空白結果相同
    const inp2 = uiDefaultInput({ social: resolveSocialInput(defaultChoice({ startWorkAge: 23 })) });
    expect(computePhase1(inp2).res.retireAssets).toBe(res.retireAssets);
  });
  it("D1 低薪實領 35,000、稅前空白", () => {
    const est = resolveSocialInput(defaultChoice({ startWorkAge: 24, monthlyIncome: 35000 }));
    expect(est?.laborInsurance.existingYears).toBe(6);
    expect(est?.laborInsurance.avgInsuredSalary).toBe(36300);
    expect(est?.laborPension.currentBalance).toBe(156816);
    const inp = uiDefaultInput({ monthlyIncome: 35000, social: est });
    const { res, earliest } = computePhase1(inp);
    expect(wan(res.retireAssets)).toBe(815.8);
    expect(res.required).toBe(0);
    expect(earliest).toMatchObject({ type: "age", age: 53 });
    expect(Math.round(res.socialDetail!.liMonthlyToday)).toBe(23069);
    expect(Math.round(res.socialDetail!.lpBalance)).toBe(1152083);
  });
  it("D2 低薪、稅前 38,000", () => {
    const est = resolveSocialInput(defaultChoice({ startWorkAge: 24, monthlyIncome: 35000, grossSalary: 38000 }));
    expect(est?.laborInsurance.avgInsuredSalary).toBe(38200);
    expect(est?.laborPension.monthlyWage).toBe(38200);
    expect(est?.laborPension.currentBalance).toBe(165024);
    const inp = uiDefaultInput({ monthlyIncome: 35000, social: est });
    const { res, earliest } = computePhase1(inp);
    expect(wan(res.retireAssets)).toBe(821.8);
    expect(res.required).toBe(0);
    expect(earliest).toMatchObject({ type: "age", age: 53 });
    expect(Math.round(res.socialDetail!.liMonthlyToday)).toBe(24276);
    expect(Math.round(res.socialDetail!.lpBalance)).toBe(1212385);
  });
  it("E 手動模式與 C 等價", () => {
    const manual = resolveSocialInput(defaultChoice({
      socialInputMode: "manual", liExistingYears: 7, liSalaryManual: false, lrBalance: 255024, lrEmployeeRate: 0,
    }));
    const estC = resolveSocialInput(defaultChoice({ startWorkAge: 23, grossSalary: 50000 }));
    expect(manual).toEqual(estC);
    const inp = uiDefaultInput({ social: manual });
    expect(wan(computePhase1(inp).res.retireAssets)).toBe(2400.0);
  });
  it("F 舊檔相容：socialEnabled true 匯入後仍是 A、false 是 B", () => {
    const legacy = migrateLegacyForm({ socialEnabled: true, liExistingYears: "0", liAvgSalary: "", lrBalance: "0", lrEmployeeRate: "0" });
    expect(legacy.laborInsured).toBe("yes");
    expect(legacy.socialInputMode).toBe("manual");
    const social = resolveSocialInput(defaultChoice({
      laborInsured: legacy.laborInsured as "yes", socialInputMode: "manual",
      liExistingYears: 0, lrBalance: 0,
    }));
    const inp = uiDefaultInput({ social });
    const { res, earliest } = computePhase1(inp);
    expect(wan(res.retireAssets)).toBe(2374.5);
    expect(earliest).toMatchObject({ type: "age", age: 45 });
    const legacy2 = migrateLegacyForm({ socialEnabled: false });
    expect(resolveSocialInput(defaultChoice({ laborInsured: legacy2.laborInsured as "no" }))).toBeNull();
  });
});
