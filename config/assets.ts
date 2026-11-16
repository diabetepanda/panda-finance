// ============================================================
// 標的清單（規格第 5.1 節）｜Phase 2
// 每個標的：顯示名稱、資產類別、計價幣別、配息再投入簡化、
// 三組名目年化報酬率（保守/中性/樂觀，皆為 ParamDef）、風險提示。
// 報酬率一律標示為「假設值，非預測」，source 一律「待查證」。
// 計價幣別：0050、0056、台積電、定存為 TWD；VOO、QQQ、美國公債為 USD。
// 匯率調整只對 USD 計價標的做一次（第 5.3 節）。
// ============================================================

import type { ParamDef } from "./defaults";

export type ScenarioId = "conservative" | "neutral" | "optimistic";
export const SCENARIO_IDS: ScenarioId[] = ["conservative", "neutral", "optimistic"];
export const SCENARIO_LABELS: Record<ScenarioId, string> = {
  conservative: "保守",
  neutral: "中性",
  optimistic: "樂觀",
};

function rp(id: string, label: string, value: number, note: string): ParamDef {
  return { id, label, value, unit: "%/年", min: -50, max: 100, source: "待查證", updatedAt: "待填", note };
}

export interface AssetDef {
  id: string;
  label: string;
  assetClass: string;
  currency: "TWD" | "USD";
  dividendReinvested: boolean; // 是否以含息總報酬、配息再投入簡化
  riskNote: string;
  returns: Record<ScenarioId, ParamDef>;
}

function asset(
  id: string, label: string, assetClass: string, currency: "TWD" | "USD",
  dividendReinvested: boolean, riskNote: string,
  cons: number, neu: number, opt: number
): AssetDef {
  return {
    id, label, assetClass, currency, dividendReinvested, riskNote,
    returns: {
      conservative: rp(`${id}.conservative`, `${label} 保守報酬率（假設值，非預測）`, cons, "暫定假設值，待查證。"),
      neutral: rp(`${id}.neutral`, `${label} 中性報酬率（假設值，非預測）`, neu, "暫定假設值，待查證。"),
      optimistic: rp(`${id}.optimistic`, `${label} 樂觀報酬率（假設值，非預測）`, opt, "暫定假設值，待查證。"),
    },
  };
}

export const ASSETS: AssetDef[] = [
  asset("voo", "VOO", "美股大盤 ETF", "USD", true,
    "美元資產，有匯率風險。歷史報酬不代表未來，這裡的數字是假設。", 5, 7, 9),
  asset("qqq", "QQQ", "美股科技 ETF", "USD", true,
    "美元資產，有匯率風險。波動較大，報酬率區間設得較寬，結果以區間呈現。歷史報酬不代表未來，這裡的數字是假設。", 6, 9, 11),
  asset("tw0050", "0050", "台股大盤 ETF", "TWD", true,
    "以含息總報酬、配息全數再投入簡化，不計稅費，實際配息與稅務會影響結果。歷史報酬不代表未來，這裡的數字是假設。", 5, 7, 9),
  asset("tw0056", "0056", "台股高股息 ETF", "TWD", true,
    "以含息總報酬、配息全數再投入簡化，不計稅費，實際配息與稅務會影響結果。歷史報酬不代表未來，這裡的數字是假設。", 4, 6, 8),
  asset("usbond", "美國公債", "債券", "USD", false,
    "美元資產，有匯率風險。報酬與利率走勢有關，期間與存續期不同風險不同，這裡僅以單一報酬率簡化。歷史報酬不代表未來，這裡的數字是假設。", 2.5, 4, 5),
  asset("tsmc", "台積電（2330）", "單一個股", "TWD", true,
    "單一個股，風險遠高於 ETF。波動較大，報酬率區間設得較寬，結果以區間呈現。歷史報酬不代表未來，這裡的數字是假設。", 4, 9, 14),
  asset("cash", "定存 / 現金", "現金（對照基準）", "TWD", false,
    "作為對照基準。歷史報酬不代表未來，這裡的數字是假設。", 1, 1.5, 2),
];

export const ASSET_MAP: Record<string, AssetDef> = Object.fromEntries(ASSETS.map((a) => [a.id, a]));
export const CASH_ASSET_ID = "cash";
export const SINGLE_STOCK_ID = "tsmc";

/** 快速預設配置（第 5.2 節） */
export const ALLOCATION_PRESETS: { id: string; label: string; alloc: Record<string, number> }[] = [
  ...ASSETS.map((a) => ({ id: `single-${a.id}`, label: `${a.label} 100%`, alloc: { [a.id]: 100 } })),
  { id: "stock-bond-80-20", label: "股債 80/20（VOO 80%、美國公債 20%）", alloc: { voo: 80, usbond: 20 } },
  { id: "tw-us-half", label: "台股美股各半（0050 50%、VOO 50%）", alloc: { tw0050: 50, voo: 50 } },
  { id: "all-cash", label: "全部定存 / 現金", alloc: { cash: 100 } },
];
