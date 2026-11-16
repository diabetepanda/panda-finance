// core/solver.ts｜反推（二分搜尋，規格第 3.7、7.3 節）
// 功能 (a)：最早退休「無法達成」時，試算每月要多存多少才可達成，
// 並回傳對應的最早可退休年齡，供 UI 以試算結果說明調整方向。
// 一律使用主模擬引擎 simulate / earliestRetirement，不另寫一套公式。

import { type SimInput } from "./simulate";
import { earliestRetirement } from "./retirement";
import { paramValue } from "../config/defaults";

export interface ExtraSavingSolution {
  found: boolean;
  extraMonthly: number; // 每月需多存金額（元，今日幣值）
  earliestAge: number | null; // 多存後的最早可退休年齡
}

/**
 * 二分搜尋最小的每月額外儲蓄額，使最早可退休年齡存在（<= 上限）。
 * 搜尋上限：先月收入，不足時擴大到月收入的 solverMaxExtraMultiple 倍；
 * 仍不足回傳 found=false。最多 solverMaxIterations 次迭代（第 7.3 節）。
 */
export function findExtraSavingForEarliest(inp: SimInput): ExtraSavingSolution {
  const maxIter = Math.round(paramValue("solverMaxIterations"));
  const base = inp.monthlyIncome > 0 ? inp.monthlyIncome : 0;
  let hi = base;
  const hiCap = base * paramValue("solverMaxExtraMultiple");

  const earliestWith = (extra: number): number | null => {
    const r = earliestRetirement({ ...inp, extraMonthlySaving: extra });
    return r.type === "age" ? r.age : r.type === "already" ? inp.ageNow : null;
  };

  if (earliestWith(0) !== null) return { found: true, extraMonthly: 0, earliestAge: earliestWith(0) };

  // 擴大上限直到可達成或達倍數上限
  let guard = 0;
  while (hi <= 0 || earliestWith(hi) === null) {
    if (hi >= hiCap || guard++ > maxIter) return { found: false, extraMonthly: hiCap, earliestAge: null };
    hi = hi > 0 ? Math.min(hi * 2, hiCap) : hiCap;
    if (hi <= 0) return { found: false, extraMonthly: 0, earliestAge: null };
  }

  // 二分搜尋最小額外儲蓄（精度 1 元）
  let lo = 0;
  for (let i = 0; i < maxIter && hi - lo > 1; i++) {
    const mid = (lo + hi) / 2;
    if (earliestWith(mid) !== null) hi = mid;
    else lo = mid;
  }
  const extra = Math.ceil(hi);
  return { found: true, extraMonthly: extra, earliestAge: earliestWith(extra) };
}
