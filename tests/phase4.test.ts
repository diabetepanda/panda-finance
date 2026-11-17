// tests/phase4.test.ts｜Phase 4：其他退休收入小幫手、遞增年金、投資對照、ETF 比較、新預設值
import { describe, it, expect } from "vitest";
import { sumOtherRetireIncome } from "../core/otherIncome";
import { dca, dcaPair } from "../core/dca";
import { realRate } from "../core/rates";
import { simulate, type SimInput } from "../core/simulate";
import { computePhase1 } from "../core/compute";
import { investCompare } from "../core/investCompare";
import { defaultFormInput } from "./helpers";
import { PARAM_MAP, paramValue } from "../config/defaults";
import { ASSETS, ASSET_MAP } from "../config/assets";
import type { SocialInput } from "../core/social";

const wan = (v: number) => Math.round((v / 10000) * 10) / 10;

describe("第一節｜sumOtherRetireIncome", () => {
  it("三項加總正確", () => {
    expect(sumOtherRetireIncome({ rentNet: 8000, annuity: 5000, partTime: 3000 })).toBe(16000);
  });
  it("負數或空值（NaN）當 0", () => {
    expect(sumOtherRetireIncome({ rentNet: -100, annuity: NaN, partTime: 2000 })).toBe(2000);
    expect(sumOtherRetireIncome({ rentNet: 0, annuity: 0, partTime: 0 })).toBe(0);
  });
});

describe("第五節｜dca 遞增年金", () => {
  const A = 20000, INF = 2;
  it("(a) 報酬 0 且調高 0：實質終值 = 每年投入實質金額逐年加總；名目本金總和 = 12A × n", () => {
    const out = dca({ monthlyStart: A, stepPct: 0, nominalReturnPct: 0, inflationPct: INF, years: 10 });
    // 實質報酬 = realRate(0, 2%) < 0，終值以逐年迴圈對照
    let loop = 0; const r = realRate(0, INF / 100), g = realRate(0, INF / 100);
    for (let t = 1; t <= 10; t++) loop = loop * (1 + r) + 12 * A * Math.pow(1 + g, t - 1);
    expect(Math.abs(out.fvReal - loop)).toBeLessThan(1e-6);
    expect(Math.abs(out.principalNominal - 12 * A * 10)).toBeLessThan(1e-6);
  });
  it("(b) 調高 0 時等於固定金額公式（逐年迴圈加總對照）", () => {
    const out = dca({ monthlyStart: A, stepPct: 0, nominalReturnPct: 7, inflationPct: INF, years: 30 });
    let loop = 0; const r = realRate(0.07, INF / 100), g = realRate(0, INF / 100);
    for (let t = 1; t <= 30; t++) loop = loop * (1 + r) + 12 * A * Math.pow(1 + g, t - 1);
    expect(Math.abs(out.fvReal - loop)).toBeLessThan(1e-6);
  });
  it("(c) 調高 > 0 的終值大於調高 0", () => {
    const { stepped, fixed } = dcaPair({ monthlyStart: A, stepPct: 2.5, nominalReturnPct: 7, inflationPct: INF, years: 30 });
    expect(stepped.fvReal).toBeGreaterThan(fixed.fvReal);
  });
  it("(d) r = g 特例：公式 = 逐年迴圈（誤差 < 1e-6）", () => {
    const out = dca({ monthlyStart: A, stepPct: 7, nominalReturnPct: 7, inflationPct: INF, years: 30 });
    let loop = 0; const r = realRate(0.07, INF / 100), g = realRate(0.07, INF / 100);
    for (let t = 1; t <= 30; t++) loop = loop * (1 + r) + 12 * A * Math.pow(1 + g, t - 1);
    expect(Math.abs(out.fvReal - loop)).toBeLessThan(1e-6);
  });
  it("(e) 報酬越高終值越高（單調）", () => {
    const lo = dca({ monthlyStart: A, stepPct: 2.5, nominalReturnPct: 4, inflationPct: INF, years: 30 }).fvReal;
    const mid = dca({ monthlyStart: A, stepPct: 2.5, nominalReturnPct: 7, inflationPct: INF, years: 30 }).fvReal;
    const hi = dca({ monthlyStart: A, stepPct: 2.5, nominalReturnPct: 10, inflationPct: INF, years: 30 }).fvReal;
    expect(lo).toBeLessThan(mid); expect(mid).toBeLessThan(hi);
  });
  it("(f) B 名目 ≈ 40,928、B 今日幣值 ≈ 23,047（A=20,000、調高 2.5%、30 年）", () => {
    const out = dca({ monthlyStart: A, stepPct: 2.5, nominalReturnPct: 7, inflationPct: INF, years: 30 });
    expect(Math.abs(out.lastMonthlyNominal - 40928)).toBeLessThan(1);
    expect(Math.abs(out.lastMonthlyReal - 23047)).toBeLessThan(1);
  });
  it("第七節驗收數字：0050 中性加碼 1,656.2 萬／固定 1,276.6 萬；定存 742.3 萬；本金加碼名目 1,053.7 萬、今日幣值 773.6 萬", () => {
    const o50 = dcaPair({ monthlyStart: A, stepPct: 2.5, nominalReturnPct: 7, inflationPct: INF, years: 30 });
    expect(wan(o50.stepped.fvReal)).toBe(1656.2);
    expect(wan(o50.fixed.fvReal)).toBe(1276.6);
    expect(wan(o50.stepped.principalNominal)).toBe(1053.7);
    expect(wan(o50.stepped.principalReal)).toBe(773.6);
    const cash = dcaPair({ monthlyStart: A, stepPct: 2.5, nominalReturnPct: 1.7, inflationPct: INF, years: 30 });
    expect(wan(cash.stepped.fvReal)).toBe(742.3);
    expect(wan(cash.fixed.fvReal)).toBe(523.2);
  });
});

describe("第六節｜simulate 新欄位與投資對照", () => {
  const base = defaultFormInput();
  it("contribution 與 cashYearsAtStart 沒給時，rows 與原版完全相同", () => {
    const a = simulate(base, base.ageRetire, 0);
    const b = simulate({ ...base, contribution: null, cashYearsAtStart: null }, base.ageRetire, 0);
    expect(b.rows).toEqual(a.rows);
    expect(b.retireAssets).toBe(a.retireAssets);
  });
  it("contribution 調高 0 的退休時資產小於調高 > 0", () => {
    const f = simulate({ ...base, contribution: { monthlyStart: 20000, stepPct: 0 } }, base.ageRetire, 0);
    const s = simulate({ ...base, contribution: { monthlyStart: 20000, stepPct: 2.5 } }, base.ageRetire, 0);
    expect(f.retireAssets).toBeLessThan(s.retireAssets);
  });
  it("投資對照：定存 vs 大盤差額為正；晚 10 年開始資產較少；前 10 年用定存報酬", () => {
    const cmp = investCompare({ base, monthlyStart: 20000, stepPct: 2.5, cashRetPct: 1.7 });
    expect(cmp.gapAssets).toBeGreaterThan(0);
    expect(cmp.delayYears).toBe(10);
    expect(cmp.delayGapAssets).toBeGreaterThan(0);
    // 前 10 年確實用定存報酬：以 rows 的 gain／前一年資產反推實質報酬率
    const delayed = simulate({ ...base, contribution: { monthlyStart: 20000, stepPct: 2.5 }, cashYearsAtStart: { years: 10, cashRetPct: 1.7 } }, base.ageRetire, 0);
    const cashReal = realRate(0.017, base.inflation / 100);
    const preReal = realRate(base.retPre / 100, base.inflation / 100);
    for (const t of [5, 10]) {
      const row = delayed.rows[t], prev = delayed.rows[t - 1];
      expect(Math.abs(row.gain / prev.assets - cashReal)).toBeLessThan(1e-9);
    }
    const row15 = delayed.rows[15], prev15 = delayed.rows[14];
    expect(Math.abs(row15.gain / prev15.assets - preReal)).toBeLessThan(1e-9);
  });
});

describe("第七節｜ETF 比較與標的清單", () => {
  it("每列終值等於 dca 直接計算；定存列中性 1.7%；順序與標的清單一致", () => {
    const rows = [...ASSETS, null].map((a) => {
      const ret = a === null ? 1.7 : a.returns.neutral.value;
      return dca({ monthlyStart: 20000, stepPct: 2.5, nominalReturnPct: ret, inflationPct: 2, years: 30 }).fvReal;
    });
    expect(wan(rows[0])).toBe(1656.2); // 0050
    expect(wan(rows[7])).toBe(742.3); // 定存基準列（ASSETS 之後加列）
    expect(ASSETS.map((a) => a.id)).toEqual(["tw0050", "voo", "tw0056", "tw00878", "tw00919", "qqq", "usbond", "cash"]);
  });
  it("年限改 40 時曲線長度為 40", () => {
    expect(dca({ monthlyStart: 20000, stepPct: 2.5, nominalReturnPct: 7, inflationPct: 2, years: 40 }).curve.length).toBe(40);
  });
});

describe("第八節｜新預設值與參數一致性", () => {
  const newBase: SimInput = {
    ...defaultFormInput(),
    retPre: paramValue("retPre"), retPost: paramValue("retPost"), inflation: paramValue("inflation"),
  };
  it("新預設、不含勞保勞退：資產約 2,235.8 萬、所需約 422.9 萬、達成率約 528.7%、最早 48 歲", () => {
    const out = computePhase1({ ...newBase, social: null });
    expect(wan(out.res.retireAssets)).toBe(2235.8);
    expect(wan(out.res.required)).toBe(422.9);
    expect(Math.round((out.res.achieve ?? 0) * 1000) / 10).toBe(528.7);
    expect(out.earliest).toEqual({ type: "age", age: 48 });
  });
  it("新預設、含勞保勞退（一次領、其餘照 UI 預設）：資產約 2,374.5 萬、所需 0、最早 45 歲", () => {
    const social: SocialInput = {
      laborInsurance: { existingYears: 0, plannedYears: null, avgInsuredSalary: 45800, claimAge: 65, discountPct: 0, indexed: true },
      laborPension: { monthlyWage: 50600, employerRatePct: 6, employeeRatePct: 0, fundReturnPct: 2, currentBalance: 0, mode: "lump", claimAge: 60 },
    };
    const out = computePhase1({ ...newBase, social });
    expect(wan(out.res.retireAssets)).toBe(2374.5);
    expect(out.res.required).toBe(0);
    expect(out.earliest).toEqual({ type: "age", age: 45 });
  });
  it("參數一致性：retPre − 折減 = retPost；保守 ≤ 中性 ≤ 樂觀；高股息中性 ≤ 0050；QQQ − VOO ≤ 1；無 tsmc", () => {
    expect(paramValue("retPre") - paramValue("retireReturnDeduction")).toBe(paramValue("retPost"));
    for (const a of ASSETS) {
      expect(a.returns.conservative.value).toBeLessThanOrEqual(a.returns.neutral.value);
      expect(a.returns.neutral.value).toBeLessThanOrEqual(a.returns.optimistic.value);
    }
    for (const id of ["tw0056", "tw00878", "tw00919"]) {
      expect(ASSET_MAP[id].returns.neutral.value).toBeLessThanOrEqual(ASSET_MAP["tw0050"].returns.neutral.value);
    }
    expect(ASSET_MAP["qqq"].returns.neutral.value - ASSET_MAP["voo"].returns.neutral.value).toBeLessThanOrEqual(1);
    expect(ASSET_MAP["tsmc"]).toBeUndefined();
    expect(PARAM_MAP["categoryInflationMedicalSuggested"]).toBeUndefined();
    expect(paramValue("dcaCompareYears")).toBe(30);
  });
});

describe("第四節｜JSON 匯入舊檔容忍", () => {
  it("舊檔帶已刪除欄位（inflation 等）直接忽略、不報錯，缺欄位用預設", async () => {
    const { pickKnownFields } = await import("../core/importForm");
    const template = { ageNow: "30", retPre: "6.5", socialEnabled: true };
    const oldFile = { ageNow: "40", inflation: "3", categoryEnabled: true, scenarioNeutralLinked: false };
    const out = pickKnownFields(oldFile, template);
    expect(out).toEqual({ ageNow: "40", retPre: "6.5", socialEnabled: true });
    expect("inflation" in out).toBe(false);
  });
});
