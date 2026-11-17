// ============================================================
// Panda Finance｜設定檔（規格第 1.3 節）
// 所有預設值集中於此，UI 與 core 不得寫死任何數字。
// 每個參數包含：id、label、value、unit、min、max、source、updatedAt、note。
// Phase 3.2（2026-11-17）起 source 依性質標示：範例值／假設值（附參考依據）／
// 系統設定／設計門檻；制度參數（勞保勞退）見 config/social.ts，已依官方來源查證。
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

const SRC_EXAMPLE = "範例值（使用者應改成自己的數字）";
const SRC_ASSUME = "假設值（非預測），使用者應依自身情況調整。";
const SRC_SYSTEM = "系統設定（演算法參數，非官方數值）";
const SRC_DESIGN = "設計門檻（提醒用，非官方數值）";
const SRC_CPI = "假設值。參考：主計總處 CPI 年增率 113年 2.18%（https://www.dgbas.gov.tw/News_Content.aspx?n=3602&s=234403 ）、114年 1.66%（https://www.stat.gov.tw/News_Content.aspx?n=3703&s=235723 ）、115年1–10月平均 1.98%（https://www.stat.gov.tw/News_Content.aspx?n=3703&s=236836 ）；中央銀行〈本行貨幣政策相關議題之說明：2%通膨率是國際間主要央行的通膨警戒線？〉（2024-06-12）https://knowledge.cbc.gov.tw/front/references/inpage/76367BD1-3029-EF11-9108-00505694F3B3 ，表示通膨率中長期平均 2% 左右可以接受。";
const SRC_CPI_SCENARIO = "假設值（情境設定）。近三年 CPI 都在 2.2% 以下，央行中長期約 2%；保守情境取 2.5%，多抓 0.5 個百分點的緩衝。";
const SRC_LIFE = "使用者輸入，預設為假設值。參考：內政部 114年簡易生命表，國人平均壽命 81.27 歲（男 77.93、女 84.75）https://www.moi.gov.tw/News_Content.aspx?n=4&s=340439 。預設 85 歲比平均壽命長，是為了反映長壽風險。";
const UPDATED = "2026-11-17";

function p(
  id: string,
  label: string,
  value: number,
  unit: string,
  min: number,
  max: number,
  note: string,
  source: string = SRC_ASSUME
): ParamDef {
  return { id, label, value, unit, min, max, source, updatedAt: UPDATED, note };
}

export const PARAMS: ParamDef[] = [
  p("ageNow", "現在年齡", 30, "歲", 18, 80, "規格第 7.1 節：現在年齡合理範圍 18 至 80 歲。", SRC_EXAMPLE),
  p("ageRetire", "預計退休年齡", 65, "歲", 18, 100, "須大於現在年齡；等於現在年齡時視為已退休（第 7.1 節）。", SRC_EXAMPLE),
  p("ageLife", "預期壽命", 85, "歲", 19, 110, "規格第 7.1 節：預期壽命上限 110 歲，須大於退休年齡。", SRC_LIFE),
  p("initAssets", "目前已有可投資資產", 0, "元", 0, 1_000_000_000, "現在時點（t=0）的資產，今日幣值。", SRC_EXAMPLE),
  p("otherRetireIncome", "其他退休收入（勞保、勞退以外）", 0, "元/月", 0, 100_000_000, "退休後每個月固定會有的其他收入，例如：房租淨收入、年金險或儲蓄險每月給付、退休後兼職、公教或軍職退休金。大部分上班族填 0 即可；不確定就填 0，結果會偏保守。勞保、勞退請在步驟 ③ 上方設定，不要重複填。", SRC_EXAMPLE),
  p("monthlyIncome", "月收入（稅後實領）", 50000, "元/月", 0, 100_000_000, "範例資料的月收入；使用者應改成自己的數字。", SRC_EXAMPLE),
  p("salaryGrowth", "預期薪資年成長率（名目）", 2.5, "%/年", -50, 100, "名目成長率，計算時以 (1+成長率)/(1+通膨率)-1 換算為實質成長率（第 3.2 節）。"),
  p("startWorkAge", "開始全職工作的年齡", 30, "歲", 15, 80, "範例：30 歲剛開始工作，所以已有勞保年資 0 年。只用於步驟 ③ 的『幫我估』。", "範例值（使用者應改成自己的數字）"),
  p("inflation", "通膨率", 2, "%/年", -10, 50, "全站核心假設。所有實質換算皆以此為準（第 3.2、3.3 節）。低於 -2% 或高於 15% 時介面提示極端值。", SRC_CPI),
  p("retPre", "退休前投資每年報酬率（假設值，含通膨）", 6.5, "%/年", -50, 100, "定義：大盤型 ETF 為主、搭配少量債券（約股 8：債 2）的組合：0.8×7 + 0.2×4.5 = 6.5（Phase 4 推算邏輯）。假設值，非預測。高於 30% 或低於 -10% 時介面提示極端值。"),
  p("retPost", "退休後投資每年報酬率（假設值，含通膨）", 4.5, "%/年", -50, 100, "退休後降低股票比重：6.5 − 退休後保守折減 2 = 4.5，和標的模式的折減規則一致。原則上低於或等於退休前；設得更高時介面提示。"),
  p("retireSpendRatio", "退休後月支出預設比例", 75, "%", 0, 200, "退休後月支出預設為目前每月支出總額的此比例（第 4.2 節）；使用者手動修改後不再自動連動。"),
  p("earliestRetirementCap", "最早可退休年齡試算上限", 75, "歲", 60, 100, "第 3.7 節：逐歲試算至此年齡為止。", SRC_SYSTEM),
  p("exhaustTolerance", "資產耗盡判定容許誤差", 0.5, "元", 0, 100, "第 3.9 節：比較是否撐到預期壽命時容許的浮點誤差。", SRC_SYSTEM),
  p("debounceMs", "輸入重算延遲", 200, "毫秒", 150, 250, "第 2.3 節：輸入欄位使用 150 至 250 毫秒 debounce。", SRC_SYSTEM),
  p("solverMaxIterations", "反推搜尋最大迭代次數", 60, "次", 1, 200, "第 7.3 節：二分搜尋最多迭代次數，超過回傳無法收斂。", SRC_SYSTEM),
  p("solverMaxExtraMultiple", "額外儲蓄搜尋上限倍數", 2, "倍（月收入）", 1, 10, "功能 (a)：搜尋每月多存金額時，上限先設月收入，不足時擴大到此倍數。", SRC_SYSTEM),
];

export const PARAM_MAP: Record<string, ParamDef> = Object.fromEntries(
  PARAMS.map((d) => [d.id, d])
);

/** 取得參數預設值（UI 與 core 唯一數字來源） */
export function paramDef(id: string): ParamDef {
  const found = PARAMS.find((x) => x.id === id);
  if (!found) throw new Error(`unknown param: ${id}`);
  return found;
}

export function paramValue(id: string): number {
  const d = PARAM_MAP[id];
  if (!d) throw new Error(`Unknown param: ${id}`);
  return d.value;
}


// ---- Phase 2 新增參數 ----
PARAMS.push(
  p("fxChange", "新台幣對美元年變動率", 0, "%/年", -20, 20, "正值代表新台幣升值（美元資產換回新台幣的報酬變差），負值代表新台幣貶值（第 5.3 節）。只套用到美元計價標的，且只套用一次。Vanguard 預期美元中期小幅貶值（見 https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/vemo-return-forecasts.html ）；新台幣升值時美元資產換回新台幣的報酬較低，可自行輸入正值測試。"),
  p("retireReturnDeduction", "退休後報酬保守折減", 2, "百分點", 0, 10, "退休後組合由股 8 債 2 調整為較保守配置的近似；6.5 − 2 = 4.5 與 retPost 一致。標的模式下，退休後配置為「與退休前相同」時，退休後組合報酬率 = 退休前組合報酬率 − 此折減，下限為同情境定存報酬率（第 5.5 節）。標的關閉時不套用。"),
  p("scenarioInflationConservative", "保守情境通膨率", 2.5, "%/年", -10, 50, "三種情境之一（第 5.5 節），Phase 4 起固定。", SRC_CPI_SCENARIO),
  p("scenarioInflationNeutral", "中性情境通膨率", 2, "%/年", -10, 50, "三種情境之一（第 5.5 節），Phase 4 起與主通膨同為固定 2%。", SRC_CPI),
  p("scenarioInflationOptimistic", "樂觀情境通膨率", 1.5, "%/年", -10, 50, "三種情境之一（第 5.5 節），Phase 4 起固定。", SRC_CPI_SCENARIO),
  p("concentrationWarnPct", "產業集中型 ETF 集中提醒門檻（QQQ）", 30, "%", 0, 100, "QQQ 屬於產業集中型 ETF，配置比例高時波動會明顯放大。配置超過此比例時顯示集中風險提醒（第 5.4 節）。", SRC_DESIGN),
  p("concentrationStrongPct", "產業集中型 ETF 強提醒門檻（QQQ）", 50, "%", 0, 100, "QQQ 屬於產業集中型 ETF，配置比例高時波動會明顯放大。配置超過此比例時顯示更明確的提醒，但不阻止使用（第 5.4 節）。", SRC_DESIGN)
);
PARAMS.push(
  p("goalCompareYears", "標的比較年數", 20, "年", 1, 40, "圖表比較（第 6.6 節）：每月結餘投入單一標的比較的年數，預設 20 年、可調 1 至 40 年。", SRC_SYSTEM),
  p("goalToleranceRatio", "反推容許誤差比例", 0.1, "%", 0, 10, "目標反推（第 6.5 節）：最後剩餘資產與 0 的差距需小於退休所需資金的此比例。", SRC_SYSTEM),
  p("dcaCompareYears", "定期定額比較年限", 30, "年", 1, 50, "常見 ETF 定期定額比較（Phase 4 第七節）的預設年限，使用者可調 1 至 50 年。", SRC_SYSTEM)
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
