// core/portfolio.ts｜配置加權、匯率調整、情境組合（規格第 5.2、5.3、5.5 節）
// 純函式，不依賴 UI、DOM 或全域狀態。

import { ASSET_MAP, CASH_ASSET_ID, type ScenarioId } from "../config/assets";

// ============================================================
// 匯率調整（第 5.3 節）— 方向務必看清楚：
// 「新台幣對美元年變動率」fx > 0 代表【新台幣升值】：
//   1 美元能換到的新台幣變少 → 美元資產換回新台幣的報酬【變差】。
// 「美元對新台幣年變動率」= 1 / (1 + fx) − 1（fx>0 時此值為負）。
// 美元資產的新台幣名目報酬 = (1 + 美元計價報酬) × (1 + 美元對新台幣年變動率) − 1。
// 例：VOO 報酬 7%、新台幣升值 3% → (1.07)(1/1.03) − 1 ≈ 3.88% < 7% ✓ 變差。
//     新台幣貶值 3%（fx = −3%）→ (1.07)(1/0.97) − 1 ≈ 10.31% > 7% ✓ 變好。
// 匯率調整只對美元計價標的套用一次；新台幣計價標的直接用原報酬率。
// ============================================================
export function fxAdjustedReturn(nominalReturn: number, fxChange: number): number {
  const usdInTwdChange = 1 / (1 + fxChange) - 1; // 美元對新台幣年變動率
  return (1 + nominalReturn) * (1 + usdInTwdChange) - 1;
}

/** 單一標的在某情境下的新台幣名目報酬率（小數）：USD 標的套用匯率調整一次，TWD 標的不套用 */
export function assetReturnTwd(
  assetId: string,
  scenario: ScenarioId,
  returnOverrides: Record<string, Record<ScenarioId, number>>,
  fxChange: number
): number {
  const def = ASSET_MAP[assetId];
  if (!def) throw new Error(`Unknown asset: ${assetId}`);
  const pct = returnOverrides[assetId]?.[scenario] ?? def.returns[scenario].value;
  const nominal = pct / 100;
  return def.currency === "USD" ? fxAdjustedReturn(nominal, fxChange) : nominal;
}

/** 配置總和（%） */
export function allocationTotal(allocation: Record<string, number>): number {
  return Object.values(allocation).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
}

/** 配置是否有效：總和必須為 100%（第 5.2 節） */
export function isAllocationValid(allocation: Record<string, number>): boolean {
  return Math.abs(allocationTotal(allocation) - 100) < 1e-9;
}

/**
 * 組合名目報酬率（小數）= 各標的（匯率調整後）報酬率依比例加權。
 * 簡化：每年固定比例再平衡（第 5.2 節，另見 ASSUMPTIONS.md）。
 */
export function portfolioReturn(
  allocation: Record<string, number>,
  scenario: ScenarioId,
  returnOverrides: Record<string, Record<ScenarioId, number>>,
  fxChange: number
): number {
  let total = 0;
  for (const [assetId, pct] of Object.entries(allocation)) {
    if (!pct) continue;
    total += (pct / 100) * assetReturnTwd(assetId, scenario, returnOverrides, fxChange);
  }
  return total;
}

/**
 * 退休後組合報酬率（標的模式，第 5.5 節）：
 * - 退休後配置為自訂：直接用退休後配置的組合報酬率，不套折減。
 * - 退休後配置「與退休前相同」（未另外設定）：退休前組合報酬率 − 折減，
 *   下限為同情境定存 / 現金的報酬率。
 */
export function postRetirementReturn(
  preReturn: number,
  mode: "same" | "custom",
  retireAllocation: Record<string, number>,
  scenario: ScenarioId,
  returnOverrides: Record<string, Record<ScenarioId, number>>,
  fxChange: number,
  deduction: number
): number {
  if (mode === "custom") {
    return portfolioReturn(retireAllocation, scenario, returnOverrides, fxChange);
  }
  const floor = assetReturnTwd(CASH_ASSET_ID, scenario, returnOverrides, fxChange);
  return Math.max(preReturn - deduction, floor);
}
