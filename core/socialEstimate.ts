// core/socialEstimate.ts｜勞保勞退「幫我估」（規格 Phase 5 第四、八節）
// 純函式。UI 的 toInput 與步驟 ③ 的估算顯示都只呼叫這裡，不在元件裡重算。

import { bracketFor, LI_SALARY_BRACKETS, LR_WAGE_BRACKETS, socialParamValue } from "../config/social";
import type { SocialInput } from "./social";

/** 已有勞保年資 = max(0, 現在年齡 − 開始工作年齡)；開始年齡非有限數字時回傳 0 */
export function estimateExistingYears(ageNow: number, startWorkAge: number): number {
  if (!Number.isFinite(startWorkAge)) return 0;
  return Math.max(0, ageNow - startWorkAge);
}

/** 薪資基準：稅前月薪有填（有限且 > 0）用稅前，否則用實領月薪 */
export function wageBasis(grossSalary: number, monthlyIncome: number): number {
  return Number.isFinite(grossSalary) && grossSalary > 0 ? grossSalary : monthlyIncome;
}

/** 勞保投保薪資：薪資基準對 115 年勞保級距（上限 liSalaryCap） */
export function estimateInsuredSalary(wage: number): number {
  return bracketFor(wage, LI_SALARY_BRACKETS, socialParamValue("liSalaryCap"));
}

/** 勞退提繳薪資：薪資基準對 115 年勞退級距（上限 lrWageCap） */
export function estimateLrWage(wage: number): number {
  return bracketFor(wage, LR_WAGE_BRACKETS, socialParamValue("lrWageCap"));
}

/** 勞退帳戶目前累積 ≈ 年資 × 12 × 提繳薪資 × 雇主提繳率 ÷ 100（不計收益，偏保守）；任一值 ≤ 0 回傳 0 */
export function estimateLrBalance(years: number, lrWage: number, employerRatePct: number): number {
  if (!(years > 0) || !(lrWage > 0) || !(employerRatePct > 0)) return 0;
  return (years * 12 * lrWage * employerRatePct) / 100;
}

export interface SocialChoice {
  laborInsured: "yes" | "no" | "unsure";
  socialInputMode: "estimate" | "manual";
  ageNow: number;
  startWorkAge: number;
  grossSalary: number; // NaN 或 ≤ 0 視為空白
  monthlyIncome: number;
  // 手動模式欄位
  liExistingYears: number;
  liAvgSalary: number;
  liSalaryManual: boolean;
  lrBalance: number;
  lrEmployeeRate: number;
  // 兩種模式共用
  liPlannedYears: number | null;
  liClaimAge: number;
  liDiscountPct: number;
  liIndexed: boolean;
  lrWage: number;
  lrWageManual: boolean;
  lrEmployerRate: number;
  lrFundReturn: number;
  lrMode: "lump" | "monthly";
  lrClaimAge: number;
}

/** 把步驟 ③ 的選擇轉成 SocialInput | null（規格 Phase 5 第八節第 3 點） */
export function resolveSocialInput(c: SocialChoice): SocialInput | null {
  if (c.laborInsured === "no") return null;
  const basis = wageBasis(c.grossSalary, c.monthlyIncome);
  const lrWage = c.lrWageManual ? c.lrWage : estimateLrWage(basis);
  const estimateMode = c.laborInsured === "unsure" || c.socialInputMode === "estimate";
  let existingYears: number, avgInsuredSalary: number, currentBalance: number;
  if (estimateMode) {
    existingYears = estimateExistingYears(c.ageNow, c.startWorkAge);
    avgInsuredSalary = estimateInsuredSalary(basis);
    currentBalance = estimateLrBalance(existingYears, lrWage, c.lrEmployerRate);
  } else {
    existingYears = c.liExistingYears;
    avgInsuredSalary = c.liSalaryManual ? c.liAvgSalary : estimateInsuredSalary(basis);
    currentBalance = c.lrBalance;
  }
  return {
    laborInsurance: {
      existingYears,
      plannedYears: c.liPlannedYears,
      avgInsuredSalary,
      claimAge: c.liClaimAge,
      discountPct: c.liDiscountPct,
      indexed: c.liIndexed,
    },
    laborPension: {
      monthlyWage: lrWage,
      employerRatePct: c.lrEmployerRate,
      employeeRatePct: c.lrEmployeeRate,
      fundReturnPct: c.lrFundReturn,
      currentBalance,
      mode: c.lrMode,
      claimAge: c.lrClaimAge,
    },
  };
}

/** 步驟 ③ 估算模式的提示（只提示，不阻擋計算） */
export function validateSocialChoice(v: { ageNow: number; startWorkAge: number; grossSalary: number }): string[] {
  const msgs: string[] = [];
  if (Number.isFinite(v.startWorkAge) && v.startWorkAge > v.ageNow) {
    msgs.push("開始工作年齡不能大於現在年齡，先以 0 年計算。");
  }
  if (Number.isFinite(v.startWorkAge) && v.startWorkAge < 15) {
    msgs.push("開始工作年齡小於 15 歲，請確認是否正確。");
  }
  if (Number.isFinite(v.grossSalary) && v.grossSalary < 0) {
    msgs.push("稅前月薪不能是負數，先當作空白、用實領薪水估。");
  }
  return msgs;
}
