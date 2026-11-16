// core/rates.ts｜利率與金額換算（規格第 3.2、3.3 節）
// 純函式：不依賴 UI、DOM 或全域狀態。

/** 實質報酬率 r = (1 + 名目報酬率) / (1 + 通膨率) − 1（不可用直接相減） */
export function realRate(nominal: number, inflation: number): number {
  const denom = 1 + inflation;
  if (denom === 0) throw new Error("1 + 通膨率不可為 0");
  return (1 + nominal) / denom - 1;
}

/** 名目金額 = 實質金額 × (1 + 通膨率)^經過年數（經過年數從現在起算） */
export function realToNominal(realAmount: number, inflation: number, years: number): number {
  return realAmount * Math.pow(1 + inflation, years);
}

/** 實質金額 = 名目金額 ÷ (1 + 通膨率)^經過年數 */
export function nominalToReal(nominalAmount: number, inflation: number, years: number): number {
  const denom = Math.pow(1 + inflation, years);
  if (denom === 0) throw new Error("(1 + 通膨率)^年數不可為 0");
  return nominalAmount / denom;
}
