// core/validate.ts｜輸入驗證（規格第 7 節）純函式。

import { type SimInput } from "./simulate";

export interface ValidationResult {
  valid: boolean;
  ageErrors: string[];
  basicErrors: string[];
  incomeErrors: string[];
  assumpErrors: string[];
  warnings: string[];
}

export function validateInput(inp: SimInput): ValidationResult {
  const ageErrors: string[] = [];
  const basicErrors: string[] = [];
  const incomeErrors: string[] = [];
  const assumpErrors: string[] = [];
  const warnings: string[] = [];

  // 年齡規則（7.1）：A <= R < L；R=A 為已退休，合法
  if (!Number.isFinite(inp.ageNow) || !Number.isFinite(inp.ageRetire) || !Number.isFinite(inp.ageLife)) {
    ageErrors.push("年齡請輸入數字。");
  } else {
    if (inp.ageRetire < inp.ageNow) ageErrors.push("退休年齡不可小於現在年齡。");
    if (inp.ageLife <= inp.ageRetire) ageErrors.push("預期壽命須大於退休年齡。");
    if (inp.ageNow < 18 || inp.ageNow > 80) ageErrors.push("現在年齡的合理範圍是 18 到 80 歲。");
    if (inp.ageLife > 110) ageErrors.push("預期壽命上限是 110 歲。");
  }

  if (!Number.isFinite(inp.initAssets) || !Number.isFinite(inp.otherRetireIncome)) {
    basicErrors.push("金額請輸入數字。");
  } else {
    if (inp.initAssets < 0) basicErrors.push("目前已有資產不可為負數。");
    if (inp.otherRetireIncome < 0) basicErrors.push("其他退休收入不可為負數。");
  }

  if (!Number.isFinite(inp.monthlyIncome) || !Number.isFinite(inp.retireSpend)) {
    incomeErrors.push("金額請輸入數字。");
  } else {
    if (inp.monthlyIncome < 0) incomeErrors.push("月收入不可為負數。");
    if (inp.retireSpend < 0) incomeErrors.push("退休後月支出不可為負數。");
  }
  for (const e of inp.expenses) {
    if (!Number.isFinite(e.amount) || e.amount < 0) incomeErrors.push("支出金額不可為負數。");
    if (e.endAge !== null && !Number.isFinite(e.endAge)) incomeErrors.push("支出結束年齡請輸入數字。");
  }

  if (!Number.isFinite(inp.inflation) || !Number.isFinite(inp.retPre) || !Number.isFinite(inp.retPost) || !Number.isFinite(inp.salaryGrowth)) {
    assumpErrors.push("假設參數請輸入數字。");
  } else {
    if (1 + inp.inflation / 100 <= 0) assumpErrors.push("通膨率使換算無法進行（需大於 −100%），請調整。");
    if (inp.retPre > 30 || inp.retPre < -10) warnings.push(`投資年化報酬率 ${inp.retPre}%：這個數值極端，請確認。`);
    if (inp.retPost > 30 || inp.retPost < -10) warnings.push(`退休後年化報酬率 ${inp.retPost}%：這個數值極端，請確認。`);
    if (inp.inflation < -2 || inp.inflation > 15) warnings.push(`通膨率 ${inp.inflation}%：這個數值極端，請確認。`);
  }

  const valid = ageErrors.length + basicErrors.length + incomeErrors.length + assumpErrors.length === 0;
  return { valid, ageErrors, basicErrors, incomeErrors, assumpErrors, warnings };
}
