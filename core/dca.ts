// core/dca.ts｜定期定額遞增年金（規格 Phase 4 第五節）
// 純函式。時間口徑：本模組把「第 1 年」當成今天的價格——
// 第 t 年的名目金額 = 今日幣值 × (1 + 通膨)^(t−1)；
// 第 t 年名目每月投入 = A × (1 + 名目調高幅度)^(t−1)。
// 每年年底投入：第 t 年投入（今日幣值）= 12A × (1+g)^(t−1)，
// 其中 r = realRate(名目報酬, 通膨)，g = realRate(調高幅度, 通膨)。
// 終值（今日幣值）FV = 12A × [(1+r)^n − (1+g)^n] ÷ (r − g)；
// |r − g| < 1e-12 時 FV = 12A × n × (1+r)^(n−1)。

import { realRate } from "./rates";

export interface DcaInput {
  monthlyStart: number; // A：第 1 年每月投入（元，今日幣值）
  stepPct: number; // 每年調高幅度（名目 %）
  nominalReturnPct: number; // 名目報酬率 %
  inflationPct: number; // 通膨率 %
  years: number; // 年限
}

export interface DcaYearPoint {
  t: number;
  contributedReal: number; // 累積投入本金（今日幣值）
  contributedNominal: number; // 累積投入本金（名目）
  valueReal: number; // 年底資產（今日幣值）
  valueNominal: number; // 年底資產（名目）
}

export interface DcaResult {
  years: number;
  fvReal: number; // 終值（今日幣值）
  fvNominal: number; // 終值（名目）＝ 今日幣值 × (1+通膨)^(n−1)
  principalReal: number; // 累積投入本金（今日幣值）
  principalNominal: number; // 累積投入本金（名目）
  firstMonthly: number; // 第 1 年每月 A
  lastMonthlyReal: number; // 最後一年每月（今日幣值）= A × (1+g)^(n−1)
  lastMonthlyNominal: number; // 最後一年每月（名目）= A × (1+調高幅度)^(n−1)
  curve: DcaYearPoint[];
}

export function dca(inp: DcaInput): DcaResult {
  const n = Math.max(0, Math.floor(inp.years));
  const A = Math.max(0, inp.monthlyStart);
  const inf = inp.inflationPct / 100;
  const r = realRate(inp.nominalReturnPct / 100, inf);
  const g = realRate(inp.stepPct / 100, inf);
  const base = 12 * A;

  let fvReal: number;
  if (n === 0) fvReal = 0;
  else if (Math.abs(r - g) < 1e-12) fvReal = base * n * Math.pow(1 + r, n - 1);
  else fvReal = (base * (Math.pow(1 + r, n) - Math.pow(1 + g, n))) / (r - g);

  const curve: DcaYearPoint[] = [];
  let contributedReal = 0, contributedNominal = 0, valueReal = 0;
  for (let t = 1; t <= n; t++) {
    const cReal = base * Math.pow(1 + g, t - 1);
    contributedReal += cReal;
    contributedNominal += base * Math.pow(1 + inp.stepPct / 100, t - 1);
    valueReal = valueReal * (1 + r) + cReal;
    curve.push({
      t, contributedReal, contributedNominal, valueReal,
      valueNominal: valueReal * Math.pow(1 + inf, t - 1),
    });
  }

  return {
    years: n,
    fvReal,
    fvNominal: n === 0 ? 0 : fvReal * Math.pow(1 + inf, n - 1),
    principalReal: contributedReal,
    principalNominal: contributedNominal,
    firstMonthly: A,
    lastMonthlyReal: n === 0 ? A : A * Math.pow(1 + g, n - 1),
    lastMonthlyNominal: n === 0 ? A : A * Math.pow(1 + inp.stepPct / 100, n - 1),
    curve,
  };
}

/** 同時算「每年加碼」與「固定金額（stepPct=0）」兩組 */
export function dcaPair(inp: DcaInput): { stepped: DcaResult; fixed: DcaResult } {
  return { stepped: dca(inp), fixed: dca({ ...inp, stepPct: 0 }) };
}
