// ui/chart.tsx｜資產曲線圖（自繪 SVG，工作期實線／退休期虛線）
import type { SimResult, SimInput } from "../core/simulate";
import { fmtMoney, fmtNum, unitWord, type Basis, type Unit } from "./format";
import { TW_REGION } from "../config/regions/tw";

interface Props {
  res: SimResult;
  inp: SimInput;
  basis: Basis;
  unit: Unit;
}

export default function Chart({ res, inp, basis, unit }: Props) {
  const rows = res.rows;
  const infF = 1 + inp.inflation / 100;
  const disp = (row: (typeof rows)[number]) => (basis === "nominal" ? row.assets * Math.pow(infF, row.t) : row.assets);
  let maxV = 0;
  for (const row of rows) maxV = Math.max(maxV, disp(row));
  const wan = TW_REGION.numberFormat.wanUnit;
  const dispMax = unit === "wan" ? maxV / wan : maxV;
  const yMax = dispMax > 0 ? dispMax * 1.12 : 1;

  const W = 680, H = 360, L = 78, Rm = 16, T = 14, B = 40;
  const iw = W - L - Rm, ih = H - T - B;
  const aMin = inp.ageNow, aMax = inp.ageLife;
  const X = (age: number) => L + ((age - aMin) / Math.max(1, aMax - aMin)) * iw;
  const Y = (v: number) => {
    const dv = unit === "wan" ? v / wan : v;
    return T + ih - (dv / yMax) * ih;
  };

  const splitIdx = res.workYears;
  const workRows = rows.slice(0, splitIdx + 1);
  const retRows = rows.slice(splitIdx);
  const ptsOf = (list: typeof rows) => list.map((row) => `${X(row.age).toFixed(1)},${Y(disp(row)).toFixed(1)}`).join(" ");
  const rp = rows[splitIdx];
  const er = res.exhaustAge !== null ? rows.find((row) => row.age === res.exhaustAge) : undefined;
  const ticks: number[] = [];
  for (let i = 0; i <= 4; i++) ticks.push((yMax * i) / 4);
  const xTicks: number[] = [];
  for (let age = Math.ceil(aMin / 10) * 10; age <= aMax; age += 10) xTicks.push(age);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="資產隨年齡變化曲線圖">
      <rect x={X(aMin)} y={T} width={Math.max(0, X(inp.ageRetire) - X(aMin))} height={ih} fill="var(--shade-work)" />
      <rect x={X(inp.ageRetire)} y={T} width={Math.max(0, X(aMax) - X(inp.ageRetire))} height={ih} fill="var(--shade-ret)" />
      {ticks.map((val, i) => {
        const y = Y(unit === "wan" ? val * wan : val);
        return (
          <g key={i}>
            <line x1={L} y1={y} x2={W - Rm} y2={y} stroke="var(--grid)" strokeWidth="1" />
            <text x={L - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--ink-soft)">
              {fmtNum(unit === "wan" ? val * wan : val, unit)}
            </text>
          </g>
        );
      })}
      {xTicks.map((age) => (
        <text key={age} x={X(age)} y={H - 22} textAnchor="middle" fontSize="11" fill="var(--ink-soft)">{age}</text>
      ))}
      <text x={X(aMin)} y={H - 22} textAnchor="middle" fontSize="11" fill="var(--ink-soft)">{aMin}</text>
      {aMax % 10 !== 0 && (
        <text x={X(aMax)} y={H - 22} textAnchor="middle" fontSize="11" fill="var(--ink-soft)">{aMax}</text>
      )}
      <text x={L} y={H - 4} fontSize="11" fill="var(--ink-soft)">年齡（歲）</text>
      <text x={W - Rm} y={H - 4} textAnchor="end" fontSize="11" fill="var(--ink-soft)">
        年底資產（{unitWord(unit)}，{basis === "nominal" ? "名目" : "今日幣值"}）
      </text>
      {inp.ageRetire > aMin && inp.ageRetire < aMax && (
        <g>
          <line x1={X(inp.ageRetire)} y1={T} x2={X(inp.ageRetire)} y2={T + ih} stroke="var(--ink-soft)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={X(inp.ageRetire) + 5} y={T + 14} fontSize="11.5" fill="var(--ink)">退休 {inp.ageRetire} 歲</text>
        </g>
      )}
      {workRows.length > 1 && <polyline points={ptsOf(workRows)} fill="none" stroke="var(--chart-work)" strokeWidth="2.5" />}
      {retRows.length > 1 && <polyline points={ptsOf(retRows)} fill="none" stroke="var(--chart-ret)" strokeWidth="2.5" strokeDasharray="7 4" />}
      {rows.length === 1 && <circle cx={X(rows[0].age)} cy={Y(disp(rows[0]))} r="4" fill="var(--chart-work)" />}
      {rp && (
        <circle cx={X(rp.age)} cy={Y(disp(rp))} r="4.5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2">
          <title>退休時（{rp.age} 歲）資產 {fmtMoney(rp.assets, rp.t, inp.inflation, basis, unit)}</title>
        </circle>
      )}
      {er && (
        <g>
          <circle cx={X(er.age)} cy={Y(disp(er))} r="5" fill="var(--chart-exhaust)">
            <title>資產在 {er.age} 歲耗盡</title>
          </circle>
          <text x={Math.min(X(er.age) + 8, W - 110)} y={Y(0) - 8} fontSize="11.5" fill="var(--chart-exhaust)">{er.age} 歲耗盡</text>
        </g>
      )}
      {rows.map((row) => (
        <circle key={row.age} cx={X(row.age)} cy={Y(disp(row))} r="7" fill="transparent">
          <title>{row.age} 歲年底資產 {fmtMoney(row.assets, row.t, inp.inflation, basis, unit)}</title>
        </circle>
      ))}
    </svg>
  );
}
