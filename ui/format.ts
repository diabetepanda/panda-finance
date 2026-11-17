// ui/format.ts｜顯示格式化（只負責顯示，所有數字來自 core/config）
import { TW_REGION } from "../config/regions/tw";
import { realToNominal } from "../core/rates";

export type Basis = "real" | "nominal";
export type Unit = "wan" | "yuan";

function commas(numStr: string): string {
  const parts = numStr.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

export function fmtNum(v: number, unit: Unit): string {
  if (!Number.isFinite(v)) return "—";
  if (unit === "wan") {
    const w = v / TW_REGION.numberFormat.wanUnit;
    const s = Math.abs(w).toFixed(TW_REGION.numberFormat.wanDecimals);
    return (w < 0 && parseFloat(s) !== 0 ? "-" : "") + commas(s);
  }
  return commas(String(Math.round(v)));
}

export function unitWord(unit: Unit): string {
  return unit === "wan" ? "萬元" : "元";
}

export function basisTag(basis: Basis): string {
  return basis === "nominal" ? "（帳面金額，含通膨）" : "（今日幣值）";
}

/** 依目前口徑/單位格式化金額：realVal 為實質（今日幣值）金額，t 為經過年數 */
export function fmtMoney(realVal: number, t: number, inflationPct: number, basis: Basis, unit: Unit): string {
  const v = basis === "nominal" ? realToNominal(realVal, inflationPct / 100, t) : realVal;
  return `${fmtNum(v, unit)} ${unitWord(unit)}${basisTag(basis)}`;
}

export function fmtPct(x: number | null): string {
  return x === null || !Number.isFinite(x) ? "—" : (x * 100).toFixed(1) + "%";
}

export function fmtRatePct(x: number): string {
  return (x * 100).toFixed(2).replace(/\.?0+$/, "") + "%";
}

export function fmtPlain(n: number): string {
  return commas(String(Math.round(n)));
}
