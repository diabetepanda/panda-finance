// ============================================================
// 標的清單（規格第 5.1 節）｜Phase 2 建立，Phase 4 重訂（2026-11-17）
// 只列 ETF、債券、定存／現金，不列任何個股。
// 報酬率為「假設值，非預測」，依 Phase 4 推算邏輯推得（見 PARAMETERS.md）：
// 全站通膨固定 2%；股票類名目報酬 ≈ 長期實質報酬假設 + 2% 通膨，
// 中性值取「機構前瞻預估」與「長期歷史」之間、偏保守的位置。
// 固定順序（不依報酬排序）：0050、VOO、0056、00878、00919、QQQ、美國公債、定存／現金。
// 計價幣別：台股 ETF、定存為 TWD；VOO、QQQ、美國公債為 USD（匯率只套一次）。
// ============================================================

import type { ParamDef } from "./defaults";

export type ScenarioId = "conservative" | "neutral" | "optimistic";
export const SCENARIO_IDS: ScenarioId[] = ["conservative", "neutral", "optimistic"];
export const SCENARIO_LABELS: Record<ScenarioId, string> = {
  conservative: "保守",
  neutral: "中性",
  optimistic: "樂觀",
};

const UPDATED = "2026-11-17";
const HIST_TW = "MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47";
const FWD = "J.P. Morgan 2026 Long-Term Capital Market Assumptions https://am.jpmorgan.com/us/en/asset-management/institutional/about-us/media/press-releases/jp-morgan-releases-2026-long-term-capital-market-assumptions/ ；Vanguard Capital Markets Model https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/vemo-return-forecasts.html";

function rp(id: string, label: string, value: number, source: string): ParamDef {
  return { id, label, value, unit: "%/年", min: -50, max: 100, source, updatedAt: UPDATED, note: "假設值，非預測。" };
}

export interface AssetDef {
  id: string;
  label: string;
  assetClass: string;
  category: string; // 台股大盤／台股高股息／美股大盤／美股科技（產業集中）／債券／現金
  currency: "TWD" | "USD";
  dividendReinvested: boolean;
  riskNote: string;
  returns: Record<ScenarioId, ParamDef>;
  inceptionDate: string | null; // 成立日
  expenseRatioPct: number | null; // 2025 年度總費用率 %
  expenseSource: string;
  histAnnualPct: number | null; // 成立以來實際含息年化 %（參考）
  histAsOf: string | null;
  histYears: number | null; // 成立年數（整數）
  histSource: string;
  histExtra: string | null; // 指數層級的補充參考
  histNote: string | null; // 設定時，ETF 比較表的歷史欄改顯示這句（用於非 ETF 的長期歷史資料）
}

interface AssetSpec {
  id: string; label: string; assetClass: string; category: string; currency: "TWD" | "USD";
  dividendReinvested: boolean; riskNote: string;
  cons: number; neu: number; opt: number; returnSource: string;
  inceptionDate: string | null; expenseRatioPct: number | null; expenseSource: string;
  histAnnualPct: number | null; histAsOf: string | null; histYears: number | null; histSource: string; histExtra: string | null; histNote?: string | null;
}

function asset(s: AssetSpec): AssetDef {
  const mk = (sc: ScenarioId, label: string, v: number) => rp(`${s.id}.${sc}`, `${s.label} ${label}報酬率（假設值，非預測）`, v, s.returnSource);
  return {
    id: s.id, label: s.label, assetClass: s.assetClass, category: s.category, currency: s.currency,
    dividendReinvested: s.dividendReinvested, riskNote: s.riskNote,
    returns: { conservative: mk("conservative", "保守", s.cons), neutral: mk("neutral", "中性", s.neu), optimistic: mk("optimistic", "樂觀", s.opt) },
    inceptionDate: s.inceptionDate, expenseRatioPct: s.expenseRatioPct, expenseSource: s.expenseSource,
    histAnnualPct: s.histAnnualPct, histAsOf: s.histAsOf, histYears: s.histYears, histSource: s.histSource, histExtra: s.histExtra, histNote: s.histNote ?? null,
  };
}

const FEE_TW = (code: string) => `MoneyDJ ETF 基本資料「總管理費用」欄（2025 年度）https://www.moneydj.com/etf/x/basic/basic0004.xdjhtm?etfid=${code}.tw`;

export const ASSETS: AssetDef[] = [
  asset({
    id: "tw0050", label: "0050", assetClass: "台股大盤 ETF", category: "台股大盤", currency: "TWD", dividendReinvested: true,
    riskNote: "成分股集中在少數大型權值股與半導體產業，單一市場風險無法靠成分股數量分散。",
    cons: 4, neu: 7, opt: 10,
    returnSource: `假設值（非預測），依 Phase 4 推算邏輯：前瞻預估中，新興市場股票 J.P. Morgan 7.8%、Vanguard 3.7–5.7%；0050 成立以來 14.07% 主要來自少數權值股大漲，不外推。中性 7 與美股大盤相同，區間比 VOO 寬，反映單一市場和成分股集中風險。${FWD}；${HIST_TW}`,
    inceptionDate: "2003-06-25", expenseRatioPct: 0.22, expenseSource: FEE_TW("0050"),
    histAnnualPct: 14.07, histAsOf: "2026-11-16", histYears: 23, histSource: HIST_TW,
    histExtra: "同指數的 006208 試算結果相同",
  }),
  asset({
    id: "voo", label: "VOO", assetClass: "美股大盤 ETF", category: "美股大盤", currency: "USD", dividendReinvested: true,
    riskNote: "美元資產，有匯率風險。",
    cons: 4.5, neu: 7, opt: 9,
    returnSource: `假設值（非預測），依 Phase 4 推算邏輯：前瞻 J.P. Morgan 美國大型股 6.7%、Vanguard 美國股票 4.8%–6.8%；長期歷史 S&P 500 含息 1928–2025 年化約 10.0%（實質約 7%，換成 2% 通膨約 9%）。中性 7 落在兩者之間、偏前瞻；保守 4.5 接近 Vanguard 下緣；樂觀 9 等於長期歷史實質報酬加 2% 通膨。${FWD}；Damodaran Historical Returns https://pages.stern.nyu.edu/adamodar/New_Home_Page/datafile/histretSP.html`,
    inceptionDate: "2010-09-07", expenseRatioPct: 0.03, expenseSource: "Vanguard VOO fact sheet https://workplace.vanguard.com/assets/corp/fund_communications/pdf_publish/us-products/fact-sheet/F0968.pdf",
    histAnnualPct: 14.94, histAsOf: "2026-09-30", histYears: 16, histSource: "Vanguard VOO fact sheet（成立以來 NAV 年化，截至 2026-09-30）https://workplace.vanguard.com/assets/corp/fund_communications/pdf_publish/us-products/fact-sheet/F0968.pdf",
    histExtra: "追蹤的 S&P 500 指數 1928–2025 年化約 10.0%",
  }),
  asset({
    id: "tw0056", label: "0056", assetClass: "台股高股息 ETF", category: "台股高股息", currency: "TWD", dividendReinvested: true,
    riskNote: "高股息型成長性通常低於大盤，費用率較高；配息要計入綜合所得並可能被扣二代健保補充保費，本工具沒有計算稅負。",
    cons: 3.5, neu: 6, opt: 8.5,
    returnSource: `假設值（非預測），依 Phase 4 推算邏輯：中性不高於同市場大盤型 0050；2025 年總費用率 0.57%，高於 0050 的 0.22%；成立以來 10.21% 也低於 0050 同期。${HIST_TW}`,
    inceptionDate: "2007-12-13", expenseRatioPct: 0.57, expenseSource: FEE_TW("0056"),
    histAnnualPct: 10.21, histAsOf: "2026-11-16", histYears: 19, histSource: HIST_TW, histExtra: null,
  }),
  asset({
    id: "tw00878", label: "00878", assetClass: "台股高股息 ETF", category: "台股高股息", currency: "TWD", dividendReinvested: true,
    riskNote: "高股息型成長性通常低於大盤，費用率較高；配息要計入綜合所得並可能被扣二代健保補充保費，本工具沒有計算稅負。",
    cons: 3.5, neu: 6, opt: 8.5,
    returnSource: `假設值（非預測），依 Phase 4 推算邏輯：同 0056；成立僅約 6 年，歷史 20.64% 不外推。${HIST_TW}`,
    inceptionDate: "2020-07-10", expenseRatioPct: 0.53, expenseSource: FEE_TW("00878"),
    histAnnualPct: 20.64, histAsOf: "2026-11-16", histYears: 6, histSource: HIST_TW, histExtra: null,
  }),
  asset({
    id: "tw00919", label: "00919", assetClass: "台股高股息 ETF", category: "台股高股息", currency: "TWD", dividendReinvested: true,
    riskNote: "高股息型成長性通常低於大盤，費用率較高；配息要計入綜合所得並可能被扣二代健保補充保費，本工具沒有計算稅負。",
    cons: 3, neu: 6, opt: 8.5,
    returnSource: `假設值（非預測），依 Phase 4 推算邏輯：同 0056；成立僅約 4 年、總費用率 0.69%，保守值再低一點。${HIST_TW}`,
    inceptionDate: "2022-10-13", expenseRatioPct: 0.69, expenseSource: FEE_TW("00919"),
    histAnnualPct: 31.15, histAsOf: "2026-11-16", histYears: 4, histSource: HIST_TW, histExtra: null,
  }),
  asset({
    id: "qqq", label: "QQQ", assetClass: "美股科技 ETF", category: "美股科技（產業集中）", currency: "USD", dividendReinvested: true,
    riskNote: "產業集中在科技股，波動大，風險較高，不適合作為定期定額的核心；美元資產，有匯率風險。",
    cons: 3, neu: 7.5, opt: 11,
    returnSource: `假設值（非預測），依 Phase 4 推算邏輯：產業集中型，中性只比大盤略高 0.5 個百分點。成立以來 10.88% 包含 2000 年科技泡沫，期間最大跌幅約八成，所以保守值放低、區間放寬。Invesco QQQ 官網 https://www.invesco.com/qqq-etf/en/home.html`,
    inceptionDate: "1999-03-10", expenseRatioPct: 0.18, expenseSource: "Invesco QQQ 官網 https://www.invesco.com/qqq-etf/en/home.html",
    histAnnualPct: 10.88, histAsOf: "2026-09-30", histYears: 28, histSource: "Invesco QQQ 官網 fact sheet（成立以來 NAV 年化，截至 2026-09-30）https://www.invesco.com/qqq-etf/en/home.html",
    histExtra: "追蹤的 Nasdaq-100 指數 1999 年起約 11.11%",
  }),
  asset({
    id: "usbond", label: "美國公債", assetClass: "債券", category: "債券", currency: "USD", dividendReinvested: false,
    riskNote: "美元資產，有匯率與利率風險。",
    cons: 3, neu: 4.5, opt: 5,
    returnSource: `假設值（非預測），依 Phase 4 推算邏輯：目前美國 10 年期公債殖利率 5.12%（2026-11-16，美國財政部 https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all/202611?_format=csv&field_tdr_date_value_month=202611&page=&type=daily_treasury_yield_curve ），J.P. Morgan 美國中期公債 4.0%；取中間略保守。${FWD}`,
    inceptionDate: null, expenseRatioPct: null, expenseSource: "",
    histAnnualPct: 4.5, histAsOf: "1928–2025", histYears: 98, histSource: "Damodaran Historical Returns（美國 10 年期公債 1928–2025 年化約 4.5%）https://pages.stern.nyu.edu/adamodar/New_Home_Page/datafile/histretSP.html", histExtra: null,
    histNote: "長期歷史約 4.5%（美國 10 年期公債 1928–2025，Damodaran 資料，僅供參考）",
  }),
  asset({
    id: "cash", label: "定存 / 現金", assetClass: "現金（對照基準）", category: "現金", currency: "TWD", dividendReinvested: false,
    riskNote: "作為對照基準。歷史報酬不代表未來，這裡的數字是假設。",
    cons: 1.2, neu: 1.7, opt: 2,
    returnSource: "假設值（非預測），依 Phase 4 推算邏輯：中性等於二年期定存利率 1.7108%（取 1.7）。參考：勞動部勞動基金運用局 115 年 11 月公告 https://www.blf.gov.tw/49200/49255/49261/49269/49277/73025/",
    inceptionDate: null, expenseRatioPct: null, expenseSource: "",
    histAnnualPct: null, histAsOf: null, histYears: null, histSource: "", histExtra: null,
  }),
];

export const ASSET_MAP: Record<string, AssetDef> = Object.fromEntries(ASSETS.map((a) => [a.id, a]));
export const CASH_ASSET_ID = "cash";
/** 產業集中型 ETF（集中度提醒對象） */
export const CONCENTRATED_ASSET_ID = "qqq";

/** 快速配置（固定順序）：大盤各半（預設）→ 股債 80/20 → 全部定存 → 單一標的 100%（照標的清單順序） */
export const ALLOCATION_PRESETS: { id: string; label: string; alloc: Record<string, number> }[] = [
  { id: "tw-us-half", label: "台股美股大盤各半（0050 50%、VOO 50%）", alloc: { tw0050: 50, voo: 50 } },
  { id: "stock-bond-80-20", label: "股債 80/20（0050 40%、VOO 40%、美國公債 20%）", alloc: { tw0050: 40, voo: 40, usbond: 20 } },
  { id: "all-cash", label: "全部定存 / 現金", alloc: { cash: 100 } },
  ...ASSETS.map((a) => ({
    id: `single-${a.id}`,
    label: a.id === "qqq" ? `${a.label} 100%（風險較高）` : `${a.label} 100%`,
    alloc: { [a.id]: 100 },
  })),
];
