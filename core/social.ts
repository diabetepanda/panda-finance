// core/social.ts｜勞保老年年金與勞退新制（規格第 6.2、6.3 節）
// 純函式。所有制度數字來自 config/social.ts（假設參數，待查證）。

import { realRate } from "./rates";
import { pvAnnuity } from "./annuity";
import { socialParamValue } from "../config/social";

export interface LaborInsuranceInput {
  existingYears: number; // 目前已有勞保年資（年）
  plannedYears: number | null; // 預計投保年資（到退休為止）；null = 已有年資 + 工作年數
  avgInsuredSalary: number; // 平均月投保薪資（元，不超過上限）
  claimAge: number; // 請領年齡
  discountPct: number; // 年金打折（%），模擬勞保財務風險
  indexed: boolean; // 年金是否隨通膨調整
}

export interface LaborPensionInput {
  monthlyWage: number; // 月提繳工資（元）
  employerRatePct: number; // 雇主提繳率%
  employeeRatePct: number; // 員工自提率%
  fundReturnPct: number; // 勞退基金收益率（名目%）
  currentBalance: number; // 目前個人帳戶累積（元，今日幣值）
  mode: "lump" | "monthly"; // 一次領 / 月領
}

export interface SocialInput {
  laborInsurance: LaborInsuranceInput;
  laborPension: LaborPensionInput;
}

/** 到退休年齡 R 時的預計勞保年資 */
export function plannedYearsAt(li: LaborInsuranceInput, ageNow: number, retireAge: number): number {
  return li.plannedYears ?? li.existingYears + Math.max(0, retireAge - ageNow);
}

/**
 * 勞保月領年金（今日幣值，元/月）：
 * 未調整 = 平均月投保薪資 × 年資 × 費率（第 6.2 節）；
 * 提前請領每提前 1 年減給、延後每延後 1 年增給（各有年數上限，參數在設定檔）；
 * 最後套用打折。
 */
export function laborInsuranceMonthly(li: LaborInsuranceInput, years: number): number {
  const salary = Math.min(li.avgInsuredSalary, socialParamValue("liSalaryCap"));
  const base = salary * years * (socialParamValue("liRatePerYear") / 100);
  const legal = socialParamValue("liLegalClaimAge");
  let factor = 1;
  if (li.claimAge < legal) {
    const early = Math.min(legal - li.claimAge, socialParamValue("liEarlyMaxYears"));
    factor = 1 - (early * socialParamValue("liEarlyPerYear")) / 100;
  } else if (li.claimAge > legal) {
    const late = Math.min(li.claimAge - legal, socialParamValue("liLateMaxYears"));
    factor = 1 + (late * socialParamValue("liLatePerYear")) / 100;
  }
  return base * factor * (1 - li.discountPct / 100);
}

/**
 * 勞保年金第 k 年的實質年額（元/年）。
 * 【基準點務必注意】k 是「從現在起算的總經過年數」，不是從請領年起算。
 * - 隨通膨調整（indexed）：實質口徑下維持不變 = 今日幣值月領 × 12。
 * - 不隨通膨調整：請領當下的名目金額就此固定。
 *   名目固定年金 = 今日幣值月領 × 12 × (1 + 通膨)^(請領年齡 − 現在年齡)，
 *   第 k 年實質 = 名目固定年金 ÷ (1 + 通膨)^k。
 *   驗證（案例 13）：30 歲、65 歲請領、月領 18,600、通膨 2%：
 *   k=35 → 223,200；k=40 → 223,200 / 1.02^5。
 */
export function laborInsuranceRealAnnual(
  monthlyToday: number, indexed: boolean, inflation: number,
  yearsFromNowToClaim: number, k: number
): number {
  if (indexed) return monthlyToday * 12;
  const nominalFixed = monthlyToday * 12 * Math.pow(1 + inflation, yearsFromNowToClaim);
  return nominalFixed / Math.pow(1 + inflation, k);
}

/**
 * 勞退個人帳戶累積到退休年齡 R 的實質金額（今日幣值）。
 * 每年提繳（名目）= min(月提繳工資 × (1+名目薪資成長)^(t-1), 上限) × 12 × (雇主+自提)率；
 * 上限不隨通膨調整（config LR_WAGE_CAP_INFLATION_ADJUST = false）。
 * 實質提繳 = 名目提繳 ÷ (1+通膨)^(t-1)（與主模擬相同的實質化流程），
 * 以勞退基金實質收益率逐年累積（年底提繳）。
 * 注意：月收入欄位是已扣除自提後的實領，自提只進本帳戶，不再從收入扣。
 */
export function laborPensionAccumulate(
  lp: LaborPensionInput,
  ageNow: number, retireAge: number,
  salaryGrowthPct: number, inflationPct: number
): number {
  const workYears = Math.max(0, retireAge - ageNow);
  const inf = inflationPct / 100;
  const nomG = salaryGrowthPct / 100;
  const rf = realRate(lp.fundReturnPct / 100, inf);
  const cap = socialParamValue("lrWageCap");
  const rate = (lp.employerRatePct + lp.employeeRatePct) / 100;
  let balance = lp.currentBalance;
  for (let t = 1; t <= workYears; t++) {
    const nominalWage = Math.min(lp.monthlyWage * Math.pow(1 + nomG, t - 1), cap);
    const realContrib = (nominalWage * 12 * rate) / Math.pow(1 + inf, t - 1);
    balance = balance * (1 + rf) + realContrib;
  }
  return balance;
}

/**
 * 勞退月領（實質，元/年）：以勞退基金實質收益率年金化、領到預期壽命。
 * 用年金現值公式反推：年額 = 帳戶金額 ÷ pvAnnuity(1, rf, 年數)；
 * rf = 0 時退化為總額 ÷ 年數。此為簡化（實際依官方年金生命表）。
 */
export function laborPensionMonthlyAnnual(balanceAtRetire: number, fundReturnPct: number, inflationPct: number, years: number): number {
  if (years <= 0 || balanceAtRetire <= 0) return 0;
  const rf = realRate(fundReturnPct / 100, inflationPct / 100);
  const factor = pvAnnuity(1, rf, years);
  return factor > 0 ? balanceAtRetire / factor : balanceAtRetire / years;
}
