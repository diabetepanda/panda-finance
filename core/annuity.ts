// core/annuity.ts｜年金現值與終值（規格第 3.6 節）
// 純函式。利率為 0 的特例必須處理，不可除以零。

/** 年金現值：每期期末支付 payment、共 n 期、每期利率 rate 的現值 */
export function pvAnnuity(payment: number, rate: number, n: number): number {
  if (n <= 0 || payment === 0) return 0;
  if (Math.abs(rate) < 1e-12 || 1 + rate <= 0) return payment * n;
  return payment * (1 - Math.pow(1 + rate, -n)) / rate;
}

/** 年金終值：每期期末投入 payment、共 n 期、每期利率 rate 的終值 */
export function fvAnnuity(payment: number, rate: number, n: number): number {
  if (n <= 0 || payment === 0) return 0;
  if (Math.abs(rate) < 1e-12 || 1 + rate <= 0) return payment * n;
  return payment * (Math.pow(1 + rate, n) - 1) / rate;
}
