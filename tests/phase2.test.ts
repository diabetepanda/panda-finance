// tests/phase2.test.ts｜規格第 12 節 Phase 2 案例 5、9、10、16、17
import { describe, it, expect } from "vitest";
import { fxAdjustedReturn, assetReturnTwd, portfolioReturn, isAllocationValid } from "../core/portfolio";
import { computePhase1, computeScenarios, type ScenarioSettings } from "../core/compute";
import { simulate, type SimInput } from "../core/simulate";
import { realRate, nominalToReal } from "../core/rates";
import { defaultFormInput } from "./helpers";

function settings(patch: Partial<ScenarioSettings>): ScenarioSettings {
  return {
    allocation: { voo: 100 },
    retireAllocMode: "same",
    retireAllocation: {},
    fxChangePct: 0,
    returnOverrides: {},
    scenarioInflation: { conservative: 3, neutral: 2, optimistic: 1.5 },
    deductionPct: 2,
    ...patch,
  };
}

describe("案例 5｜配置總和不是 100% 時暫停計算", () => {
  it("90% 配置：isAllocationValid=false 且情境管線 paused，不產生情境結果", () => {
    expect(isAllocationValid({ voo: 90 })).toBe(false);
    const out = computeScenarios(defaultFormInput(), settings({ allocation: { voo: 90 } }));
    expect(out.paused).toBe(true);
    expect(out.pauseReason).toBe("請先讓配置總和為 100%");
    expect(out.scenarios).toHaveLength(0);
  });
  it("自訂退休後配置總和不是 100% 時同樣暫停", () => {
    const out = computeScenarios(defaultFormInput(), settings({ retireAllocMode: "custom", retireAllocation: { cash: 50 } }));
    expect(out.paused).toBe(true);
  });
});

describe("案例 9｜匯率調整方向", () => {
  it("新台幣升值 3%：VOO 7% 的新台幣報酬小於 7%，且約等於 (1.07/1.03)-1", () => {
    const adj = fxAdjustedReturn(0.07, 0.03);
    expect(adj).toBeLessThan(0.07);
    expect(Math.abs(adj - (1.07 / 1.03 - 1))).toBeLessThan(1e-12);
  });
  it("新台幣貶值 3%：新台幣報酬大於 7%，且約等於 (1.07/0.97)-1", () => {
    const adj = fxAdjustedReturn(0.07, -0.03);
    expect(adj).toBeGreaterThan(0.07);
    expect(Math.abs(adj - (1.07 / 0.97 - 1))).toBeLessThan(1e-12);
  });
  it("新台幣計價標的不套用匯率：0050 報酬不隨匯率變動", () => {
    const a = assetReturnTwd("tw0050", "neutral", {}, 0.03);
    const b = assetReturnTwd("tw0050", "neutral", {}, -0.03);
    expect(a).toBe(b);
    expect(Math.abs(a - 0.07)).toBeLessThan(1e-12);
  });
  it("匯率只套用一次：VOO 100% 組合報酬 = 單一標的調整後報酬（不重複套用）", () => {
    const p = portfolioReturn({ voo: 100 }, "neutral", {}, 0.03);
    expect(Math.abs(p - fxAdjustedReturn(0.07, 0.03))).toBeLessThan(1e-12);
  });
});

describe("案例 10｜關閉標的選擇與 Phase 1 完全一致（回歸）", () => {
  it("(a) Phase 2 管線（computePhase1）與 Phase 1 simulate/earliest 逐項一致", () => {
    const inp = defaultFormInput();
    const viaP2 = computePhase1(inp);
    const direct = simulate(inp, inp.ageRetire, 0);
    expect(viaP2.res.retireAssets).toBe(direct.retireAssets);
    expect(viaP2.res.required).toBe(direct.required);
    expect(viaP2.res.achieve).toBe(direct.achieve);
    expect(viaP2.res.exhaustAge).toBe(direct.exhaustAge);
    expect(viaP2.res.rows).toEqual(direct.rows);
  });
  it("(b) 單一標的 100%、報酬率同 Phase 1（6%）、折減 2 百分點 → 中性情境與 Phase 1 逐項一致", () => {
    const inp = defaultFormInput(); // Phase 1：retPre 6、retPost 4、inflation 2
    const p1 = computePhase1(inp);
    const out = computeScenarios(inp, settings({
      allocation: { voo: 100 },
      returnOverrides: { voo: { conservative: 5, neutral: 6, optimistic: 9 } },
      scenarioInflation: { conservative: 3, neutral: 2, optimistic: 1.5 },
      deductionPct: 2, // 6 - 2 = 4 = Phase 1 retPost
      fxChangePct: 0,
    }));
    expect(out.paused).toBe(false);
    const neu = out.scenarios.find((x) => x.id === "neutral")!;
    expect(neu.preReturnPct).toBeCloseTo(6, 9);
    expect(neu.postReturnPct).toBeCloseTo(4, 9);
    expect(neu.res.retireAssets).toBe(p1.res.retireAssets);
    expect(neu.res.required).toBe(p1.res.required);
    expect(neu.res.achieve).toBe(p1.res.achieve);
    expect(neu.res.exhaustAge).toBe(p1.res.exhaustAge);
    expect(neu.res.rows).toEqual(p1.res.rows);
    expect(neu.earliest).toEqual(p1.earliest);
  });
});

describe("案例 16｜分類通膨", () => {
  const base: SimInput = {
    ageNow: 30, ageRetire: 65, ageLife: 85,
    initAssets: 0, otherRetireIncome: 0,
    monthlyIncome: 50000, salaryGrowth: 2,
    expenses: [
      { name: "伙食", amount: 10000, endAge: null, category: "food" },
      { name: "其他", amount: 10000, endAge: null, category: "other" },
    ],
    retireSpend: 15000, inflation: 2, retPre: 6, retPost: 4, extraMonthlySaving: 0,
  };
  it("伙食類通膨 5% > 總通膨 2%：第 2 年伙食支出以實質成長率 (1.05/1.02-1) 成長，其他類別維持不變", () => {
    const inp: SimInput = { ...base, categoryInflation: { food: 5, other: null } };
    const res = simulate(inp, 65, 0);
    const row2 = res.rows.find((r) => r.t === 2)!;
    const expectedFood = 10000 * 12 * (1 + realRate(0.05, 0.02));
    expect(Math.abs(row2.expense - (expectedFood + 10000 * 12))).toBeLessThan(0.01);
    const row1 = res.rows.find((r) => r.t === 1)!;
    expect(row1.expense).toBe(240000); // 第 1 年仍為今日幣值水準
  });
  it("所有類別通膨都等於總通膨時，與單一通膨（Phase 1）逐項一致", () => {
    const single = simulate({ ...base, categoryInflation: null }, 65, 0);
    const cats = simulate({ ...base, categoryInflation: { food: 2, other: 2 } }, 65, 0);
    expect(cats.retireAssets).toBe(single.retireAssets);
    expect(cats.rows.map((r) => r.expense)).toEqual(single.rows.map((r) => r.expense));
  });
  it("退休支出依類別拆分：退休支出逐年成長、所需資金改逐年折現，與固定缺口結果不同", () => {
    const split: SimInput = {
      ...base,
      categoryInflation: { food: 5, other: null },
      retireSpendCategories: [
        { category: "food", monthly: 7500 },
        { category: "other", monthly: 7500 },
      ],
    };
    const resSplit = simulate(split, 65, 0);
    const resFixed = simulate({ ...base, categoryInflation: { food: 5, other: null } }, 65, 0);
    const firstRet = resSplit.rows.find((r) => r.phase === "retire")!;
    const lastRet = [...resSplit.rows].reverse().find((r) => r.phase === "retire")!;
    expect(lastRet.expense).toBeGreaterThan(firstRet.expense); // 伙食部分持續成長
    expect(resSplit.required).not.toBe(resFixed.required);
  });
});

describe("案例 17｜實質薪資成長為負", () => {
  it("名目薪資成長 1%、通膨 3%：g < 0（約 -1.94%），且 10 年後同薪水購買力低於今天", () => {
    const g = realRate(0.01, 0.03);
    expect(g).toBeLessThan(0);
    expect(Math.abs(g - (1.01 / 1.03 - 1))).toBeLessThan(1e-12);
    const pp = nominalToReal(50000, 0.03, 10);
    expect(pp).toBeLessThan(50000);
    expect(Math.abs(pp - 50000 / Math.pow(1.03, 10))).toBeLessThan(0.01);
  });
});
