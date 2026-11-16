// ============================================================
// Panda Finance｜設定檔（規格第 1.3 節）
// 所有預設值集中於此，UI 與 core 不得寫死任何數字。
// 每個參數包含：id、label、value、unit、min、max、
// source（一律「待查證」）、updatedAt（一律「待填」）、note。
// ============================================================

export interface ParamDef {
  id: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  source: string;
  updatedAt: string;
  note: string;
}

function p(
  id: string,
  label: string,
  value: number,
  unit: string,
  min: number,
  max: number,
  note: string
): ParamDef {
  return { id, label, value, unit, min, max, source: "待查證", updatedAt: "待填", note };
}

export const PARAMS: ParamDef[] = [
  p("ageNow", "現在年齡", 30, "歲", 18, 80, "規格第 7.1 節：現在年齡合理範圍 18 至 80 歲。"),
  p("ageRetire", "預計退休年齡", 65, "歲", 18, 100, "須大於現在年齡；等於現在年齡時視為已退休（第 7.1 節）。"),
  p("ageLife", "預期壽命", 85, "歲", 19, 110, "規格第 7.1 節：預期壽命上限 110 歲，須大於退休年齡。"),
  p("initAssets", "目前已有可投資資產", 0, "元", 0, 1_000_000_000, "現在時點（t=0）的資產，今日幣值。"),
  p("otherRetireIncome", "其他退休收入", 0, "元/月", 0, 100_000_000, "退休期間每月的其他收入（今日幣值），選填。Phase 1 不含勞保、勞退（Phase 3）。"),
  p("monthlyIncome", "月收入（稅後實領）", 50000, "元/月", 0, 100_000_000, "範例資料的月收入；使用者應改成自己的數字。"),
  p("salaryGrowth", "預期薪資年成長率（名目）", 2.5, "%/年", -50, 100, "名目成長率，計算時以 (1+成長率)/(1+通膨率)-1 換算為實質成長率（第 3.2 節）。"),
  p("inflation", "通膨率", 2, "%/年", -10, 50, "全站核心假設。所有實質換算皆以此為準（第 3.2、3.3 節）。低於 -2% 或高於 15% 時介面提示極端值。"),
  p("retPre", "投資年化報酬率（名目）", 6, "%/年", -50, 100, "Phase 1 單一報酬率假設，非預測。高於 30% 或低於 -10% 時介面提示極端值。"),
  p("retPost", "退休後年化報酬率（名目）", 4, "%/年", -50, 100, "退休期間的報酬率假設，原則上低於或等於退休前；設得更高時介面提示。"),
  p("retireSpendRatio", "退休後月支出預設比例", 75, "%", 0, 200, "退休後月支出預設為目前每月支出總額的此比例（第 4.2 節）；使用者手動修改後不再自動連動。"),
  p("earliestRetirementCap", "最早可退休年齡試算上限", 75, "歲", 60, 100, "第 3.7 節：逐歲試算至此年齡為止。"),
  p("exhaustTolerance", "資產耗盡判定容許誤差", 0.5, "元", 0, 100, "第 3.9 節：比較是否撐到預期壽命時容許的浮點誤差。"),
  p("debounceMs", "輸入重算延遲", 200, "毫秒", 150, 250, "第 2.3 節：輸入欄位使用 150 至 250 毫秒 debounce。"),
  p("solverMaxIterations", "反推搜尋最大迭代次數", 60, "次", 1, 200, "第 7.3 節：二分搜尋最多迭代次數，超過回傳無法收斂。"),
  p("solverMaxExtraMultiple", "額外儲蓄搜尋上限倍數", 2, "倍（月收入）", 1, 10, "功能 (a)：搜尋每月多存金額時，上限先設月收入，不足時擴大到此倍數。"),
];

export const PARAM_MAP: Record<string, ParamDef> = Object.fromEntries(
  PARAMS.map((d) => [d.id, d])
);

/** 取得參數預設值（UI 與 core 唯一數字來源） */
export function paramValue(id: string): number {
  const d = PARAM_MAP[id];
  if (!d) throw new Error(`Unknown param: ${id}`);
  return d.value;
}


// ---- Phase 2 新增參數 ----
PARAMS.push(
  p("fxChange", "新台幣對美元年變動率", 0, "%/年", -20, 20, "正值代表新台幣升值（美元資產換回新台幣的報酬變差），負值代表新台幣貶值（第 5.3 節）。只套用到美元計價標的，且只套用一次。"),
  p("retireReturnDeduction", "退休後報酬保守折減", 2, "百分點", 0, 10, "標的模式下，退休後配置為「與退休前相同」時，退休後組合報酬率 = 退休前組合報酬率 − 此折減，下限為同情境定存報酬率（第 5.5 節）。標的關閉時不套用。"),
  p("scenarioInflationConservative", "保守情境通膨率", 3, "%/年", -10, 50, "三種情境之一（第 5.5 節），使用者可個別覆寫。"),
  p("scenarioInflationNeutral", "中性情境通膨率", 2, "%/年", -10, 50, "三種情境之一（第 5.5 節），使用者可個別覆寫。"),
  p("scenarioInflationOptimistic", "樂觀情境通膨率", 1.5, "%/年", -10, 50, "三種情境之一（第 5.5 節），使用者可個別覆寫。"),
  p("categoryInflationMedicalSuggested", "醫療與保險類別通膨建議值", 4, "%/年", -10, 50, "分類通膨的預設提示：醫療與保險在高齡期通膨較高，此為建議套用值（第 5.6 節），非規定。"),
  p("concentrationWarnPct", "單一標的集中提醒門檻（台積電）", 30, "%", 0, 100, "台積電配置超過此比例時顯示集中風險提醒（第 5.4 節）。"),
  p("concentrationStrongPct", "單一個股強提醒門檻", 50, "%", 0, 100, "單一個股（台積電）配置超過此比例時顯示更明確的提醒，但不阻止使用（第 5.4 節）。")
);
PARAMS.push(
  p("goalCompareYears", "標的比較年數", 20, "年", 1, 40, "圖表比較（第 6.6 節）：每月結餘投入單一標的比較的年數，預設 20 年、可調 1 至 40 年。"),
  p("goalToleranceRatio", "反推容許誤差比例", 0.1, "%", 0, 10, "目標反推（第 6.5 節）：最後剩餘資產與 0 的差距需小於退休所需資金的此比例。")
);
// PARAM_MAP 需在 push 後重建
for (const d of PARAMS) PARAM_MAP[d.id] = d;

/** 範例支出項目（第 8.3 節範例資料：合計 30,000 元/月） */
export interface ExpenseDefault {
  name: string;
  amount: number;
}

export const EXAMPLE_EXPENSES: ExpenseDefault[] = [
  { name: "房租或房貸", amount: 12000 },
  { name: "伙食", amount: 9000 },
  { name: "交通", amount: 2000 },
  { name: "水電網路", amount: 2000 },
  { name: "保險", amount: 2000 },
  { name: "娛樂", amount: 2000 },
  { name: "其他", amount: 1000 },
];

/** 還原預設值按鈕要還原的假設參數 id 清單 */
export const ASSUMPTION_PARAM_IDS = ["inflation", "retPre", "retPost", "salaryGrowth"] as const;
