// core/social.ts｜勞保老年年金與勞退新制（規格第 6.2、6.3 節）
// 純函式。所有制度數字來自 config/social.ts（Phase 3.2 已依官方來源查證；勞退基金收益率為假設值）。

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
  claimAge: number; // 勞退法定請領年齡（使用者可調，預設見設定檔）
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
 * 未調整金額依勞工保險條例第 58-1 條「兩式擇優」：
 *   第一式 = 平均月投保薪資 × 年資 × 0.775% ＋ 3,000 元
 *   第二式 = 平均月投保薪資 × 年資 × 1.55%
 *   base = max(第一式, 第二式)
 * 3,000 元為法定名目定額，本工具當今日幣值處理（簡化見 ASSUMPTIONS.md）。
 * 之後套用提前減給／延後增給（第 58-2 條對「依前條計算之給付金額」整筆計算，
 * 故 3,000 元一併乘算），最後套用打折。
 */
export function laborInsuranceMonthly(li: LaborInsuranceInput, years: number): number {
  const salary = Math.min(li.avgInsuredSalary, socialParamValue("liSalaryCap"));
  const formula1 = salary * years * (socialParamValue("liRateAltPerYear") / 100) + socialParamValue("liFixedAddon");
  const formula2 = salary * years * (socialParamValue("liRatePerYear") / 100);
  const base = Math.max(formula1, formula2);
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

/** 勞退實際開始領取年齡 = max(退休年齡, 法定請領年齡)；之前為空窗期，收入 0 */
export function laborPensionStartAge(lp: LaborPensionInput, retireAge: number): number {
  return Math.max(retireAge, lp.claimAge);
}

/** 空窗期帳戶續累積：退休時帳戶以勞退基金實質收益率成長 waitYears 年（不再提繳） */
export function laborPensionGrow(balanceAtRetire: number, fundReturnPct: number, inflationPct: number, waitYears: number): number {
  const rf = realRate(fundReturnPct / 100, inflationPct / 100);
  return balanceAtRetire * Math.pow(1 + rf, Math.max(0, waitYears));
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

/**
 * 勞退月領資格提示旗標（勞工退休金條例第 24 條第 1 項）：
 * 選月領且提繳年資未滿 lrMinYearsMonthly（15 年）時為 true。
 * 年資以「現在年齡到退休年齡的年數」近似（工具未輸入過去勞退年資，見 ASSUMPTIONS.md）。
 * 只影響提示，計算邏輯不變。
 */
export function laborPensionMonthlyEligibilityWarning(lp: LaborPensionInput, ageNow: number, retireAge: number): boolean {
  if (lp.mode !== "monthly") return false;
  const approxYears = Math.max(0, retireAge - ageNow);
  return approxYears < socialParamValue("lrMinYearsMonthly");
}
