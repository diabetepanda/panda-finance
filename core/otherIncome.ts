// core/otherIncome.ts｜「其他退休收入」小幫手加總（規格 Phase 4 第一節）
// 純函式：三個子欄位（元/月，今日幣值）加總；負數或空值（NaN）當 0。

export interface OtherIncomeParts {
  rentNet: number; // 租金淨收入（租金扣掉稅、管理費、修繕）
  annuity: number; // 年金險每月給付
  partTime: number; // 退休後兼職收入
}

const clean = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

export function sumOtherRetireIncome(parts: OtherIncomeParts): number {
  return clean(parts.rentNet) + clean(parts.annuity) + clean(parts.partTime);
}
