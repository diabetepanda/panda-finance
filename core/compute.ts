// core/compute.ts｜計算管線（原 ui/App.tsx 的 compute 移入 core，ui 只呼叫取結果）
// Phase 1 管線與 Phase 2 情境管線都集中在這裡。

import { simulate, type SimInput, type SimResult } from "./simulate";
import { earliestRetirement, type EarliestResult } from "./retirement";
import { realRate } from "./rates";
import { portfolioReturn, postRetirementReturn, isAllocationValid, allocationTotal } from "./portfolio";
import { paramValue } from "../config/defaults";
import { SCENARIO_IDS, type ScenarioId } from "../config/assets";
import type { CategoryId } from "../config/categories";

export interface MonthlyTotals {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  savingsRate: number; // 小數
}

/** 每月收支合計與儲蓄率（顯示用數字也由 core 計算） */
export function monthlyTotals(inp: SimInput): MonthlyTotals {
  const totalExpense = inp.expenses.reduce((s, e) => s + e.amount, 0);
  const balance = inp.monthlyIncome - totalExpense;
  return {
    totalIncome: inp.monthlyIncome,
    totalExpense,
    balance,
    savingsRate: inp.monthlyIncome > 0 ? balance / inp.monthlyIncome : 0,
  };
}

/** 各類別每月支出合計（退休支出拆分預設值用） */
export function totalsByCategory(inp: SimInput): Record<CategoryId, number> {
  const out: Record<CategoryId, number> = { housing: 0, food: 0, medical: 0, other: 0 };
  for (const e of inp.expenses) out[e.category ?? "other"] += e.amount;
  return out;
}

export interface Phase1Outcome {
  res: SimResult;
  earliest: EarliestResult;
  totals: MonthlyTotals;
}

/** Phase 1 管線：simulate（設定退休年齡）+ earliestRetirement */
export function computePhase1(inp: SimInput): Phase1Outcome {
  const extra = inp.extraMonthlySaving;
  const res = simulate({ ...inp, extraMonthlySaving: 0 }, inp.ageRetire, extra);
  const earliest = earliestRetirement(inp);
  return { res, earliest, totals: monthlyTotals(inp) };
}

/** 「薪水有沒有跑贏通膨」（第 5.6 節）：實質薪資成長率 g（小數） */
export function salaryRealGrowth(inp: SimInput): number {
  return realRate(inp.salaryGrowth / 100, inp.inflation / 100);
}

// ---------------- Phase 2 情境管線 ----------------

export interface ScenarioSettings {
  allocation: Record<string, number>;
  retireAllocMode: "same" | "custom";
  retireAllocation: Record<string, number>;
  fxChangePct: number; // 新台幣對美元年變動率（%）
  returnOverrides: Record<string, Record<ScenarioId, number>>; // 標的 -> 情境 -> 名目報酬率%
  scenarioInflation: Record<ScenarioId, number>; // 情境通膨率%
  deductionPct: number; // 退休後折減（百分點）
}

export interface ScenarioOutcome {
  id: ScenarioId;
  inp: SimInput; // 該情境實際使用的輸入（通膨與報酬率已套入）
  inflationPct: number;
  preReturnPct: number; // 組合名目報酬率%
  postReturnPct: number;
  res: SimResult;
  earliest: EarliestResult;
}

export interface ScenariosOutcome {
  paused: boolean;
  pauseReason: string | null;
  allocationTotalPct: number;
  retireAllocationTotalPct: number;
  scenarios: ScenarioOutcome[];
}

/**
 * 三情境管線（第 5.5 節）：每情境以自己的通膨率與組合報酬率跑完整 simulate。
 * 配置總和不是 100% 時暫停計算（第 5.2 節），不以不完整配置繼續算。
 */
export function computeScenarios(baseInp: SimInput, s: ScenarioSettings): ScenariosOutcome {
  const total = allocationTotal(s.allocation);
  const retireTotal = s.retireAllocMode === "custom" ? allocationTotal(s.retireAllocation) : 100;
  const paused = !isAllocationValid(s.allocation) || (s.retireAllocMode === "custom" && !isAllocationValid(s.retireAllocation));
  if (paused) {
    return {
      paused: true,
      pauseReason: "請先讓配置總和為 100%",
      allocationTotalPct: total,
      retireAllocationTotalPct: retireTotal,
      scenarios: [],
    };
  }
  const fx = s.fxChangePct / 100;
  const scenarios: ScenarioOutcome[] = SCENARIO_IDS.map((id) => {
    const pre = portfolioReturn(s.allocation, id, s.returnOverrides, fx);
    const post = postRetirementReturn(pre, s.retireAllocMode, s.retireAllocation, id, s.returnOverrides, fx, s.deductionPct / 100);
    const inp: SimInput = {
      ...baseInp,
      inflation: s.scenarioInflation[id],
      retPre: pre * 100,
      retPost: post * 100,
      extraMonthlySaving: 0,
    };
    const res = simulate(inp, inp.ageRetire, baseInp.extraMonthlySaving);
    const earliest = earliestRetirement(inp);
    return { id, inp, inflationPct: s.scenarioInflation[id], preReturnPct: pre * 100, postReturnPct: post * 100, res, earliest };
  });
  return { paused: false, pauseReason: null, allocationTotalPct: total, retireAllocationTotalPct: retireTotal, scenarios };
}

/** 情境預設通膨（config） */
export function defaultScenarioInflation(): Record<ScenarioId, number> {
  return {
    conservative: paramValue("scenarioInflationConservative"),
    neutral: paramValue("scenarioInflationNeutral"),
    optimistic: paramValue("scenarioInflationOptimistic"),
  };
}
