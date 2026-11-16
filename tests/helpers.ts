// tests/helpers.ts｜範例輸入（與 Phase 1 範例相同，供回歸測試共用）
import type { SimInput } from "../core/simulate";
import { EXAMPLE_EXPENSES, paramValue } from "../config/defaults";
import { defaultCategoryFor } from "../config/categories";

export function defaultFormInput(): SimInput {
  const totalExp = EXAMPLE_EXPENSES.reduce((s, e) => s + e.amount, 0);
  return {
    ageNow: paramValue("ageNow"), ageRetire: paramValue("ageRetire"), ageLife: paramValue("ageLife"),
    initAssets: paramValue("initAssets"), otherRetireIncome: paramValue("otherRetireIncome"),
    monthlyIncome: paramValue("monthlyIncome"), salaryGrowth: paramValue("salaryGrowth"),
    expenses: EXAMPLE_EXPENSES.map((e) => ({ name: e.name, amount: e.amount, endAge: null, category: defaultCategoryFor(e.name) })),
    retireSpend: Math.round(totalExp * (paramValue("retireSpendRatio") / 100)),
    inflation: paramValue("inflation"), retPre: paramValue("retPre"), retPost: paramValue("retPost"),
    extraMonthlySaving: 0,
  };
}
