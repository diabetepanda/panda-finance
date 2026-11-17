// core/simulate.ts｜逐年模擬主引擎（規格第 3.1、3.4、3.5 節）
// 純函式：輸入明確、輸出明確、無副作用，不依賴 DOM 或全域狀態。
// 邏輯自 Phase 1 單頁版 simulate() 原樣搬移，公式未改。
// 唯一新增欄位 extraMonthlySaving（預設由 config 提供 0）：
// 功能 (a) 的反推以此試算「每月多存 X 元」，預設 0 時結果與原版完全一致。

import { realRate } from "./rates";
import { goalFlowAt, type LifeGoal } from "./lifeGoals";
import { pvAnnuity } from "./annuity";
import type { CategoryId } from "../config/categories";
import {
  plannedYearsAt, laborInsuranceMonthly, laborInsuranceRealAnnual,
  laborPensionAccumulate, laborPensionMonthlyAnnual,
  laborPensionStartAge, laborPensionGrow, type SocialInput,
} from "./social";

export interface ExpenseItem {
  name: string;
  amount: number; // 元/月（今日幣值）
  endAge: number | null; // 到第幾歲結束；null = 不結束
  category?: CategoryId; // Phase 2 分類通膨用；未指定視為 other
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
  // Phase 2 分類通膨（第 5.6 節）：類別通膨率（%）；null/未提供 = 單一通膨。
  // Phase 4 起 UI 不使用（UI 一律傳 null），保留供日後擴充。
  // 結果與 Phase 1 完全一致。某類別為 null = 採用總通膨率。
  categoryInflation?: Partial<Record<CategoryId, number | null>> | null;
  // Phase 2 退休支出依類別拆分：提供時退休支出逐年依類別實質成長率變動，
  // 退休所需資金改為逐年折現加總（第 3.6 節）；未提供 = Phase 1 固定缺口。
  retireSpendCategories?: { category: CategoryId; monthly: number }[] | null;
  // Phase 3 勞保勞退（第 6 節）：null/未提供 = 不納入，結果與 Phase 1/2 一致。
  // 年資、減給、勞退累積都在 simulate 內依候選退休年齡 R 重算（第 3.7 節要求）。
  social?: SocialInput | null;
  // Phase 4 投資對照（第六節）：未提供時行為完全不變。
  // contribution：工作期每年投入改走遞增路徑（今日幣值 12A×(1+g)^(t−1)，g 為調高幅度的實質率），
  // 取代「收入 − 支出」；extraMonthlySaving 照舊加上。
  contribution?: { monthlyStart: number; stepPct: number } | null;
  // Phase 6 人生大目標：null/未提供/空陣列 = 沒有大目標，行為與先前完全相同。
  lifeGoals?: LifeGoal[] | null;
  // cashYearsAtStart：工作期前 N 年用定存報酬率（名目 %），之後才用 retPre。
  cashYearsAtStart?: { years: number; cashRetPct: number } | null;
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
  li: number; // 勞保年金收入（實質，元/年；Phase 3）
  lp: number; // 勞退月領收入（實質，元/年；Phase 3）
  gap: number; // 年支出缺口（退休期；工作期為 0）
  goalLump: number; // 人生大目標一次性支出（實質，元/年；Phase 6）
  goalPay: number; // 人生大目標貸款還款（實質，元/年；Phase 6）
}

export interface SimResult {
  rows: SimRow[];
  socialDetail: {
    liMonthlyToday: number; liYears: number; lpBalance: number; lpMonthlyAnnual: number;
    lpStartAge: number; // 勞退實際開始領取年齡 = max(退休年齡, 法定請領年齡)
    lpLumpAtClaim: number; // 一次領：請領那一年併入資產的金額（含空窗期累積）；退休當下併入時為 0
  } | null;
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
  const rows: SimRow[] = [{ t: 0, age: A, phase: "now", income: 0, expense: 0, flow: 0, gain: 0, assets: inp.initAssets, li: 0, lp: 0, gap: 0, goalLump: 0, goalPay: 0 }];
  const goals = inp.lifeGoals ?? null;
  const hasGoals = goals !== null && goals.length > 0;
  let assets = inp.initAssets;
  let workGap = 0, workGapNom = 0, lifetimeReal = 0, lifetimeNom = 0;

  for (let t = 1; t <= workYears; t++) {
    const income = inp.monthlyIncome * 12 * Math.pow(1 + g, t - 1);
    let expense = 0;
    for (const e of inp.expenses) {
      if (e.endAge === null || A + t <= e.endAge) {
        if (inp.categoryInflation == null) {
          expense += e.amount * 12;
        } else {
          // 類別實質成長率 = (1 + 類別通膨) / (1 + 總通膨) − 1（第 5.6 節）
          const catPct = inp.categoryInflation[e.category ?? "other"] ?? inp.inflation;
          const catReal = realRate(catPct / 100, inf);
          expense += e.amount * 12 * Math.pow(1 + catReal, t - 1);
        }
      }
    }
    let saving: number;
    if (inp.contribution != null) {
      const gC = realRate(inp.contribution.stepPct / 100, inf);
      saving = 12 * inp.contribution.monthlyStart * Math.pow(1 + gC, t - 1) + inp.extraMonthlySaving * 12;
    } else {
      saving = income - expense + inp.extraMonthlySaving * 12;
    }
    const rateT = inp.cashYearsAtStart != null && t <= inp.cashYearsAtStart.years
      ? realRate(inp.cashYearsAtStart.cashRetPct / 100, inf)
      : r;
    const gf = hasGoals ? goalFlowAt(goals, A, t, inp.inflation) : { lump: 0, pay: 0 };
    const raw = assets * (1 + rateT) + saving - gf.lump - gf.pay;
    let endA = raw;
    if (raw < 0) {
      workGap += -raw;
      workGapNom += -raw * Math.pow(1 + inf, t);
      endA = 0; // 資產下限 0，不讓負資產繼續計息（第 3.4 節）
    }
    rows.push({ t, age: A + t, phase: "work", income, expense, flow: saving, gain: endA - assets - saving + gf.lump + gf.pay, assets: endA, li: 0, lp: 0, gap: 0, goalLump: gf.lump, goalPay: gf.pay });
    lifetimeReal += income;
    lifetimeNom += income * Math.pow(1 + inf, t);
    assets = endA;
  }
  // ---- Phase 3：勞保勞退（依本次試算的退休年齡 R 重算） ----
  const social = inp.social ?? null;
  let liMonthlyToday = 0, liYears = 0, lpBalance = 0, lpMonthlyAnnual = 0;
  let lpStartAge = R, lpLumpAtClaim = 0;
  if (social) {
    liYears = plannedYearsAt(social.laborInsurance, A, R);
    liMonthlyToday = laborInsuranceMonthly(social.laborInsurance, liYears);
    lpBalance = laborPensionAccumulate(social.laborPension, A, R, inp.salaryGrowth, inp.inflation);
    // 勞退實際開始領取年齡 = max(退休年齡, 法定請領年齡)；退休到請領之間為空窗期。
    // 空窗期內帳戶繼續以勞退基金實質收益率累積（不再提繳），到請領那一年才處理。
    lpStartAge = laborPensionStartAge(social.laborPension, R);
    const lpAtClaim = laborPensionGrow(lpBalance, social.laborPension.fundReturnPct, inp.inflation, lpStartAge - R);
    if (social.laborPension.mode === "lump") {
      if (lpStartAge <= R) assets += lpBalance; // 無空窗期：退休當下併入資產
      else lpLumpAtClaim = lpAtClaim; // 有空窗期：請領那一年才併入（金額含空窗期累積）
    } else if (lpStartAge < L) {
      // 月領：自開始領取年齡起，以基金實質收益率年金化、領到預期壽命
      lpMonthlyAnnual = laborPensionMonthlyAnnual(lpAtClaim, social.laborPension.fundReturnPct, inp.inflation, L - lpStartAge);
    }
  }

  const retireAssets = assets;

  const annualRetExp = inp.retireSpend * 12;
  const annualOther = inp.otherRetireIncome * 12;
  const varying = inp.retireSpendCategories != null || social !== null;
  // 退休第 k 年（總經過年數 t2）的實質退休支出與缺口：
  // 未拆分類別時固定（Phase 1 行為）；拆分時逐年依類別實質成長率變動。
  const retireYear = (k: number): { expense: number; shortfall: number; li: number; lp: number; income: number } => {
    const t2 = workYears + k;
    let exp = annualRetExp;
    if (inp.retireSpendCategories != null) {
      exp = 0;
      for (const part of inp.retireSpendCategories) {
        const catPct = inp.categoryInflation?.[part.category] ?? inp.inflation;
        const catReal = realRate(catPct / 100, inf);
        exp += part.monthly * 12 * Math.pow(1 + catReal, t2 - 1);
      }
    }
    // 勞保年金：請領年齡未到（空窗期）為 0，缺口全由資產支應（第 6.2、6.4 節）
    let li = 0;
    if (social && R + k >= social.laborInsurance.claimAge) {
      li = laborInsuranceRealAnnual(liMonthlyToday, social.laborInsurance.indexed, inf, social.laborInsurance.claimAge - A, t2);
    }
    // 勞退月領：未到開始領取年齡（空窗期）為 0
    const lp = social && R + k >= lpStartAge ? lpMonthlyAnnual : 0;
    const income = li + lp + annualOther;
    // 支出缺口 = max(0, 退休支出 − 勞保 − 勞退月領 − 其他收入)；超額不回投（第 6.4、3.5 節）
    return { expense: exp, shortfall: Math.max(0, exp - income), li, lp, income };
  };
  // 有大目標時，退休期缺口再加上當年貸款還款（Phase 6 第三節第 6 點）：
  // 缺口 = max(0, 退休支出 + 貸款還款 − 勞保 − 勞退月領 − 其他收入)
  const retireYearWithGoals = (k: number) => {
    const base = retireYear(k);
    if (!hasGoals) return { ...base, goalLump: 0, goalPay: 0 };
    const gf = goalFlowAt(goals, A, workYears + k, inp.inflation);
    return {
      ...base,
      shortfall: Math.max(0, base.expense + gf.pay - base.income),
      goalLump: gf.lump, goalPay: gf.pay,
    };
  };
  const shortfall = retireYearWithGoals(1).shortfall; // Phase 1 固定缺口；拆分時為退休第一年缺口
  let uncovered = 0, uncoveredNom = 0, exhaustAge: number | null = null;

  for (let k = 1; k <= retYears; k++) {
    const t2 = workYears + k, age = R + k;
    const { expense: retExpK, shortfall: shortfallK, li: liK, lp: lpK, income: incK, goalLump: lumpK, goalPay: payK } = retireYearWithGoals(k);
    // 一次領空窗期結束：到達請領年齡那一年，帳戶（含空窗期累積）併入資產
    if (social && social.laborPension.mode === "lump" && age === lpStartAge && lpStartAge > R) assets += lpLumpAtClaim;
    const raw2 = assets * (1 + rho) - shortfallK - lumpK;
    let endB = raw2;
    if (raw2 < -eps) {
      uncovered += -raw2;
      uncoveredNom += -raw2 * Math.pow(1 + inf, t2);
      if (exhaustAge === null) exhaustAge = age;
      endB = 0;
    }
    rows.push({ t: t2, age, phase: "retire", income: incK, expense: retExpK, flow: -shortfallK, gain: endB - assets + shortfallK + lumpK, assets: endB, li: liK, lp: lpK, gap: shortfallK, goalLump: lumpK, goalPay: payK });
    assets = endB;
  }

  // 退休所需資金（第 3.6 節）：缺口固定用年金現值公式；缺口逐年不同時逐年折現加總
  let required: number;
  if (retYears <= 0) required = 0;
  else if (!varying && !hasGoals) required = shortfall <= 0 ? 0 : pvAnnuity(shortfall, rho, retYears);
  else {
    // 有大目標時一律逐年折現：每年的（缺口 + 當年一次性支出）一起折現（Phase 6 第三節第 6 點）
    required = 0;
    for (let k = 1; k <= retYears; k++) {
      const { shortfall: sk, goalLump: lk } = retireYearWithGoals(k);
      const amt = sk + lk;
      required += 1 + rho <= 0 ? amt : amt * Math.pow(1 + rho, -k);
    }
  }

  return {
    rows, retireAssets, required,
    socialDetail: social ? { liMonthlyToday, liYears, lpBalance, lpMonthlyAnnual, lpStartAge, lpLumpAtClaim } : null,
    achieve: required > 0 ? retireAssets / required : null,
    exhaustAge, finalAssets: assets,
    workGap, workGapNom, uncovered, uncoveredNom,
    lifetimeReal, lifetimeNom, shortfall, workYears, retYears, r, rho, g,
  };
}
