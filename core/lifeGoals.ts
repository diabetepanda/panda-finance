// core/lifeGoals.ts｜人生大目標（買房／買車／其他大筆支出與貸款）純函式（Phase 6）
// 注意：core/goals.ts 是「目標反推」，與本模組無關，不要混用名稱。
// 計算口徑（規格 Phase 6 第三、四節）：
// - 購買年年底從資產扣「頭期款＋額外費用」（今日幣值，假設總價跟著一般通膨走）。
// - 貸款本金是購買當年的帳面金額；月付金以本息平均攤還計算、帳面每月固定；
//   每年的實質還款 = 12 × 帳面月付金 ÷ (1+通膨)^t，通膨讓實質負擔逐年變輕。
// - 不把房屋／車子算成資產、不估殘值、不模擬寬限期／提前還款／機動利率。

import type { SimInput } from "./simulate";
import { computePhase1 } from "./compute";

export type LifeGoalType = "house" | "car" | "other";

export interface LifeGoal {
  name: string;
  type: LifeGoalType;
  purchaseAge: number; // 哪一歲買
  price: number; // 總價（元，今日幣值）
  downMode: "amount" | "pct";
  downValue: number; // 頭期款金額（元）或百分比（%）
  extraCosts: number; // 一次性額外費用（元，今日幣值）
  loanRatePct: number; // 貸款年利率 %
  loanYears: number; // 貸款年數；0 = 不貸款
}

/** 本息平均攤還月付金（帳面金額）：M = 本金 × i ÷ (1 − (1+i)^(−n))；利率 0 時 = 本金 ÷ n */
export function amortizedMonthlyPayment(principal: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (!(principal > 0) || n <= 0) return 0;
  const i = annualRatePct / 100 / 12;
  if (i === 0) return principal / n;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

/** 頭期款金額（元，今日幣值）：百分比在此換算；以總價為上限、下限 0 */
export function downPaymentOf(goal: LifeGoal): number {
  const raw = goal.downMode === "pct" ? (goal.price * goal.downValue) / 100 : goal.downValue;
  return Math.min(Math.max(raw, 0), Math.max(goal.price, 0));
}

/** 貸款金額（元，今日幣值）= 總價 − 頭期款；頭期 ≥ 總價時為 0 */
export function loanAmountOf(goal: LifeGoal): number {
  return Math.max(0, goal.price - downPaymentOf(goal));
}

/** 貸款本金（購買當年的帳面金額）= 貸款金額 × (1+通膨)^(購買年齡 − 現在年齡) */
export function loanPrincipalNominal(goal: LifeGoal, ageNow: number, inflationPct: number): number {
  const tp = goal.purchaseAge - ageNow;
  return loanAmountOf(goal) * Math.pow(1 + inflationPct / 100, tp);
}

/** 帳面月付金（每月固定） */
export function monthlyPaymentNominal(goal: LifeGoal, ageNow: number, inflationPct: number): number {
  return amortizedMonthlyPayment(loanPrincipalNominal(goal, ageNow, inflationPct), goal.loanRatePct, goal.loanYears);
}

/** 還清年齡 = 購買年齡 + 貸款年數（不貸款時 = 購買年齡） */
export function payoffAgeOf(goal: LifeGoal): number {
  return goal.purchaseAge + goal.loanYears;
}

/**
 * 第 t 年（t = 年齡 − 現在年齡）的大目標現金流（實質元／年）：
 * - 購買年（t = tp）：lump = 頭期款 + 額外費用；pay = 0。
 * - 還款年（tp < t ≤ tp + 年數）：pay = 12 × 帳面月付金 ÷ (1+通膨)^t。
 */
export function goalFlowAt(
  goals: LifeGoal[] | null | undefined, ageNow: number, t: number, inflationPct: number
): { lump: number; pay: number } {
  let lump = 0, pay = 0;
  if (!goals) return { lump, pay };
  const inf = inflationPct / 100;
  for (const g of goals) {
    const tp = g.purchaseAge - ageNow;
    if (t === tp) lump += downPaymentOf(g) + Math.max(0, g.extraCosts || 0);
    if (g.loanYears > 0 && t > tp && t <= tp + g.loanYears) {
      pay += (12 * monthlyPaymentNominal(g, ageNow, inflationPct)) / Math.pow(1 + inf, t);
    }
  }
  return { lump, pay };
}

export interface LifeGoalValidation { errors: string[]; warnings: string[] }

/** 大目標欄位驗證（規格 Phase 6 第二、五節）：購買年齡須 現在年齡 < P ≤ 預期壽命 */
export function validateLifeGoals(goals: LifeGoal[], ageNow: number, ageLife: number): LifeGoalValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (goals.length > 5) errors.push("人生大目標最多 5 筆。");
  goals.forEach((g, i) => {
    const label = g.name?.trim() ? `「${g.name}」` : `第 ${i + 1} 筆大目標`;
    if (!Number.isFinite(g.purchaseAge) || g.purchaseAge <= ageNow || g.purchaseAge > ageLife) {
      errors.push(`${label}的購買年齡須大於現在年齡、且不超過預期壽命。`);
    }
    if (!Number.isFinite(g.price) || g.price < 0) errors.push(`${label}的總價不可為負數。`);
    if (g.downMode === "pct" && (!Number.isFinite(g.downValue) || g.downValue < 0 || g.downValue > 100)) {
      errors.push(`${label}的頭期款百分比須在 0% 到 100% 之間。`);
    }
    if (g.downMode === "amount" && (!Number.isFinite(g.downValue) || g.downValue < 0)) {
      errors.push(`${label}的頭期款金額不可為負數。`);
    }
    if (!Number.isFinite(g.extraCosts) || g.extraCosts < 0) errors.push(`${label}的額外費用不可為負數。`);
    if (!Number.isFinite(g.loanRatePct) || g.loanRatePct < 0 || g.loanRatePct > 20) {
      errors.push(`${label}的貸款年利率須在 0% 到 20% 之間。`);
    }
    if (!Number.isFinite(g.loanYears) || g.loanYears < 0 || g.loanYears > 40) {
      errors.push(`${label}的貸款年數須在 0 到 40 年之間（0 代表不貸款）。`);
    }
    if (g.loanYears > 0 && Number.isFinite(g.purchaseAge) && payoffAgeOf(g) > ageLife) {
      warnings.push(`「${g.name}」的貸款在 ${ageLife} 歲前還沒繳完，之後的部分沒有計入。`);
    }
  });
  return { errors, warnings };
}

/** 卡片顯示用數字（全部由 core 計算，UI 不自行換算） */
export interface GoalCardSummary {
  downPayment: number; // 頭期款（元，今日幣值）
  loanAmount: number; // 貸款金額（元，今日幣值）
  monthlyNominal: number; // 帳面月付金（元／月，每月固定）
  firstYearMonthlyReal: number; // 首年（購買隔年）月付換成今日幣值（元／月）
  payoffAge: number; // 還清年齡
}

export function goalCardSummary(goal: LifeGoal, ageNow: number, inflationPct: number): GoalCardSummary {
  const monthlyNominal = monthlyPaymentNominal(goal, ageNow, inflationPct);
  const tp = goal.purchaseAge - ageNow;
  const firstYearMonthlyReal = goal.loanYears > 0
    ? monthlyNominal / Math.pow(1 + inflationPct / 100, tp + 1)
    : 0;
  return {
    downPayment: downPaymentOf(goal),
    loanAmount: loanAmountOf(goal),
    monthlyNominal,
    firstYearMonthlyReal,
    payoffAge: payoffAgeOf(goal),
  };
}

/**
 * 頭期款可能不足的警告（規格 Phase 6 第三節第 8 點）：
 * 以含大目標的模擬結果回推購買年「扣頭期款前可用資產」，不足以支付該筆
 * 頭期款＋額外費用時回傳警告。每筆目標各檢查一次。
 */
export function goalShortfallWarnings(inp: SimInput): string[] {
  const goals = inp.lifeGoals ?? [];
  if (!goals.length) return [];
  const { res } = computePhase1(inp);
  const out: string[] = [];
  for (const g of goals) {
    const tp = g.purchaseAge - inp.ageNow;
    if (tp < 1 || tp >= res.rows.length) continue;
    const row = res.rows[tp];
    const prev = res.rows[tp - 1];
    const rate = row.phase === "work" ? res.r : res.rho;
    // 扣大目標前的可用資產 = 上年底資產×(1+報酬) + 當年 flow（flow 已含收入支出或退休缺口的負值，
    // 且退休期 flow 不含大目標還款，還款另在 goalPay；購買年 goalPay = 0）
    const available = prev.assets * (1 + rate) + row.flow + row.goalPay;
    const need = downPaymentOf(g) + Math.max(0, g.extraCosts || 0);
    if (available < need - 1e-9) {
      out.push(`${g.purchaseAge} 歲買${g.name}時，可用資產可能不夠付頭期款，資產可能歸零，請調整金額或時間`);
    }
  }
  return out;
}

export interface GoalsImpact {
  withEarliest: import("./retirement").EarliestResult;
  withoutEarliest: import("./retirement").EarliestResult;
  withRetireAssets: number;
  withoutRetireAssets: number;
  withFinalAssets: number;
  withoutFinalAssets: number;
  /** 最早可退休年齡差距（年）；任一邊不是「年齡」型態時為 null */
  earliestDiffYears: number | null;
  retireAssetsDiff: number; // 有 − 沒有（元，今日幣值）
  finalAssetsDiff: number;
}

/** 有／沒有大目標的對照（規格 Phase 6 第四節第 8 點）：同一組輸入跑兩次 computePhase1 */
export function goalsImpact(inp: SimInput): GoalsImpact {
  const withG = computePhase1(inp);
  const withoutG = computePhase1({ ...inp, lifeGoals: null });
  const earliestDiffYears =
    withG.earliest.type === "age" && withoutG.earliest.type === "age"
      ? withG.earliest.age - withoutG.earliest.age
      : null;
  return {
    withEarliest: withG.earliest,
    withoutEarliest: withoutG.earliest,
    withRetireAssets: withG.res.retireAssets,
    withoutRetireAssets: withoutG.res.retireAssets,
    withFinalAssets: withG.res.finalAssets,
    withoutFinalAssets: withoutG.res.finalAssets,
    earliestDiffYears,
    retireAssetsDiff: withG.res.retireAssets - withoutG.res.retireAssets,
    finalAssetsDiff: withG.res.finalAssets - withoutG.res.finalAssets,
  };
}
