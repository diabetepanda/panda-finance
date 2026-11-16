// core/compare.ts｜圖表比較的數據計算（規格第 6.6 節）
// 全部呼叫主引擎或 core 函式，不在 UI 計算。

import { fvAnnuity } from "./annuity";
import { realRate, nominalToReal } from "./rates";
import { assetReturnTwd } from "./portfolio";
import { simulate, type SimInput } from "./simulate";
import { earliestRetirement, type EarliestResult } from "./retirement";
import { ASSETS, SCENARIO_IDS, type ScenarioId } from "../config/assets";

export interface AssetCompareRow {
  assetId: string;
  label: string;
  values: Record<ScenarioId, number>; // N 年後資產（實質，元）
}

/**
 * 標的比較：每月結餘 100% 投入單一標的、N 年後資產（實質口徑）。
 * 每情境用該情境的標的報酬率（匯率調整後）與該情境通膨換算實質報酬；
 * 既有資產也以同一標的報酬成長。現金流年底發生（fvAnnuity）。
 */
export function assetComparison(
  monthlySaving: number, initAssets: number, years: number,
  scenarioInflation: Record<ScenarioId, number>,
  returnOverrides: Record<string, Record<ScenarioId, number>>,
  fxChangePct: number
): AssetCompareRow[] {
  const fx = fxChangePct / 100;
  return ASSETS.map((a) => {
    const values = {} as Record<ScenarioId, number>;
    for (const sid of SCENARIO_IDS) {
      const twd = assetReturnTwd(a.id, sid, returnOverrides, fx);
      const r = realRate(twd, scenarioInflation[sid] / 100);
      values[sid] = initAssets * Math.pow(1 + r, years) + fvAnnuity(monthlySaving * 12, r, years);
    }
    return { assetId: a.id, label: a.label, values };
  });
}

/** 通膨影響對照：固定名目金額在第 t 年的實質購買力（= 名目 ÷ (1+通膨)^t） */
export function purchasingPowerSeries(amount: number, inflationPct: number, years: number): { t: number; real: number }[] {
  const out: { t: number; real: number }[] = [];
  for (let t = 0; t <= years; t++) out.push({ t, real: nominalToReal(amount, inflationPct / 100, t) });
  return out;
}

/** 勞保勞退影響對照的一個變體結果 */
export interface SocialVariantResult {
  key: string;
  label: string;
  earliest: EarliestResult;
  exhaustAge: number | null;
}

/** 有無勞保/勞退與年金打折 0/30/50% 的對照（以主引擎逐一試算） */
export function socialVariants(inp: SimInput): SocialVariantResult[] {
  if (!inp.social) return [];
  const mk = (key: string, label: string, patch: Partial<SimInput>): SocialVariantResult => {
    const v = { ...inp, ...patch };
    const res = simulate(v, v.ageRetire, 0.5);
    return { key, label, earliest: earliestRetirement(v), exhaustAge: res.exhaustAge };
  };
  const li = inp.social.laborInsurance, lp = inp.social.laborPension;
  const withDiscount = (d: number): Partial<SimInput> => ({
    social: { laborInsurance: { ...li, discountPct: d }, laborPension: lp },
  });
  return [
    mk("current", `目前設定（打折 ${li.discountPct}%）`, {}),
    mk("no-li", "無勞保年金", { social: { laborInsurance: { ...li, avgInsuredSalary: 0 }, laborPension: lp } }),
    mk("no-lp", "無勞退", { social: { laborInsurance: li, laborPension: { ...lp, employerRatePct: 0, employeeRatePct: 0, currentBalance: 0 } } }),
    mk("d0", "年金打折 0%", withDiscount(0)),
    mk("d30", "年金打折 30%", withDiscount(30)),
    mk("d50", "年金打折 50%", withDiscount(50)),
  ];
}
