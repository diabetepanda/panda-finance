// core/investCompare.ts｜投資對照卡（規格 Phase 4 第六節）
// 純函式。四組試算（都用與主畫面相同的 SimInput，含勞保勞退）：
//   定存 ×（每年加碼／固定金額）、大盤型 ETF 組合 ×（每年加碼／固定金額）
// 以及「晚 N 年才開始投資」（前 N 年放定存、之後才投資）的對照。
// 口徑與主畫面不同：主畫面用「收入 − 支出」的實際結餘，本模組用使用者設定的定期定額金額。

import { simulate, type SimInput } from "./simulate";
import { earliestRetirement } from "./retirement";
import { paramValue } from "../config/defaults";
import { dca } from "./dca";

export interface InvestCompareInput {
  base: SimInput; // 與主畫面相同的設定（勞保勞退照主畫面）
  monthlyStart: number; // 每月定期定額金額（今日幣值）
  stepPct: number; // 每年調高幅度（名目 %）；0 = 固定金額
  cashRetPct: number; // 定存中性報酬率（名目 %）
}

export interface InvestCompareCell {
  retireAssets: number; // 退休時資產（今日幣值）
  earliest: number | null; // 最早可退休年齡
}

export interface InvestCompareResult {
  cashStepped: InvestCompareCell;
  cashFixed: InvestCompareCell;
  marketStepped: InvestCompareCell;
  marketFixed: InvestCompareCell;
  /** 大盤（加碼）− 定存（加碼）：退休時資產差（今日幣值） */
  gapAssets: number;
  /** 最早退休年齡差（定存 − 大盤，正值 = 大盤較早） */
  gapYears: number | null;
  /** 晚開始：延後年數（工作年數 <10 年時為一半） */
  delayYears: number;
  delayIsHalf: boolean;
  /** 現在開始（大盤、加碼）− 晚開始：退休時資產差（今日幣值） */
  delayGapAssets: number;
  /** 動態說明用：N=工作年數、A、B（名目）、B′（今日幣值）、C=固定金額版終值（大盤，加碼→固定） */
  dyn: {
    years: number;
    aMonthly: number;
    lastMonthlyNominal: number;
    lastMonthlyReal: number;
    fixedRetireAssetsReal: number;
    fixedRetireAssetsNominal: number;
  };
}

function cell(base: SimInput, over: Partial<SimInput>): InvestCompareCell {
  const inp: SimInput = { ...base, ...over };
  const tol = paramValue("exhaustTolerance");
  const res = simulate(inp, inp.ageRetire, tol);
  const e = earliestRetirement(inp);
  return { retireAssets: res.retireAssets, earliest: e.type === "age" ? e.age : null };
}

export function investCompare(x: InvestCompareInput): InvestCompareResult {
  const { base, monthlyStart, stepPct, cashRetPct } = x;
  const stepped = { monthlyStart, stepPct };
  const fixedAmt = { monthlyStart, stepPct: 0 };
  const cashRates = { retPre: cashRetPct, retPost: cashRetPct };

  const cashStepped = cell(base, { ...cashRates, contribution: stepped });
  const cashFixed = cell(base, { ...cashRates, contribution: fixedAmt });
  const marketStepped = cell(base, { contribution: stepped });
  const marketFixed = cell(base, { contribution: fixedAmt });

  const workYears = base.ageRetire - base.ageNow;
  const delayIsHalf = workYears < 10;
  const delayYears = delayIsHalf ? Math.max(1, Math.floor(workYears / 2)) : 10;
  const delayed = cell(base, { contribution: stepped, cashYearsAtStart: { years: delayYears, cashRetPct } });

  const dynDca = dca({ monthlyStart, stepPct, nominalReturnPct: base.retPre, inflationPct: base.inflation, years: Math.max(1, workYears) });

  return {
    cashStepped, cashFixed, marketStepped, marketFixed,
    gapAssets: marketStepped.retireAssets - cashStepped.retireAssets,
    gapYears: cashStepped.earliest !== null && marketStepped.earliest !== null
      ? cashStepped.earliest - marketStepped.earliest
      : null,
    delayYears, delayIsHalf,
    delayGapAssets: marketStepped.retireAssets - delayed.retireAssets,
    dyn: {
      years: workYears,
      aMonthly: monthlyStart,
      lastMonthlyNominal: dynDca.lastMonthlyNominal,
      lastMonthlyReal: dynDca.lastMonthlyReal,
      fixedRetireAssetsReal: marketFixed.retireAssets,
      fixedRetireAssetsNominal: marketFixed.retireAssets * Math.pow(1 + base.inflation / 100, Math.max(0, workYears)),
    },
  };
}
