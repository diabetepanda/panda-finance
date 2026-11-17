// ui/form.ts｜表單狀態、預設值、toInput 與 compute 管線（Phase 5 拆分自 App.tsx）
// UI 元件只透過這裡取得型別與轉換；計算一律在 core/。
import type { SimInput, SimResult } from "../core/simulate";
import type { EarliestResult } from "../core/retirement";
import { defaultRetireSpend } from "../core/retirement";
import { findExtraSavingForEarliest, type ExtraSavingSolution } from "../core/solver";
import { computePhase1, computeScenarios, monthlyTotals, defaultScenarioInflation, type ScenariosOutcome } from "../core/compute";
import { resolveSocialInput } from "../core/socialEstimate";
import { socialParamValue } from "../config/social";
import { paramValue, EXAMPLE_EXPENSES } from "../config/defaults";
import { ASSETS, SCENARIO_IDS, type ScenarioId } from "../config/assets";
import { defaultCategoryFor, type CategoryId } from "../config/categories";

export interface ExpenseRow { name: string; amount: string; endAge: string; category: CategoryId; }
export interface FormState {
  ageNow: string; ageRetire: string; ageLife: string;
  initAssets: string; otherRetireIncome: string;
  monthlyIncome: string; salaryGrowth: string;
  expenses: ExpenseRow[];
  retireSpend: string; retireManual: boolean;
  showExpenseEndAge: boolean;
  retPre: string; retPost: string;
  // Phase 4 其他退休收入小幫手
  otherRent: string; otherAnnuity: string; otherPartTime: string;
  // Phase 2
  assetsEnabled: boolean;
  allocation: Record<string, string>;
  retireAllocMode: "same" | "custom";
  retireAllocation: Record<string, string>;
  fxChange: string;
  returnOverrides: Record<string, Record<ScenarioId, string>>;
  deduction: string;
  // Phase 3 勞保勞退（Phase 5 改為三選一＋幫我估/手動）
  laborInsured: "yes" | "no" | "unsure";
  socialInputMode: "estimate" | "manual";
  startWorkAge: string;
  grossSalary: string;
  liExistingYears: string;
  liPlannedYears: string; liPlannedManual: boolean;
  liAvgSalary: string; liSalaryManual: boolean;
  liClaimAge: string; liDiscount: string; liIndexed: boolean;
  lrWage: string; lrWageManual: boolean;
  lrEmployerRate: string; lrEmployeeRate: string; lrFundReturn: string;
  lrBalance: string; lrMode: "lump" | "monthly"; lrClaimAge: string;
}

export const num = (s: string): number => (s.trim() === "" ? 0 : Number(s));

export function defaultForm(): FormState {
  return {
    ageNow: String(paramValue("ageNow")),
    ageRetire: String(paramValue("ageRetire")),
    ageLife: String(paramValue("ageLife")),
    initAssets: String(paramValue("initAssets")),
    otherRetireIncome: String(paramValue("otherRetireIncome")),
    monthlyIncome: String(paramValue("monthlyIncome")),
    salaryGrowth: String(paramValue("salaryGrowth")),
    expenses: EXAMPLE_EXPENSES.map((e) => ({ name: e.name, amount: String(e.amount), endAge: "", category: defaultCategoryFor(e.name) })),
    retireSpend: "", retireManual: false,
    showExpenseEndAge: false,
    otherRent: "", otherAnnuity: "", otherPartTime: "",
    retPre: String(paramValue("retPre")),
    retPost: String(paramValue("retPost")),
    assetsEnabled: false,
    allocation: Object.fromEntries(ASSETS.map((a) => [a.id, a.id === "tw0050" || a.id === "voo" ? "50" : "0"])),
    retireAllocMode: "same",
    retireAllocation: Object.fromEntries(ASSETS.map((a) => [a.id, "0"])),
    fxChange: String(paramValue("fxChange")),
    returnOverrides: Object.fromEntries(ASSETS.map((a) => [a.id, Object.fromEntries(SCENARIO_IDS.map((id) => [id, String(a.returns[id].value)])) as Record<ScenarioId, string>])),
    deduction: String(paramValue("retireReturnDeduction")),
    laborInsured: "yes", socialInputMode: "estimate",
    startWorkAge: String(paramValue("startWorkAge")), grossSalary: "",
    liExistingYears: "0",
    liPlannedYears: "", liPlannedManual: false,
    liAvgSalary: "", liSalaryManual: false,
    liClaimAge: String(socialParamValue("liLegalClaimAge")), liDiscount: "0", liIndexed: true,
    lrWage: "", lrWageManual: false,
    lrEmployerRate: String(socialParamValue("lrEmployerRate")), lrEmployeeRate: "0",
    lrFundReturn: String(socialParamValue("lrFundReturn")),
    lrBalance: "0", lrMode: "lump", lrClaimAge: String(socialParamValue("lrLegalClaimAge")),
  };
}

export function toInput(f: FormState): SimInput {
  const totalExp = f.expenses.reduce((s, e) => s + (Number.isFinite(num(e.amount)) ? num(e.amount) : NaN), 0);
  const retireSpend = f.retireManual
    ? num(f.retireSpend)
    : defaultRetireSpend(totalExp, paramValue("retireSpendRatio"));
  return {
    ageNow: num(f.ageNow), ageRetire: num(f.ageRetire), ageLife: num(f.ageLife),
    initAssets: num(f.initAssets), otherRetireIncome: num(f.otherRetireIncome),
    monthlyIncome: num(f.monthlyIncome), salaryGrowth: num(f.salaryGrowth),
    expenses: f.expenses.map((e) => ({
      name: e.name,
      amount: num(e.amount),
      endAge: e.endAge.trim() === "" ? null : Number(e.endAge),
      category: e.category ?? "other",
    })),
    retireSpend,
    inflation: paramValue("inflation"), // Phase 4：通膨固定 2%，不再由使用者輸入
    retPre: num(f.retPre), retPost: num(f.retPost),
    extraMonthlySaving: 0,
    categoryInflation: null, // Phase 4 起 UI 不使用（core 保留供日後擴充）
    retireSpendCategories: null,
    social: resolveSocialInput({
      laborInsured: f.laborInsured, socialInputMode: f.socialInputMode,
      ageNow: num(f.ageNow), startWorkAge: f.startWorkAge.trim() === "" ? NaN : num(f.startWorkAge),
      grossSalary: f.grossSalary.trim() === "" ? NaN : num(f.grossSalary),
      monthlyIncome: num(f.monthlyIncome),
      liExistingYears: num(f.liExistingYears), liAvgSalary: num(f.liAvgSalary), liSalaryManual: f.liSalaryManual,
      lrBalance: num(f.lrBalance), lrEmployeeRate: num(f.lrEmployeeRate),
      liPlannedYears: f.liPlannedManual ? num(f.liPlannedYears) : null,
      liClaimAge: num(f.liClaimAge), liDiscountPct: num(f.liDiscount), liIndexed: f.liIndexed,
      lrWage: num(f.lrWage), lrWageManual: f.lrWageManual,
      lrEmployerRate: num(f.lrEmployerRate), lrFundReturn: num(f.lrFundReturn),
      lrMode: f.lrMode, lrClaimAge: num(f.lrClaimAge),
    }),
  } as SimInput;
}

export interface Computed {
  inp: SimInput;
  res: SimResult;
  earliest: EarliestResult;
  totalMonthlyExpense: number;
  monthlyBalance: number;
  savingsRate: number | null;
  extraSolution: ExtraSavingSolution | null;
  scenarios: ScenariosOutcome | null; // Phase 2：標的啟用時的三情境結果
  goalScen: ScenariosOutcome; // Phase 3：目標反推/比較圖的三情境管線（標的啟用時使用）
}

export function compute(inp: SimInput, f: FormState): Computed {
  const out = computePhase1(inp);
  const totals = monthlyTotals(inp);
  const extraSolution = out.earliest.type === "none" ? findExtraSavingForEarliest(inp) : null;
  const scenSettings = {
    allocation: Object.fromEntries(Object.entries(f.allocation).map(([k, v]) => [k, num(v)])),
    retireAllocMode: f.retireAllocMode,
    retireAllocation: Object.fromEntries(Object.entries(f.retireAllocation).map(([k, v]) => [k, num(v)])),
    fxChangePct: num(f.fxChange),
    returnOverrides: Object.fromEntries(Object.entries(f.returnOverrides).map(([k, rec]) => [k, Object.fromEntries(Object.entries(rec).map(([sid, v]) => [sid, num(v)])) as Record<ScenarioId, number>])),
    scenarioInflation: defaultScenarioInflation(), // Phase 4：三情境通膨固定（2.5／2／1.5）
    deductionPct: num(f.deduction),
  };
  const scenOutcome = computeScenarios(inp, scenSettings);
  const scenarios: ScenariosOutcome | null = f.assetsEnabled ? scenOutcome : null;
  return {
    inp, res: out.res, earliest: out.earliest,
    totalMonthlyExpense: totals.totalExpense, monthlyBalance: totals.balance,
    savingsRate: totals.totalIncome > 0 ? totals.savingsRate : null,
    extraSolution, scenarios, goalScen: scenOutcome,
  };
}
