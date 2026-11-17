// ui/chart.tsx｜資產曲線圖（自繪 SVG，工作期實線／退休期虛線）
import type { SimResult, SimInput } from "../core/simulate";
import { fmtMoney, fmtNum, unitWord, type Basis, type Unit } from "./format";
import { TW_REGION } from "../config/regions/tw";
import { realToNominal } from "../core/rates";

interface Props {
  res: SimResult;
  inp: SimInput;
  basis: Basis;
  unit: Unit;
}

export default function Chart({ res, inp, basis, unit }: Props) {
  const rows = res.rows;
  const infF = 1 + inp.inflation / 100;
  const disp = (row: (typeof rows)[number]) => (basis === "nominal" ? realToNominal(row.assets, infF - 1, row.t) : row.assets);
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
        年底資產（{unitWord(unit)}，{basis === "nominal" ? "帳面金額，含通膨" : "今日幣值"}）
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

// ---- Phase 2：三情境曲線（區間帶／三條獨立線） ----
import type { ScenarioOutcome } from "../core/compute";
import { SCENARIO_LABELS } from "../config/assets";

export function ScenarioChart({ scenarios, mode, basis, unit, inflationByScenario }: {
  scenarios: ScenarioOutcome[];
  mode: "band" | "lines";
  basis: Basis;
  unit: Unit;
  inflationByScenario: Record<string, number>;
}) {
  const W = 880, H = 300, L = 78, R = 14, T = 14, B = 34;
  const byId = Object.fromEntries(scenarios.map((s) => [s.id, s]));
  const cons = byId["conservative"], neu = byId["neutral"], opt = byId["optimistic"];
  if (!cons || !neu || !opt) return null;
  const dispOf = (sc: ScenarioOutcome) => (row: (typeof sc.res.rows)[number]) =>
    basis === "nominal" ? realToNominal(row.assets, inflationByScenario[sc.id] / 100, row.t) : row.assets;
  const series = scenarios.map((sc) => ({ sc, pts: sc.res.rows.map((row) => ({ age: row.age, t: row.t, v: dispOf(sc)(row) })) }));
  const all = series.flatMap((s) => s.pts);
  const maxAge = Math.max(...all.map((p) => p.age));
  const minAge = Math.min(...all.map((p) => p.age));
  const maxV = Math.max(...all.map((p) => p.v), 1);
  const x = (age: number) => L + ((age - minAge) / Math.max(1, maxAge - minAge)) * (W - L - R);
  const y = (v: number) => T + (1 - v / maxV) * (H - T - B);
  const line = (pts: { age: number; v: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const optPts = series.find((s) => s.sc.id === "optimistic")!.pts;
  const consPts = series.find((s) => s.sc.id === "conservative")!.pts;
  const bandPath =
    optPts.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ") +
    " " + [...consPts].reverse().map((p) => `L${x(p.age).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ") + " Z";
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxV * f);
  const colors: Record<string, string> = { conservative: "#b3543f", neutral: "#2e7d4f", optimistic: "#3366aa" };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="三情境資產曲線圖">
      {ticks.map((tv, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(tv)} y2={y(tv)} stroke="#e3e6e3" />
          <text x={L - 6} y={y(tv) + 4} textAnchor="end" fontSize="11" fill="#667">{fmtNum(tv, unit)}</text>
        </g>
      ))}
      {mode === "band" ? (
        <>
          <path d={bandPath} fill="#2e7d4f" opacity={0.15} />
          <path d={line(series.find((s) => s.sc.id === "neutral")!.pts)} fill="none" stroke={colors.neutral} strokeWidth={2} />
        </>
      ) : (
        series.map(({ sc, pts }) => (
          <path key={sc.id} d={line(pts)} fill="none" stroke={colors[sc.id]} strokeWidth={2}
            strokeDasharray={sc.id === "conservative" ? "5 4" : sc.id === "optimistic" ? "2 3" : undefined}>
            <title>{`${SCENARIO_LABELS[sc.id]}情境`}</title>
          </path>
        ))
      )}
      <text x={L} y={H - 8} fontSize="11" fill="#667">{minAge} 歲</text>
      <text x={W - R} y={H - 8} textAnchor="end" fontSize="11" fill="#667">{maxAge} 歲</text>
      <text x={W - R} y={T + 4} textAnchor="end" fontSize="11" fill="#667">
        {mode === "band" ? "區間帶：保守（下緣）到樂觀（上緣），綠線為中性" : "實線：中性／虛線：保守／點線：樂觀"}
      </text>
    </svg>
  );
}

// ---- Phase 3 圖表 ----

/** 通用多線圖（配置比較用）：series 為 {label, points(age->資產), color, dash} */
export function MultiLineChart({ series, unit }: {
  series: { label: string; points: { age: number; v: number }[]; color: string; dash?: string }[];
  unit: Unit;
}) {
  const W = 880, H = 280, L = 78, R = 14, T = 14, B = 34;
  const all = series.flatMap((s) => s.points);
  if (!all.length) return null;
  const minAge = Math.min(...all.map((p) => p.age)), maxAge = Math.max(...all.map((p) => p.age));
  const maxV = Math.max(...all.map((p) => p.v), 1);
  const x = (age: number) => L + ((age - minAge) / Math.max(1, maxAge - minAge)) * (W - L - R);
  const y = (v: number) => T + (1 - v / maxV) * (H - T - B);
  const ticks = [0, 0.5, 1].map((f) => maxV * f);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="資產曲線比較圖">
      {ticks.map((tv, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(tv)} y2={y(tv)} stroke="#e3e6e3" />
          <text x={L - 6} y={y(tv) + 4} textAnchor="end" fontSize="11" fill="#667">{fmtNum(tv, unit)}</text>
        </g>
      ))}
      {series.map((s) => (
        <path key={s.label} d={s.points.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}
          fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash}>
          <title>{s.label}</title>
        </path>
      ))}
      {series.map((s, i) => (
        <text key={s.label} x={L + i * 210} y={H - 10} fontSize="12" fill={s.color}>● {s.label}</text>
      ))}
    </svg>
  );
}

/** 退休收入來源結構堆疊圖：每年支出由勞保、勞退、其他收入、資產提領（缺口）支應 */
export function IncomeStackChart({ res, unit }: { res: SimResult; unit: Unit }) {
  const rows = res.rows.filter((r) => r.phase === "retire");
  if (!rows.length || !res.socialDetail) return null;
  const W = 880, H = 260, L = 78, R = 14, T = 14, B = 30;
  const maxV = Math.max(...rows.map((r) => r.expense), 1);
  const bw = (W - L - R) / rows.length;
  const y = (v: number) => T + (1 - v / maxV) * (H - T - B);
  const colors = { li: "#3366aa", lp: "#5b8c5a", other: "#c9a227", gap: "#b3543f" };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="退休收入來源結構圖">
      {[0, 0.5, 1].map((f, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(maxV * f)} y2={y(maxV * f)} stroke="#e3e6e3" />
          <text x={L - 6} y={y(maxV * f) + 4} textAnchor="end" fontSize="11" fill="#667">{fmtNum(maxV * f, unit)}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const other = Math.max(0, r.income - r.li - r.lp);
        const segs: [number, string][] = [[r.li, colors.li], [r.lp, colors.lp], [other, colors.other], [r.gap, colors.gap]];
        let acc = 0;
        return (
          <g key={r.age}>
            {segs.map(([v, c], j) => {
              if (v <= 0) return null;
              const y1 = y(acc + v), h = y(acc) - y1;
              acc += v;
              return <rect key={j} x={L + i * bw + 0.5} y={y1} width={Math.max(1, bw - 1)} height={h} fill={c}><title>{`${r.age} 歲`}</title></rect>;
            })}
          </g>
        );
      })}
      <text x={L} y={H - 8} fontSize="11" fill={colors.li}>■ 勞保年金</text>
      <text x={L + 110} y={H - 8} fontSize="11" fill={colors.lp}>■ 勞退月領</text>
      <text x={L + 220} y={H - 8} fontSize="11" fill={colors.other}>■ 其他收入</text>
      <text x={L + 330} y={H - 8} fontSize="11" fill={colors.gap}>■ 資產提領（缺口）</text>
    </svg>
  );
}

/** 通膨影響對照：名目金額固定下，實質購買力隨年下降 */
export function PurchasingPowerChart({ series, amount, unit }: {
  series: { t: number; real: number }[]; amount: number; unit: Unit;
}) {
  const W = 880, H = 240, L = 78, R = 14, T = 14, B = 30;
  if (!series.length) return null;
  const maxT = Math.max(...series.map((p) => p.t), 1);
  const x = (t: number) => L + (t / maxT) * (W - L - R);
  const y = (v: number) => T + (1 - v / amount) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="通膨影響對照圖">
      <line x1={L} x2={W - R} y1={y(amount)} y2={y(amount)} stroke="#999" strokeDasharray="5 4" />
      <text x={L - 6} y={y(amount) + 4} textAnchor="end" fontSize="11" fill="#667">{fmtNum(amount, unit)}</text>
      <path d={series.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.real).toFixed(1)}`).join(" ")} fill="none" stroke="#b3543f" strokeWidth={2}>
        <title>實質購買力</title>
      </path>
      <text x={L} y={H - 8} fontSize="11" fill="#667">虛線：帳面金額（不變）</text>
      <text x={L + 190} y={H - 8} fontSize="11" fill="#b3543f">紅線：實質購買力</text>
      <text x={W - R} y={H - 8} textAnchor="end" fontSize="11" fill="#667">{maxT} 年後</text>
    </svg>
  );
}

/** 標的比較區間條：保守（左）到樂觀（右），中性標記 */
export function AssetRangeBars({ rows, unit }: {
  rows: { label: string; cons: number; neu: number; opt: number }[]; unit: Unit;
}) {
  const maxV = Math.max(...rows.map((r) => r.opt), 1);
  return (
    <div>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, margin: "5px 0" }}>
          <span style={{ width: 110, fontSize: ".9rem" }}>{r.label}</span>
          <span style={{ position: "relative", flex: 1, height: 14, background: "#f0f2f0", borderRadius: 4 }}>
            <span style={{ position: "absolute", left: `${(r.cons / maxV) * 100}%`, width: `${Math.max(1, ((r.opt - r.cons) / maxV) * 100)}%`, top: 2, height: 10, background: "#7fb08a", borderRadius: 3 }} />
            <span style={{ position: "absolute", left: `calc(${(r.neu / maxV) * 100}% - 1px)`, top: 0, width: 2, height: 14, background: "#274e13" }} />
          </span>
          <span style={{ width: 210, fontSize: ".85rem", color: "#445" }}>{fmtNum(r.cons, unit)} ～ {fmtNum(r.opt, unit)}</span>
        </div>
      ))}
      <p className="note">條 = 保守到樂觀，深色標記 = 中性。金額單位：{unit === "wan" ? "萬元" : "元"}（今日幣值）。</p>
    </div>
  );
}
