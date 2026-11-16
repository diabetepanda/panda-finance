// tests/phase3.test.ts｜規格第 12 節 Phase 3 案例 11、12、13、14 ＋ 中性情境通膨連動
import { describe, it, expect } from "vitest";
import { laborInsuranceMonthly, laborInsuranceRealAnnual, laborPensionMonthlyAnnual } from "../core/social";
import { simulate, type SimInput } from "../core/simulate";
import { computePhase1, resolveScenarioInflation } from "../core/compute";
import { solveMonthlySaving, solveEarliestWithSaving, goalEarliestAnswers } from "../core/goals";
import type { ScenariosOutcome } from "../core/compute";
import { monthlyTotals } from "../core/compute";
import { defaultFormInput } from "./helpers";
import type { SocialInput } from "../core/social";

const socialBase: SocialInput = {
  laborInsurance: {
    existingYears: 0, plannedYears: null, avgInsuredSalary: 40000,
    claimAge: 65, discountPct: 0, indexed: true,
  },
  laborPension: {
    monthlyWage: 40000, employerRatePct: 6, employeeRatePct: 0,
    fundReturnPct: 2, currentBalance: 0, mode: "lump", claimAge: 60,
  },
};

describe("案例 12｜勞保年金公式", () => {
  it("平均月投保薪資 40,000、年資 30 年、費率 1.55%：月領 = 18,600 元", () => {
    const m = laborInsuranceMonthly({ ...socialBase.laborInsurance, claimAge: 65 }, 30);
    expect(Math.abs(m - 18600)).toBeLessThan(0.01);
  });
  it("提前 5 年請領（60 歲）：減給 20%；延後 5 年（70 歲）：增給 20%", () => {
    const early = laborInsuranceMonthly({ ...socialBase.laborInsurance, claimAge: 60 }, 30);
    const late = laborInsuranceMonthly({ ...socialBase.laborInsurance, claimAge: 70 }, 30);
    expect(Math.abs(early - 18600 * 0.8)).toBeLessThan(0.01);
    expect(Math.abs(late - 18600 * 1.2)).toBeLessThan(0.01);
  });
  it("打折 30%：月領 × 0.7", () => {
    const m = laborInsuranceMonthly({ ...socialBase.laborInsurance, discountPct: 30 }, 30);
    expect(Math.abs(m - 18600 * 0.7)).toBeLessThan(0.01);
  });
});

describe("案例 13｜年金不隨通膨調整（k 為從現在起算的總經過年數）", () => {
  it("30 歲、65 歲請領、月領 18,600、通膨 2%：k=35 實質年金 = 223,200；k=40 = 223,200 / 1.02^5", () => {
    const atClaim = laborInsuranceRealAnnual(18600, false, 0.02, 35, 35);
    expect(Math.abs(atClaim - 223200)).toBeLessThan(0.01);
    const at70 = laborInsuranceRealAnnual(18600, false, 0.02, 35, 40);
    expect(Math.abs(at70 - 223200 / Math.pow(1.02, 5))).toBeLessThan(0.01);
  });
  it("隨通膨調整時實質年金維持 223,200 不變", () => {
    expect(laborInsuranceRealAnnual(18600, true, 0.02, 35, 40)).toBe(223200);
  });
});

describe("案例 11｜勞保年金空窗期", () => {
  it("退休 60 歲、請領 65 歲：61–64 歲勞保年金為 0，65 歲起才有，缺口正確反映", () => {
    const inp: SimInput = {
      ...defaultFormInput(),
      ageRetire: 60,
      social: socialBase,
    };
    const res = simulate(inp, 60, 0.5);
    const retire = res.rows.filter((r) => r.phase === "retire");
    for (const row of retire) {
      if (row.age < 65) {
        expect(row.li).toBe(0);
        // 空窗期缺口 = 全部退休支出（其他收入為 0 時）
        expect(Math.abs(row.gap - row.expense)).toBeLessThan(0.01);
      } else {
        expect(row.li).toBeGreaterThan(0);
        expect(row.gap).toBeLessThan(row.expense);
      }
    }
    // 年資 = 0 + (60-30) = 30 年 → 月領 18,600（indexed，實質年額 223,200）
    const at65 = retire.find((r) => r.age === 65)!;
    expect(Math.abs(at65.li - 223200)).toBeLessThan(0.01);
  });
});

describe("案例 14｜反推一致性", () => {
  it("(a) 模式三 Z 等於目前每月結餘時，答案與主畫面最早可退休年齡相同", () => {
    const inp = defaultFormInput();
    const balance = monthlyTotals(inp).balance;
    const main = computePhase1(inp).earliest;
    const viaMode3 = solveEarliestWithSaving(inp, balance);
    expect(viaMode3).toEqual(main);
    expect(main).toEqual({ type: "age", age: 49 });
  });
  it("(b) 模式一求得的儲蓄額代回主模擬，資產剛好撐到預期壽命（誤差在容許範圍內）", () => {
    const inp = defaultFormInput();
    const balance = monthlyTotals(inp).balance;
    const sol = solveMonthlySaving(inp, 65);
    expect(sol.found).toBe(true);
    const back = simulate({ ...inp, extraMonthlySaving: sol.monthlySaving - balance }, 65, 0.5);
    expect(back.exhaustAge).toBeNull();
    const tol = Math.max(back.required * 0.001, 1000);
    expect(back.finalAssets).toBeGreaterThanOrEqual(0);
    expect(back.finalAssets).toBeLessThan(tol);
  });
  it("模式一在範例下：目前結餘 20,000 已超過所需，顯示已達成且有餘裕", () => {
    const inp = defaultFormInput();
    const sol = solveMonthlySaving(inp, 65);
    expect(sol.alreadyAchieved).toBe(true);
    expect(sol.surplus).toBeGreaterThan(0);
  });
});

describe("勞退月領年金化", () => {
  it("實質收益率 0 時退化為總額 ÷ 年數", () => {
    // 基金名目 2%、通膨 2% → 實質 0
    const annual = laborPensionMonthlyAnnual(1200000, 2, 2, 20);
    expect(Math.abs(annual - 1200000 / 20)).toBeLessThan(0.01);
  });
});

describe("中性情境通膨連動（Phase 3 修正）", () => {
  it("未手動修改（linked）時，中性情境通膨跟著主畫面通膨變動；保守/樂觀不變", () => {
    const raw = { conservative: 3, neutral: 2, optimistic: 1.5 };
    const resolved = resolveScenarioInflation(raw, true, 2.8);
    expect(resolved.neutral).toBe(2.8);
    expect(resolved.conservative).toBe(3);
    expect(resolved.optimistic).toBe(1.5);
  });
  it("手動修改後（unlinked）維持手動值，不受主畫面影響", () => {
    const raw = { conservative: 3, neutral: 4.2, optimistic: 1.5 };
    expect(resolveScenarioInflation(raw, false, 2.8).neutral).toBe(4.2);
  });
});

describe("修正（2026-11-17）｜標的未啟用時反推走 UI 管線的單一答案", () => {
  it("透過 UI 入口 goalEarliestAnswers（assetsEnabled=false），模式三 Z = 目前結餘 → 與主畫面最早退休年齡相同", () => {
    const inp = defaultFormInput();
    const scenStub: ScenariosOutcome = { paused: false, pauseReason: null, allocationTotalPct: 100, retireAllocationTotalPct: 100, scenarios: [] };
    const answers = goalEarliestAnswers(false, inp, scenStub, monthlyTotals(inp).balance);
    expect(answers).toHaveLength(1);
    expect(answers[0].key).toBe("single");
    const main = computePhase1(inp).earliest;
    expect(answers[0].earliest).toEqual(main);
    if (answers[0].earliest.type === "age" && main.type === "age") {
      expect(answers[0].earliest.age).toBe(49);
    } else {
      throw new Error("expected age result");
    }
  });
});

describe("修正（2026-11-17）｜勞退請領年齡與空窗期", () => {
  const mkInp = (mode: "lump" | "monthly"): SimInput => {
    const inp = defaultFormInput();
    inp.ageRetire = 50;
    inp.social = {
      laborInsurance: { ...socialBase.laborInsurance, claimAge: 65 },
      laborPension: { ...socialBase.laborPension, mode, claimAge: 60, currentBalance: 0 },
    };
    return inp;
  };
  it("(a) 月領：退休 50、請領 60 → 50–59 歲勞退收入 0，60 歲起才有", () => {
    const res = simulate(mkInp("monthly"), 50, 0);
    const lpAt = (age: number) => res.rows.find((r) => r.age === age)!.lp;
    for (let age = 51; age <= 59; age++) expect(lpAt(age)).toBe(0);
    expect(lpAt(60)).toBeGreaterThan(0); // 滿 60 歲那一年起開始領
    expect(lpAt(61)).toBeGreaterThan(0);
    expect(res.socialDetail!.lpStartAge).toBe(60);
    expect(res.socialDetail!.lpMonthlyAnnual).toBeGreaterThan(0);
  });
  it("(b) 一次領：退休當下資產不含勞退，60 歲那年才併入，金額 = 退休時帳戶 × (1+實質收益率)^10", () => {
    const inp = mkInp("lump");
    inp.inflation = 2; inp.retPost = 2; // rho = 0，排除退休後報酬干擾
    inp.retireSpend = 0; inp.otherRetireIncome = 0; // 無支出，資產變化只來自併入
    inp.social!.laborInsurance.indexed = true;
    const res = simulate(inp, 50, 0);
    const bal = res.socialDetail!.lpBalance;
    expect(bal).toBeGreaterThan(0);
    // 退休時資產（50 歲）不含勞退帳戶
    const noSocial = simulate({ ...inp, social: null }, 50, 0);
    expect(Math.abs(res.retireAssets - noSocial.retireAssets)).toBeLessThan(0.01);
    const rf = (1 + 0.02) / (1 + 0.02) - 1; // 基金名目 2%、通膨 2% → 實質 0
    const expected = bal * Math.pow(1 + rf, 10);
    const row59 = res.rows.find((r) => r.age === 59)!;
    const row60 = res.rows.find((r) => r.age === 60)!;
    expect(Math.abs(row60.assets - row59.assets - expected)).toBeLessThan(0.01);
    expect(Math.abs(res.socialDetail!.lpLumpAtClaim - expected)).toBeLessThan(0.01);
  });
  it("(b2) 一次領空窗期累積：基金實質收益率 > 0 時併入金額大於退休時帳戶", () => {
    const inp = mkInp("lump");
    inp.inflation = 0; // 實質收益率 = 基金名目 2%
    const res = simulate(inp, 50, 0);
    const bal = res.socialDetail!.lpBalance;
    const expected = bal * Math.pow(1.02, 10);
    expect(Math.abs(res.socialDetail!.lpLumpAtClaim - expected)).toBeLessThan(0.01);
  });
});
