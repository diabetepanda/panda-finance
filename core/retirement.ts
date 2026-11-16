// core/retirement.ts｜退休所需資金、最早可退休年齡、已退休判定
// （規格第 3.6、3.7、7.1 節）純函式。

import { simulate, type SimInput } from "./simulate";
import { pvAnnuity } from "./annuity";
import { paramValue } from "../config/defaults";

/** 退休所需資金（第 3.6 節）：每年缺口固定時以年金現值計算，逐年缺口不同時應逐年折現（Phase 1 缺口固定） */
export function requiredFunds(annualShortfall: number, realRetPostRate: number, retYears: number): number {
  return pvAnnuity(annualShortfall, realRetPostRate, retYears);
}

export type EarliestResult =
  | { type: "already"; lastsToLife: boolean; exhaustAge: number | null }
  | { type: "age"; age: number }
  | { type: "none" };

/**
 * 最早可退休年齡（第 3.7 節）：從 A+1 逐歲完整試算至上限，不假設單調。
 * 已退休（R=A，第 7.1 節）：回傳 already，並依資產能否撐到預期壽命
 * 帶 lastsToLife 與 exhaustAge，讓 UI 分開顯示不同訊息（功能 b）。
 */
export function earliestRetirement(inp: SimInput): EarliestResult {
  if (inp.ageRetire === inp.ageNow) {
    const s = simulate(inp, inp.ageRetire, paramValue("exhaustTolerance"));
    return { type: "already", lastsToLife: s.exhaustAge === null, exhaustAge: s.exhaustAge };
  }
  const cap = Math.min(paramValue("earliestRetirementCap"), inp.ageLife - 1);
  for (let c = inp.ageNow + 1; c <= cap; c++) {
    const s = simulate(inp, c, paramValue("exhaustTolerance"));
    if (s.exhaustAge === null) return { type: "age", age: c };
  }
  return { type: "none" };
}
