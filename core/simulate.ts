// core/simulate.ts｜逐年模擬主引擎（規格第 3.1、3.4、3.5 節）
// 純函式：輸入明確、輸出明確、無副作用，不依賴 DOM 或全域狀態。
// 邏輯自 Phase 1 單頁版 simulate() 原樣搬移，公式未改。
// 唯一新增欄位 extraMonthlySaving（預設由 config 提供 0）：
// 功能 (a) 的反推以此試算「每月多存 X 元」，預設 0 時結果與原版完全一致。

import { realRate } from "./rates";
import { pvAnnuity } from "./annuity";

export interface ExpenseItem {
  name: string;
  amount: number; // 元/月（今日幣值）
  endAge: number | null; // 到第幾歲結束；null = 不結束
}

export interface SimInput {
  ageNow: number;
  ageRetire: number;
  ageLife: number;
  initAssets: number;
  monthlyIncome: number; // 元/月（今日幣值，稅後實領）
  salaryGrowth: number; // 名目 %/年
  expenses: ExpenseItem[];
  retireSpend: number; // 退休後月支出（今日幣值）
  otherRetireIncome: number; // 元/月（今日幣值）
  inflation: number; // %
  retPre: number; // 名目 %
  retPost: number; // 名目 %
  extraMonthlySaving: number; // 額外每月儲蓄（反推用，預設 0）
}

export interface SimRow {
  t: number;
  age: number;
  phase: "now" | "work" | "retire";
  income: number;
  expense: number;
  flow: number;
  gain: number;
  assets: number;
}

export interface SimResult {
  rows: SimRow[];
  retireAssets: number;
  required: number;
  achieve: number | null;
  exhaustAge: number | null;
  finalAssets: number;
  workGap: number;
  workGapNom: number;
  uncovered: number;
  uncoveredNom: number;
  lifetimeReal: number;
  lifetimeNom: number;
  shortfall: number;
  workYears: number;
  retYears: number;
  r: number;
  rho: number;
  g: number;
}

/**
 * 逐年模擬。eps 為判定耗盡的容許誤差（最早退休試算用，其餘用 0）。
 * 現金流一律年底發生（第 3.1 節）。
 */
export function simulate(inp: SimInput, retireAge: number, eps: number): SimResult {
  const A = inp.ageNow, L = inp.ageLife, R = retireAge;
  const inf = inp.inflation / 100;
  const r = realRate(inp.retPre / 100, inf);
  const rho = realRate(inp.retPost / 100, inf);
  const g = realRate(inp.salaryGrowth / 100, inf);
  const workYears = R - A, retYears = L - R;
  const rows: SimRow[] = [{ t: 0, age: A, phase: "now", income: 0, expense: 0, flow: 0, gain: 0, assets: inp.initAssets }];
  let assets = inp.initAssets;
  let workGap = 0, workGapNom = 0, lifetimeReal = 0, lifetimeNom = 0;

  for (let t = 1; t <= workYears; t++) {
    const income = inp.monthlyIncome * 12 * Math.pow(1 + g, t - 1);
    let expense = 0;
    for (const e of inp.expenses) {
      if (e.endAge === null || A + t <= e.endAge) expense += e.amount * 12;
    }
    const saving = income - expense + inp.extraMonthlySaving * 12;
    const raw = assets * (1 + r) + saving;
    let endA = raw;
    if (raw < 0) {
      workGap += -raw;
      workGapNom += -raw * Math.pow(1 + inf, t);
      endA = 0; // 資產下限 0，不讓負資產繼續計息（第 3.4 節）
    }
    rows.push({ t, age: A + t, phase: "work", income, expense, flow: saving, gain: endA - assets - saving, assets: endA });
    lifetimeReal += income;
    lifetimeNom += income * Math.pow(1 + inf, t);
    assets = endA;
  }
  const retireAssets = assets;

  const annualRetExp = inp.retireSpend * 12;
  const annualOther = inp.otherRetireIncome * 12;
  const shortfall = Math.max(0, annualRetExp - annualOther); // 超額不回投（第 3.5 節）
  let uncovered = 0, uncoveredNom = 0, exhaustAge: number | null = null;

  for (let k = 1; k <= retYears; k++) {
    const t2 = workYears + k, age = R + k;
    const raw2 = assets * (1 + rho) - shortfall;
    let endB = raw2;
    if (raw2 < -eps) {
      uncovered += -raw2;
      uncoveredNom += -raw2 * Math.pow(1 + inf, t2);
      if (exhaustAge === null) exhaustAge = age;
      endB = 0;
    }
    rows.push({ t: t2, age, phase: "retire", income: annualOther, expense: annualRetExp, flow: -shortfall, gain: endB - assets + shortfall, assets: endB });
    assets = endB;
  }

  const required = retYears <= 0 || shortfall <= 0 ? 0 : pvAnnuity(shortfall, rho, retYears);

  return {
    rows, retireAssets, required,
    achieve: required > 0 ? retireAssets / required : null,
    exhaustAge, finalAssets: assets,
    workGap, workGapNom, uncovered, uncoveredNom,
    lifetimeReal, lifetimeNom, shortfall, workYears, retYears, r, rho, g,
  };
}
