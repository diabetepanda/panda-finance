// ============================================================
// 勞保 / 勞退參數（規格第 6.1 節）｜Phase 3
// 全部為「目前採用的假設參數」，source 一律「待查證」。
// 介面不得以「官方規定」口吻呈現；請以勞動部勞工保險局、
// 勞動基金運用局最新公告為準。
// ============================================================

import type { ParamDef } from "./defaults";

function sp(id: string, label: string, value: number, unit: string, min: number, max: number, note: string): ParamDef {
  return { id, label, value, unit, min, max, source: "待查證", updatedAt: "待填", note };
}

export const SOCIAL_PARAMS: ParamDef[] = [
  sp("liRatePerYear", "勞保老年年金給付費率（式一）", 1.55, "%/年資", 0, 10, "月領（未調整）= 平均月投保薪資 × 年資 × 此費率。"),
  sp("liSalaryCap", "勞保投保薪資上限", 45800, "元/月", 0, 1000000, "平均月投保薪資不得超過此上限。"),
  sp("liLegalClaimAge", "勞保法定請領年齡", 65, "歲", 50, 80, "提前/延後增減給以此年齡為基準。"),
  sp("liEarlyPerYear", "提前請領每提前 1 年減給", 4, "%", 0, 20, "最多提前年數另見 liEarlyMaxYears；另需年資達 liMinYears。"),
  sp("liEarlyMaxYears", "提前請領最多提前年數", 5, "年", 0, 10, ""),
  sp("liLatePerYear", "延後請領每延後 1 年增給", 4, "%", 0, 20, "最多延後年數另見 liLateMaxYears。"),
  sp("liLateMaxYears", "延後請領最多延後年數", 5, "年", 0, 10, ""),
  sp("liMinYears", "年金請領最低年資", 15, "年", 0, 60, "未達此年資時介面提示可能不符合請領條件，仍顯示試算值並標示不一定符合資格。"),
  sp("liClaimAgeMin", "請領年齡可調下限", 60, "歲", 50, 80, ""),
  sp("liClaimAgeMax", "請領年齡可調上限", 70, "歲", 50, 90, ""),
  sp("lrEmployerRate", "勞退雇主提繳率", 6, "%", 0, 30, ""),
  sp("lrEmployeeMaxRate", "勞退員工自提率上限", 6, "%", 0, 30, "自提率可調範圍 0 至此值。"),
  sp("lrWageCap", "勞退提繳工資上限", 150000, "元/月", 0, 10000000, "月提繳工資不得超過此上限。"),
  sp("lrFundReturn", "勞退基金收益率（名目）", 2, "%/年", -20, 30, "獨立參數，與投資報酬率分開；換算為實質收益率後逐年累積。"),
];

export const SOCIAL_PARAM_MAP: Record<string, ParamDef> = Object.fromEntries(SOCIAL_PARAMS.map((d) => [d.id, d]));
export function socialParamValue(id: string): number {
  const d = SOCIAL_PARAM_MAP[id];
  if (!d) throw new Error(`Unknown social param: ${id}`);
  return d.value;
}

/** 勞退提繳工資上限是否隨通膨調整（第 6.3 節）：預設不調整。
 *  不調整會使高薪者未來的提繳比例被低估，已註明於 ASSUMPTIONS.md。 */
export const LR_WAGE_CAP_INFLATION_ADJUST = false;

/** 勞保投保薪資級距表（簡化版，待查證）：由月薪對應到不低於月薪的最近級距 */
export const LI_SALARY_BRACKETS: number[] = [
  11100, 12540, 13500, 15840, 16500, 17280, 17880, 19047, 20008, 21009,
  22000, 23100, 23800, 24000, 25250, 26400, 27600, 28800, 30300, 31800,
  33300, 34800, 36300, 38200, 40100, 42000, 43900, 45800,
];

/** 勞退提繳工資級距表（簡化版，待查證） */
export const LR_WAGE_BRACKETS: number[] = [
  1500, 3000, 4500, 6000, 7500, 8700, 9900, 11100, 12540, 13500, 15840,
  16500, 17280, 17880, 19047, 20008, 21009, 22000, 23100, 23800, 24000,
  25250, 26400, 27600, 28800, 30300, 31800, 33300, 34800, 36300, 38200,
  40100, 42000, 43900, 45800, 48200, 50600, 53000, 55400, 57800, 60800,
  63800, 66800, 69800, 72800, 76500, 80200, 83900, 87600, 92100, 96600,
  101100, 105600, 110100, 115500, 120900, 126300, 131700, 137100, 142500, 147900, 150000,
];

/** 由金額對應級距：取不低於金額的最小級距，超過最大級距時取上限 */
export function bracketFor(amount: number, brackets: number[], cap: number): number {
  const capped = Math.min(amount, cap);
  for (const b of brackets) if (b >= capped) return Math.min(b, cap);
  return cap;
}
