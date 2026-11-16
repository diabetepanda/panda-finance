// core/goals.ts｜目標反推（規格第 6.5 節）
// 所有反推都呼叫主模擬引擎 simulate / earliestRetirement，不另寫公式。
// 二分搜尋最多 60 次（config solverMaxIterations），不收斂回傳提示。

import { simulate, type SimInput } from "./simulate";
import { earliestRetirement, type EarliestResult } from "./retirement";
import { monthlyTotals, type ScenariosOutcome } from "./compute";
import { paramValue } from "../config/defaults";

function lastsToLife(inp: SimInput, retireAge: number): { lasts: boolean; finalAssets: number; required: number } {
  const r = simulate(inp, retireAge, paramValue("exhaustTolerance"));
  return { lasts: r.exhaustAge === null, finalAssets: r.finalAssets, required: r.required };
}

export interface SavingSolution {
  found: boolean;
  reason: string | null;
  monthlySaving: number; // 需要的每月儲蓄總額（元，今日幣值）
  pctOfIncome: number | null; // 佔月收入比例（小數）
  gapVsCurrent: number; // 與目前每月結餘的差距（正 = 還要多存）
  alreadyAchieved: boolean; // 目前結餘已足夠
  surplus: number; // 已達成時的餘裕（目前結餘 − 需要儲蓄）
}

/**
 * 模式一核心：在 targetRetireAge 退休、其餘假設不變，求最小每月儲蓄額 S。
 * S 以 extraMonthlySaving = S − 目前結餘 代入主引擎。
 * 搜尋區間 [0, 月收入]，不足擴大到 2 倍；仍不足回傳 found=false。
 */
export function solveMonthlySaving(inp: SimInput, targetRetireAge: number): SavingSolution {
  const balance = monthlyTotals(inp).balance;
  const maxIter = paramValue("solverMaxIterations");
  const withSaving = (s: number): SimInput => ({ ...inp, extraMonthlySaving: s - balance });
  const fail = (reason: string): SavingSolution => ({
    found: false, reason, monthlySaving: 0, pctOfIncome: null,
    gapVsCurrent: 0, alreadyAchieved: false, surplus: 0,
  });

  let hi = inp.monthlyIncome;
  if (!lastsToLife(withSaving(hi), targetRetireAge).lasts) {
    hi = inp.monthlyIncome * paramValue("solverMaxExtraMultiple");
    if (!lastsToLife(withSaving(hi), targetRetireAge).lasts) {
      return fail("在目前假設下，即使把收入全部存下也無法達成");
    }
  }
  if (lastsToLife(withSaving(0), targetRetireAge).lasts) {
    return {
      found: true, reason: null, monthlySaving: 0,
      pctOfIncome: inp.monthlyIncome > 0 ? 0 : null,
      gapVsCurrent: -balance, alreadyAchieved: balance >= 0, surplus: Math.max(0, balance),
    };
  }
  let lo = 0;
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    if (lastsToLife(withSaving(mid), targetRetireAge).lasts) hi = mid; else lo = mid;
    if (hi - lo < 0.5) break;
  }
  const check = lastsToLife(withSaving(hi), targetRetireAge);
  const tol = check.required * (paramValue("goalToleranceRatio") / 100);
  if (!check.lasts || check.finalAssets > Math.max(tol, 1)) {
    // 已收斂到最小 S 時 finalAssets 應接近 0；差距過大視為未收斂提示
    if (!check.lasts) return fail("搜尋未收斂，請調整假設後再試");
  }
  return {
    found: true, reason: null, monthlySaving: Math.ceil(hi),
    pctOfIncome: inp.monthlyIncome > 0 ? hi / inp.monthlyIncome : null,
    gapVsCurrent: hi - balance,
    alreadyAchieved: balance >= hi,
    surplus: Math.max(0, balance - hi),
  };
}

export interface LumpSolution {
  found: boolean;
  reason: string | null;
  lumpSum: number; // 現在需要一次投入的金額（元，今日幣值；不含既有資產）
}

/** 模式二 (b)：每月儲蓄為 0、既有資產不變，求現在需一次投入多少（代入主引擎二分搜尋） */
export function solveLumpSum(inp: SimInput, targetRetireAge: number): LumpSolution {
  const balance = monthlyTotals(inp).balance;
  const base: SimInput = { ...inp, extraMonthlySaving: -balance }; // 每月儲蓄 = 0
  const maxIter = paramValue("solverMaxIterations");
  const withLump = (x: number): SimInput => ({ ...base, initAssets: inp.initAssets + x });
  if (lastsToLife(withLump(0), targetRetireAge).lasts) {
    return { found: true, reason: null, lumpSum: 0 };
  }
  let hi = Math.max(inp.monthlyIncome * 12, 1);
  let expansions = 0;
  while (!lastsToLife(withLump(hi), targetRetireAge).lasts) {
    hi *= 2;
    expansions++;
    if (expansions > maxIter) return { found: false, reason: "搜尋未收斂，請調整假設後再試", lumpSum: 0 };
  }
  let lo = 0;
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    if (lastsToLife(withLump(mid), targetRetireAge).lasts) hi = mid; else lo = mid;
    if (hi - lo < 1) break;
  }
  return { found: true, reason: null, lumpSum: Math.ceil(hi) };
}

/**
 * 模式三：每月可存 Z 元時的最早退休年齡。
 * 以 extraMonthlySaving = Z − 目前結餘 沿用 3.7 的最早退休搜尋（主引擎）。
 * Z 等於目前結餘時 extra = 0，結果與主畫面最早可退休年齡相同（案例 14a）。
 */
export function solveEarliestWithSaving(inp: SimInput, monthlySavingZ: number): EarliestResult {
  const balance = monthlyTotals(inp).balance;
  return earliestRetirement({ ...inp, extraMonthlySaving: monthlySavingZ - balance });
}

// ---- UI 入口（介面實際使用的計算管線） ----
// 標的未啟用時：反推只用與主畫面完全相同的假設（主畫面 inp）給一個答案，
// 不得改用第 5 區保留的配置/情境（那會與主畫面報酬率對不起來，且偏樂觀）。
// 標的啟用時：維持三種情境各給一個答案。
export interface GoalRow { key: string; inp: SimInput }

export function goalRows(assetsEnabled: boolean, mainInp: SimInput, scen: ScenariosOutcome): GoalRow[] {
  if (!assetsEnabled) return [{ key: "single", inp: mainInp }];
  return scen.scenarios.map((sc) => ({ key: sc.id, inp: sc.inp }));
}

export function goalSavingAnswers(assetsEnabled: boolean, mainInp: SimInput, scen: ScenariosOutcome, targetRetireAge: number) {
  return goalRows(assetsEnabled, mainInp, scen).map((r) => ({ key: r.key, sol: solveMonthlySaving(r.inp, targetRetireAge) }));
}

export function goalSpendAnswers(assetsEnabled: boolean, mainInp: SimInput, scen: ScenariosOutcome, targetSpendMonthly: number) {
  return goalRows(assetsEnabled, mainInp, scen).map((r) => {
    const inpY: SimInput = { ...r.inp, retireSpend: targetSpendMonthly, retireSpendCategories: null };
    return { key: r.key, saving: solveMonthlySaving(inpY, inpY.ageRetire), lump: solveLumpSum(inpY, inpY.ageRetire) };
  });
}

export function goalEarliestAnswers(assetsEnabled: boolean, mainInp: SimInput, scen: ScenariosOutcome, monthlySavingZ: number) {
  return goalRows(assetsEnabled, mainInp, scen).map((r) => ({ key: r.key, earliest: solveEarliestWithSaving(r.inp, monthlySavingZ) }));
}
