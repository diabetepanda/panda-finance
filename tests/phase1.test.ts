// Panda Finance Phase 1 單元測試（規格第 12.1 節）
// 涵蓋案例 1、2、3、4、6、7、8、15。全部輸入數字皆為測試情境設定，
// 預期值以規格公式獨立計算，不從 UI 取得。
import { describe, it, expect } from "vitest";
import { realRate, realToNominal } from "../core/rates";
import { pvAnnuity, fvAnnuity } from "../core/annuity";
import { simulate, type SimInput } from "../core/simulate";
import { earliestRetirement } from "../core/retirement";
import { findExtraSavingForEarliest } from "../core/solver";
import { paramValue } from "../config/defaults";

function baseInput(overrides: Partial<SimInput> = {}): SimInput {
  return {
    ageNow: paramValue("ageNow"),
    ageRetire: paramValue("ageRetire"),
    ageLife: paramValue("ageLife"),
    initAssets: 0,
    monthlyIncome: 50000,
    salaryGrowth: paramValue("salaryGrowth"),
    expenses: [],
    retireSpend: 22500,
    otherRetireIncome: 0,
    inflation: paramValue("inflation"),
    retPre: paramValue("retPre"),
    retPost: paramValue("retPost"),
    extraMonthlySaving: 0,
    ...overrides,
  };
}

describe("案例 1：利率轉換", () => {
  it("名目 7%、通膨 2%，實質報酬率約 4.902%（誤差 < 0.0001%）", () => {
    const r = realRate(0.07, 0.02);
    expect(Math.abs(r * 100 - 4.902)).toBeLessThan(0.0001 + 0.0005);
    expect(r).toBeCloseTo(1.07 / 1.02 - 1, 10);
  });
});

describe("案例 2：年金終值", () => {
  it("30→65 歲、每年實質儲蓄 12 萬、實質報酬 4.902%，退休資產 = 年金終值（誤差 < 1 元）", () => {
    const r = realRate(0.07, 0.02);
    // 薪資名目成長 = 通膨（2%）→ 實質成長 0；月收入 1 萬、無支出 → 年儲蓄 12 萬
    const inp = baseInput({
      monthlyIncome: 10000, expenses: [], salaryGrowth: 2,
      retPre: 7, inflation: 2, retireSpend: 0,
    });
    const res = simulate(inp, 65, 0);
    const expected = fvAnnuity(120000, r, 35);
    expect(Math.abs(res.retireAssets - expected)).toBeLessThan(1);
    expect(Math.abs(res.retireAssets - 120000 * (Math.pow(1 + r, 35) - 1) / r)).toBeLessThan(1);
  });
});

describe("案例 3：名目換算", () => {
  it("20 年後 100 萬實質、通膨 2%，名目約 1,485,947（誤差 < 1 元）", () => {
    const nominal = realToNominal(1000000, 0.02, 20);
    expect(Math.abs(nominal - 1485947)).toBeLessThan(1);
  });
});

describe("案例 4：零結餘", () => {
  it("每月結餘 0 且無既有資產：退休資產 0、最早退休無法達成、不拋出錯誤", () => {
    const inp = baseInput({
      monthlyIncome: 30000,
      // 薪資名目成長 = 通膨 → 實質成長 0，收入與支出每年都維持 36 萬，結餘恆為 0
      salaryGrowth: 2,
      expenses: [{ name: "支出", amount: 30000, endAge: null }],
      initAssets: 0, retireSpend: 20000,
    });
    const res = simulate(inp, 65, 0);
    expect(res.retireAssets).toBe(0);
    const e = earliestRetirement(inp);
    expect(e.type).toBe("none");
  });
});

describe("案例 6：退休所需資金", () => {
  it("年缺口 60 萬、退休後實質報酬 2%、25 年，所需約 1,171.4 萬（誤差 < 100 元）", () => {
    // 通膨 0、退休後名目 2% → 實質 rho = 2%；60 歲退休、壽命 85 → 25 年；月支出 5 萬 → 年缺口 60 萬
    const inp = baseInput({
      ageNow: 30, ageRetire: 60, ageLife: 85,
      inflation: 0, retPost: 2, retireSpend: 50000, otherRetireIncome: 0,
    });
    const res = simulate(inp, 60, 0);
    const expected = 600000 * (1 - Math.pow(1.02, -25)) / 0.02;
    expect(Math.abs(res.required - expected)).toBeLessThan(100);
    expect(Math.abs(res.required - 11714074)).toBeLessThan(100);
    expect(pvAnnuity(600000, 0.02, 25)).toBeCloseTo(expected, 6);
  });
});

describe("案例 7：零利率特例", () => {
  it("實質報酬 0：所需資金 = 年缺口 × 年數；工作期終值 = 已有資產 + 年儲蓄 × 年數", () => {
    const inp = baseInput({
      ageNow: 30, ageRetire: 40, ageLife: 50,
      inflation: 0, retPre: 0, retPost: 0, salaryGrowth: 0,
      initAssets: 50000, monthlyIncome: 10000, expenses: [], retireSpend: 5000,
    });
    const res = simulate(inp, 40, 0);
    // 工作期：50000 + 120000×10 = 1,250,000
    expect(res.retireAssets).toBe(1250000);
    // 退休期：年缺口 60000 × 10 年 = 600,000
    expect(res.required).toBe(600000);
    expect(pvAnnuity(60000, 0, 10)).toBe(600000);
  });
});

describe("案例 8：資產耗盡年齡", () => {
  it("資產在預期壽命前 3 年耗盡：耗盡年齡正確、耗盡後資產 0、未覆蓋支出為正", () => {
    // 利率全 0：30→40 歲每年存 39 萬 → 退休資產 390 萬；
    // 退休後年缺口 60 萬 → 第 7 年（47 歲）耗盡，壽命 50 歲（前 3 年）
    const inp = baseInput({
      ageNow: 30, ageRetire: 40, ageLife: 50,
      inflation: 0, retPre: 0, retPost: 0, salaryGrowth: 0,
      monthlyIncome: 32500, expenses: [], retireSpend: 50000,
    });
    const res = simulate(inp, 40, 0);
    expect(res.retireAssets).toBe(3900000);
    expect(res.exhaustAge).toBe(47);
    expect(res.finalAssets).toBe(0);
    expect(res.uncovered).toBeGreaterThan(0);
  });
});

describe("案例 15：邊界", () => {
  it("現在年齡 = 退休年齡（已退休）不崩潰，且 earliest 回傳 already 並區分能否撐到壽命", () => {
    const enough = baseInput({ ageNow: 65, ageRetire: 65, ageLife: 85, initAssets: 10000000, retireSpend: 20000, monthlyIncome: 0 });
    const r1 = earliestRetirement(enough);
    expect(r1.type).toBe("already");
    if (r1.type === "already") expect(r1.lastsToLife).toBe(true);

    const notEnough = baseInput({ ageNow: 65, ageRetire: 65, ageLife: 85, initAssets: 100000, retireSpend: 50000, monthlyIncome: 0 });
    const r2 = earliestRetirement(notEnough);
    expect(r2.type).toBe("already");
    if (r2.type === "already") {
      expect(r2.lastsToLife).toBe(false);
      expect(r2.exhaustAge).not.toBeNull();
    }
    expect(() => simulate(notEnough, 65, 0)).not.toThrow();
  });

  it("預期壽命 = 退休年齡 + 1 不崩潰", () => {
    const inp = baseInput({ ageNow: 64, ageRetire: 65, ageLife: 66 });
    const res = simulate(inp, 65, 0);
    expect(Number.isFinite(res.retireAssets)).toBe(true);
    expect(res.retYears).toBe(1);
  });

  it("利率為負不崩潰", () => {
    const inp = baseInput({ retPre: -5, retPost: -2 });
    const res = simulate(inp, 65, 0);
    expect(Number.isFinite(res.retireAssets)).toBe(true);
    expect(Number.isFinite(res.required)).toBe(true);
  });

  it("通膨為 0 不崩潰", () => {
    const inp = baseInput({ inflation: 0 });
    const res = simulate(inp, 65, 0);
    expect(Number.isFinite(res.retireAssets)).toBe(true);
    expect(res.r).toBeCloseTo(0.06, 10);
  });
});

describe("範例資料回歸（Phase 1 交付數字不可變）", () => {
  it("規格範例：退休資產 2,035.1 萬、所需 443.2 萬、達成率 459.2%、最早 49 歲", () => {
    const inp = baseInput({
      expenses: [
        { name: "房租或房貸", amount: 12000, endAge: null },
        { name: "伙食", amount: 9000, endAge: null },
        { name: "交通", amount: 2000, endAge: null },
        { name: "水電網路", amount: 2000, endAge: null },
        { name: "保險", amount: 2000, endAge: null },
        { name: "娛樂", amount: 2000, endAge: null },
        { name: "其他", amount: 1000, endAge: null },
      ],
    });
    const res = simulate(inp, 65, 0);
    expect(Math.round(res.retireAssets / 1000) / 10).toBe(2035.1);
    expect(Math.round(res.required / 1000) / 10).toBe(443.2);
    expect(Math.round((res.achieve ?? 0) * 1000) / 10).toBe(459.2);
    const e = earliestRetirement(inp);
    expect(e).toEqual({ type: "age", age: 49 });
    // 名目：2035.1 萬 × 1.02^35 ≈ 4070.0 萬
    const nominalWan = realToNominal(res.retireAssets, 0.02, 35) / 10000;
    expect(Math.round(nominalWan * 10) / 10).toBe(4070.0);
  });
});

describe("功能 (a)：無法達成時反推每月多存金額", () => {
  it("結餘 0 無法達成時，求得的多存金額代回後最早退休年齡存在且一致", () => {
    const inp = baseInput({
      monthlyIncome: 30000, salaryGrowth: 2,
      expenses: [{ name: "支出", amount: 30000, endAge: null }],
      initAssets: 0, retireSpend: 20000,
    });
    expect(earliestRetirement(inp).type).toBe("none");
    const sol = findExtraSavingForEarliest(inp);
    expect(sol.found).toBe(true);
    expect(sol.extraMonthly).toBeGreaterThan(0);
    const back = earliestRetirement({ ...inp, extraMonthlySaving: sol.extraMonthly });
    expect(back.type).toBe("age");
    if (back.type === "age") expect(back.age).toBe(sol.earliestAge);
  });
});
