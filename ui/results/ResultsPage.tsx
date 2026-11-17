// ui/results/ResultsPage.tsx｜步驟 ④ 結果頁（規格 Phase 5 第六節）
// 一組全頁共用的金額口徑/單位切換、四張摘要卡、圖表、四個分頁、存檔列、免責聲明。
import { useMemo, useRef, useState } from "react";
import type { FormState, Computed } from "../form";
import { num } from "../form";
import type { SimResult } from "../../core/simulate";
import type { EarliestResult } from "../../core/retirement";
import { findExtraSavingForEarliest } from "../../core/solver";
import { plainConclusion } from "../../core/conclusion";
import { computeScenarios, type ScenariosOutcome, type ScenarioOutcome } from "../../core/compute";
import { goalSavingAnswers, goalSpendAnswers, goalEarliestAnswers } from "../../core/goals";
import { assetComparison, purchasingPowerSeries, socialVariants } from "../../core/compare";
import { investCompare } from "../../core/investCompare";
import { dca, dcaPair } from "../../core/dca";
import { realToNominal, nominalToReal } from "../../core/rates";
import { paramValue } from "../../config/defaults";
import { ASSETS, ASSET_MAP, ALLOCATION_PRESETS, SCENARIO_IDS, SCENARIO_LABELS, type ScenarioId } from "../../config/assets";
import type { ValidationResult } from "../../core/validate";
import { fmtMoney, fmtNum, fmtPct, fmtPlain, fmtRatePct, unitWord, basisTag, type Basis, type Unit } from "../format";
import Chart, { ScenarioChart, MultiLineChart, IncomeStackChart, PurchasingPowerChart, AssetRangeBars } from "../chart";
import Tabs from "../components/Tabs";

export const DISCLAIMER_FULL =
  "本網站為試算與教育工具，所有結果依據使用者輸入與假設值推算，不代表對未來報酬的預測，也不構成任何投資建議、金融商品推介或勸誘。各標的報酬率、通膨率、匯率變動、勞保勞退參數均為依公開資料推得的假設值（查證日 2026-11-17），使用者可自行調整。歷史報酬不保證未來表現，投資有風險。勞保、勞退、稅務與健保規定可能變動，請以主管機關公告為準。本網站未考慮個人的完整財務狀況、風險承受度與投資目標，若需要專業意見，請洽具備資格的專業人士。";
export const DISCLAIMER_SHORT = "以上為依假設值推算的試算結果，非預測，也不是投資建議。";
export const COMPLIANCE = "以下為假設值試算的教育性比較，非預測、非投資建議，也不代表任何金融商品的推介。歷史報酬不代表未來，投資有虧損風險。";
export const INFLATION_FIXED_NOTE = "通膨率固定以 2% 計算。依據：主計總處 CPI 年增率 113 年 2.18%、114 年 1.66%、115 年 1–10 月 1.98%；中央銀行表示通膨率中長期平均 2% 左右可以接受。";


function earliestText(e: EarliestResult, L: number): { main: string; sub: string } {
  if (e.type === "already") {
    return e.lastsToLife
      ? { main: "已退休，可撐到預期壽命", sub: `目前已是退休狀態，在這組假設下，資產可撐到預期壽命 ${L} 歲` }
      : { main: "已退休，資產不足以撐到預期壽命", sub: `目前已是退休狀態，但資產將在 ${e.exhaustAge} 歲耗盡，撐不到預期壽命 ${L} 歲` };
  }
  if (e.type === "age") return { main: `${e.age} 歲`, sub: "在這組假設下，資產可撐到預期壽命的最早退休年齡" };
  return { main: "無法達成", sub: `在目前假設下無法達成（試算到 ${paramValue("earliestRetirementCap")} 歲）` };
}


function BaseMain({ c, basis, unit }: { c: Computed; basis: Basis; unit: Unit }) {
  const { inp, res, earliest } = c;
  const A = inp.ageNow, R = inp.ageRetire, L = inp.ageLife;
  const money = (v: number, t: number) => fmtMoney(v, t, inp.inflation, basis, unit);
  const rawMoney = (real: number, realNom: number) =>
    basis === "nominal" ? `${fmtNum(realNom, unit)} ${unitWord(unit)}（帳面金額，含通膨）` : `${fmtNum(real, unit)} ${unitWord(unit)}（今日幣值）`;

  let earliestMain = "", earliestSub = "";
  if (earliest.type === "already") {
    // 功能 (b)：已退休依資產能否撐到預期壽命分開顯示
    if (earliest.lastsToLife) {
      earliestMain = "已退休，可撐到預期壽命";
      earliestSub = `目前已是退休狀態，在這組假設下，資產可撐到預期壽命 ${L} 歲`;
    } else {
      earliestMain = "已退休，資產不足以撐到預期壽命";
      earliestSub = `目前已是退休狀態，但資產將在 ${earliest.exhaustAge} 歲耗盡，撐不到預期壽命 ${L} 歲`;
    }
  } else if (earliest.type === "age") {
    earliestMain = `${earliest.age} 歲`;
    earliestSub = "在這組假設下，資產可撐到預期壽命的最早退休年齡";
  } else {
    earliestMain = "無法達成";
    earliestSub = `在目前假設下無法達成（試算到 ${paramValue("earliestRetirementCap")} 歲）`;
  }

  return (
    <>
      <div className="summary-block">
        <div className="summary-grid">
          <div className="sum-card">
            <div className="k">退休時預估資產</div>
            <div className="v">{money(res.retireAssets, R - A)}</div>
            <div className="s">{R === A ? "目前（已退休）時點的資產" : `在 ${R} 歲退休時`}</div>
          </div>
          <div className="sum-card">
            <div className="k">退休所需資金</div>
            <div className="v">{res.required > 0 ? money(res.required, R - A) : `0 ${unitWord(unit)}${basisTag(basis)}`}</div>
            <div className="s">{res.required > 0
              ? <>資金達成率 {fmtPct(res.achieve)}<span className="q" tabIndex={0} data-tip="退休時預估資產 ÷ 退休所需資金。100% 表示剛好撐到預期壽命。">?</span></>
              : (res.shortfall <= 0 ? "勞保、勞退和其他退休收入已足以支應退休支出（依目前假設）" : "無退休年數")}</div>
          </div>
          <div className="sum-card">
            <div className="k">最早可退休年齡</div>
            <div className="v" style={{ fontSize: earliest.type === "already" ? "1.05rem" : undefined }}>{earliestMain}</div>
            <div className="s">{earliestSub}</div>
          </div>
          <div className="sum-card">
            <div className="k">資產可撐到幾歲</div>
            <div className="v">{res.exhaustAge === null ? `${L} 歲` : `${res.exhaustAge} 歲耗盡`}</div>
            <div className="s">{res.exhaustAge === null ? "可撐到預期壽命" : `資產在 ${res.exhaustAge} 歲年底用完`}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>資產隨年齡變化</h2></div>
        <div className="card-body">
          <div className="legend">
            <span><i className="sw work" />工作期間（實線）</span>
            <span><i className="sw retire" />退休期間（虛線）</span>
            <span><i className="sw exhaust" />資產耗盡點</span>
          </div>
          <Chart res={res} inp={inp} basis={basis} unit={unit} />
        </div>
      </div>

      {res.socialDetail && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head"><h2>退休收入來源結構</h2></div>
          <div className="card-body">
            <IncomeStackChart res={res} unit={unit} />
            <p className="note">每一根柱是該年退休支出（今日幣值）的來源組成；紅色部分是需要由投資資產提領支應的缺口。</p>
          </div>
        </div>
      )}

    </>
  );
}

function BaseDetails({ c, basis, unit, onCsv, socialStatusText }: {
  c: Computed; basis: Basis; unit: Unit; onCsv: () => void; socialStatusText: string;
}) {
  const { inp, res } = c;
  const A = inp.ageNow, R = inp.ageRetire, L = inp.ageLife;
  const money = (v: number, t: number) => fmtMoney(v, t, inp.inflation, basis, unit);
  const rawMoney = (real: number, realNom: number) =>
    basis === "nominal" ? `${fmtNum(realNom, unit)} ${unitWord(unit)}（帳面金額，含通膨）` : `${fmtNum(real, unit)} ${unitWord(unit)}（今日幣值）`;
  return (
    <>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>完整數字</h2></div>
        <div className="card-body">
          <p className="note" style={{ marginTop: 2 }}>在這組假設下，結果是：</p>
          <table className="result-table"><tbody>
            <tr><th>每月結餘</th><td>{money(c.monthlyBalance, 0)}</td></tr>
            <tr><th>儲蓄率</th><td>{fmtPct(c.savingsRate)}</td></tr>
            <tr><th>一輩子工作收入估算（實質）</th><td>{fmtNum(res.lifetimeReal, unit)} {unitWord(unit)}（今日幣值）</td></tr>
            <tr><th>一輩子工作收入估算（帳面金額，含通膨）</th><td>{fmtNum(res.lifetimeNom, unit)} {unitWord(unit)}（帳面金額，含通膨）</td></tr>
            <tr><th>退休時預估資產</th><td>{money(res.retireAssets, R - A)}</td></tr>
            <tr><th>退休所需資金</th><td>{res.required > 0 ? money(res.required, R - A) : `0 ${unitWord(unit)}${basisTag(basis)}`}</td></tr>
            <tr><th>資金達成率</th><td>{res.achieve === null ? "—" : fmtPct(res.achieve)}</td></tr>
            <tr><th>資產可撐到幾歲</th><td>{res.exhaustAge === null
              ? `可撐到預期壽命，預期壽命時剩餘資產約 ${money(res.finalAssets, L - A)}`
              : `資產將在 ${res.exhaustAge} 歲耗盡`}</td></tr>
            {res.workGap > 0 && <tr><th>工作期間資金缺口（累計）</th><td>{rawMoney(res.workGap, res.workGapNom)}</td></tr>}
            {res.uncovered > 0 && <tr><th>未被覆蓋的支出（累計）</th><td>{rawMoney(res.uncovered, res.uncoveredNom)}</td></tr>}
          </tbody></table>
          <p className="note">一輩子工作收入：這是依你輸入的薪資與成長率推算的估計值，不是保證。</p>

          <p className="note" style={{ marginTop: 10 }}>{DISCLAIMER_SHORT}</p>
          <p className="print-only">主要假設：現在年齡 {inp.ageNow} 歲、預計退休 {inp.ageRetire} 歲、預期壽命 {inp.ageLife} 歲；通膨率 2%（固定假設）、退休前投資每年報酬率假設 {inp.retPre}%、退休後投資每年報酬率假設 {inp.retPost}%、薪資每年調幅假設 {inp.salaryGrowth}%；{socialStatusText}。</p>
        </div>
      </div>

      <details className="card" style={{ marginTop: 16 }}>
        <summary>逐年明細表</summary>
        <div className="card-body">
          <div className="actions no-print" style={{ marginBottom: 10 }}>
            <button type="button" className="ghost small" onClick={onCsv}>匯出 CSV（今日幣值，元）</button>
          </div>
          <div className="table-scroll">
            <table className="detail-table">
              <thead><tr><th>年齡</th><th>年收入</th><th>年支出</th><th>年儲蓄</th><th>投資收益</th><th>年底資產</th>{inp.social && <><th>勞保年金</th><th>勞退月領</th><th>年支出缺口</th></>}</tr></thead>
              <tbody>
                {res.rows.map((row) => {
                  const cv = (v: number) => fmtNum(basis === "nominal" ? realToNominal(v, inp.inflation / 100, row.t) : v, unit);
                  return (
                    <tr key={row.age} className={row.phase === "retire" ? "retire-row" : row.phase === "now" ? "now-row" : ""}>
                      <td>{row.age}</td><td>{cv(row.income)}</td><td>{cv(row.expense)}</td>
                      <td>{cv(row.flow)}</td><td>{cv(row.gain)}</td><td>{cv(row.assets)}</td>
                      {inp.social && <><td>{row.phase === "retire" ? cv(row.li) : "—"}</td><td>{row.phase === "retire" ? cv(row.lp) : "—"}</td><td>{row.phase === "retire" ? cv(row.gap) : "—"}</td></>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note">金額單位：{unitWord(unit)}{basisTag(basis)}。退休期間的年儲蓄欄為每年支出缺口的負值。</p>
        </div>
      </details>

      <details className="card" id="calcNotes" style={{ marginTop: 16 }}>
        <summary>計算說明（這些數字怎麼來的）</summary>
        <div className="card-body calc-notes">
          <p>本頁以「年」為單位逐年往下算：年齡用整數、每一年的現金流都假設在<b>年底</b>發生。現在年齡記為 A、退休年齡 R、預期壽命 L；工作年數＝R−A，退休年數＝L−R。所有金額先以浮點數精算，顯示時才取整；每個除法在計算前都會先檢查分母。</p>
          <p><b>目前採用的參數值</b>（會隨左側輸入即時更新）：</p>
          <ul>
            <li>通膨率：2%（固定假設）</li>
            <li>退休前投資每年報酬率假設（含通膨）：{inp.retPre}%／年 → 實質報酬率 <code>r</code> ＝ {fmtRatePct(res.r)}</li>
            <li>退休後投資每年報酬率假設（含通膨）：{inp.retPost}%／年 → 退休後實質報酬率 <code>rho</code> ＝ {fmtRatePct(res.rho)}</li>
            <li>薪資每年調幅假設（含通膨）：{inp.salaryGrowth}%／年 → 實質薪資成長率 <code>g</code> ＝ {fmtRatePct(res.g)}</li>
          </ul>
          <p><b>報酬率的換算</b>：實質報酬率不是含通膨報酬率直接減通膨，而是 <code>r ＝ (1＋含通膨報酬率) ÷ (1＋通膨率) − 1</code>；實質薪資成長率 <code>g</code> 用同樣方式換算。帳面金額與今日幣值金額的換算為 <code>帳面金額 ＝ 今日幣值金額 × (1＋通膨率)^經過年數</code>，經過年數從現在起算。</p>
          <p><b>工作期</b>（第 t 年，t＝1…R−A）：</p>
          <ul>
            <li>實質年收入 ＝ 月收入 × 12 × (1＋g)^(t−1)</li>
            <li>實質年支出 ＝ 各支出項目年總和。單一通膨假設下，支出以今日幣值維持不變；項目若填了「到第幾歲結束」，以該年年底年齡 A＋t 判斷，超過結束年齡後就不再計入。</li>
            <li>年儲蓄 ＝ 年收入 − 年支出（可以是負數）。</li>
            <li>年底資產 ＝ 上一年年底資產 × (1＋r) ＋ 年儲蓄。</li>
            <li>若資產變成負數，模擬中以 0 為下限，差額累計為「資金缺口」並提示透支，不讓負資產繼續計息。</li>
          </ul>
          <p><b>退休期</b>（第 k 年，k＝1…L−R）：</p>
          <ul>
            <li>實質退休支出 ＝ 退休後月支出 × 12，固定不變；收入來源 ＝ 其他退休收入 × 12。</li>
            <li>每年支出缺口 ＝ max(0, 退休支出 − 其他退休收入年額)。其他退休收入若超過支出，超額部分不回頭投入、不增加資產（這是偏保守的簡化）。</li>
            <li>年底資產 ＝ 上一年年底資產 × (1＋rho) − 缺口。</li>
            <li>資產降到 0 以下的那一年，其年底年齡記為「資產耗盡年齡」，之後資產以 0 顯示，沒被覆蓋的缺口累計為「未被覆蓋的支出」。</li>
          </ul>
          <p><b>退休所需資金</b>：退休當下需要準備多少，才能剛好撐到預期壽命 ＝ 把退休期間每年的缺口以退休後實質報酬率折現回退休時點的現值總和。每年缺口固定為 P、年數為 n 時：<code>P × (1 − (1＋rho)^(−n)) ÷ rho</code>；當 rho＝0 時改用 <code>P × n</code>，不會除以零。資金達成率 ＝ 退休時預估資產 ÷ 退休所需資金。</p>
          <p><b>最早可退休年齡</b>：從 A＋1 歲起逐歲試算到 {paramValue("earliestRetirementCap")} 歲，每個候選年齡都重跑一次完整模擬（工作期長短跟著改變，不假設結果單調），回傳第一個資產能撐到預期壽命的年齡，容許 {paramValue("exhaustTolerance")} 元誤差。若退休年齡就等於現在年齡，視為已退休，並依資產能否撐到預期壽命分別顯示。無法達成時，本頁會另外以二分搜尋試算「每月多存多少」才可達成（搜尋使用同一個模擬引擎）。</p>
          <p><b>一輩子工作收入</b>：工作期每年的實質年收入總和；帳面總和則是每年先乘上 (1＋通膨率)^t 再加總，不是用單一倍率換算。</p>
        </div>
      </details>
    </>
  );
}

function ScenarioMain({ c, scen, basis, unit }: { c: Computed; scen: ScenariosOutcome; basis: Basis; unit: Unit }) {
  const [chartMode, setChartMode] = useState<"band" | "lines">("band");
  const byId = Object.fromEntries(scen.scenarios.map((x) => [x.id, x])) as Record<ScenarioId, ScenarioOutcome>;
  const neu = byId.neutral, cons = byId.conservative, opt = byId.optimistic;
  const A = c.inp.ageNow, R = c.inp.ageRetire, L = c.inp.ageLife;
  const moneyOf = (sc: ScenarioOutcome) => (v: number, t: number) => fmtMoney(v, t, sc.inflationPct, basis, unit);
  const et = earliestText(neu.earliest, L);


  return (
    <>
      <p className="range-line">
        保守到樂觀情境下，退休時資產約落在 {moneyOf(cons)(cons.res.retireAssets, R - A)} 到 {moneyOf(opt)(opt.res.retireAssets, R - A)} 之間{basisTag(basis)}。這是依假設值推算的區間，不是預測。
      </p>
      <div className="summary-block" style={{ marginTop: 12 }}>
        <div className="summary-grid">
          <div className="sum-card">
            <div className="k">退休時預估資產（中性情境）</div>
            <div className="v">{moneyOf(neu)(neu.res.retireAssets, R - A)}</div>
            <div className="s">保守 {moneyOf(cons)(cons.res.retireAssets, R - A)}／樂觀 {moneyOf(opt)(opt.res.retireAssets, R - A)}</div>
          </div>
          <div className="sum-card">
            <div className="k">退休所需資金（中性情境）</div>
            <div className="v">{neu.res.required > 0 ? moneyOf(neu)(neu.res.required, R - A) : `0 ${unitWord(unit)}${basisTag(basis)}`}</div>
            <div className="s">{neu.res.required > 0 ? <>資金達成率 {fmtPct(neu.res.achieve)}</> : (neu.res.shortfall <= 0 ? "勞保、勞退和其他退休收入已足以支應退休支出（依目前假設）" : "無退休年數")}</div>
          </div>
          <div className="sum-card">
            <div className="k">最早可退休年齡（中性情境）</div>
            <div className="v" style={{ fontSize: neu.earliest.type === "already" ? "1.05rem" : undefined }}>{et.main}</div>
            <div className="s">{et.sub}</div>
          </div>
          <div className="sum-card">
            <div className="k">資產可撐到幾歲（中性情境）</div>
            <div className="v">{neu.res.exhaustAge === null ? `${L} 歲` : `${neu.res.exhaustAge} 歲耗盡`}</div>
            <div className="s">{neu.res.exhaustAge === null ? "可撐到預期壽命" : `資產在 ${neu.res.exhaustAge} 歲年底用完`}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>三種情境摘要</h2></div>
        <div className="card-body">
          <p className="note">帳面金額，含通膨一律以「該情境自己的通膨率」換算。</p>
          <div className="table-scroll">
            <table className="scen-table">
              <thead><tr><th></th>{SCENARIO_IDS.map((id) => <th key={id}>{SCENARIO_LABELS[id]}（通膨 {byId[id].inflationPct}%、退休前報酬 {fmtRatePct(byId[id].preReturnPct / 100)}、退休後 {fmtRatePct(byId[id].postReturnPct / 100)}）</th>)}</tr></thead>
              <tbody>
                <tr><th>退休時資產</th>{SCENARIO_IDS.map((id) => <td key={id}>{moneyOf(byId[id])(byId[id].res.retireAssets, R - A)}</td>)}</tr>
                <tr><th>退休所需資金</th>{SCENARIO_IDS.map((id) => <td key={id}>{byId[id].res.required > 0 ? moneyOf(byId[id])(byId[id].res.required, R - A) : `0 ${unitWord(unit)}${basisTag(basis)}`}</td>)}</tr>
                <tr><th>資金達成率</th>{SCENARIO_IDS.map((id) => <td key={id}>{byId[id].res.achieve === null ? "—" : fmtPct(byId[id].res.achieve)}</td>)}</tr>
                <tr><th>最早可退休年齡</th>{SCENARIO_IDS.map((id) => <td key={id}>{earliestText(byId[id].earliest, L).main}</td>)}</tr>
                <tr><th>資產耗盡年齡</th>{SCENARIO_IDS.map((id) => <td key={id}>{byId[id].res.exhaustAge === null ? `撐到 ${L} 歲` : `${byId[id].res.exhaustAge} 歲耗盡`}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <p className="note" style={{ marginTop: 10 }}>{DISCLAIMER_SHORT}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>三情境資產曲線</h2></div>
        <div className="card-body">
          <div className="toggle-row no-print">
            <span><span className="tg-label">呈現方式</span>
              <span className="seg" role="group" aria-label="曲線呈現方式">
                <button type="button" aria-pressed={chartMode === "band"} onClick={() => setChartMode("band")}>區間帶</button>
                <button type="button" aria-pressed={chartMode === "lines"} onClick={() => setChartMode("lines")}>三條獨立線</button>
              </span></span>
          </div>
          <ScenarioChart scenarios={scen.scenarios} mode={chartMode} basis={basis} unit={unit}
            inflationByScenario={Object.fromEntries(scen.scenarios.map((x) => [x.id, x.inflationPct]))} />
        </div>
      </div>

    </>
  );
}

function ScenarioYearly({ c, scen, basis, unit }: { c: Computed; scen: ScenariosOutcome; basis: Basis; unit: Unit }) {
  const [detailId, setDetailId] = useState<ScenarioId>("neutral");
  const byId = Object.fromEntries(scen.scenarios.map((x) => [x.id, x])) as Record<ScenarioId, ScenarioOutcome>;
  const detail = byId[detailId];
  const downloadScenCsv = () => {
    const head = "年齡,年收入(元，今日幣值),年支出(元，今日幣值),年儲蓄(元，今日幣值),投資收益(元，今日幣值),年底資產(元，今日幣值)\n";
    const lines = detail.res.rows.map((r) => [r.age, Math.round(r.income), Math.round(r.expense), Math.round(r.flow), Math.round(r.gain), Math.round(r.assets)].join(","));
    const blob = new Blob(["\uFEFF" + head + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `panda-finance-yearly-${detailId}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <details className="card" style={{ marginTop: 16 }}>
        <summary>逐年明細表（三情境可切換）</summary>
        <div className="card-body">
          <div className="toggle-row no-print">
            <span><span className="tg-label">情境</span>
              <span className="seg" role="group" aria-label="明細情境">
                {SCENARIO_IDS.map((id) => (
                  <button key={id} type="button" aria-pressed={detailId === id} onClick={() => setDetailId(id)}>{SCENARIO_LABELS[id]}</button>
                ))}
              </span></span>
            <button type="button" className="ghost small" onClick={downloadScenCsv}>匯出 CSV（今日幣值，元）</button>
          </div>
          <div className="table-scroll">
            <table className="detail-table">
              <thead><tr><th>年齡</th><th>年收入</th><th>年支出</th><th>年儲蓄</th><th>投資收益</th><th>年底資產</th>{detail.inp.social && <><th>勞保年金</th><th>勞退月領</th><th>年支出缺口</th></>}</tr></thead>
              <tbody>
                {detail.res.rows.map((row) => {
                  const cv = (v: number) => fmtNum(basis === "nominal" ? realToNominal(v, detail.inflationPct / 100, row.t) : v, unit);
                  return (
                    <tr key={row.age} className={row.phase === "retire" ? "retire-row" : row.phase === "now" ? "now-row" : ""}>
                      <td>{row.age}</td><td>{cv(row.income)}</td><td>{cv(row.expense)}</td>
                      <td>{cv(row.flow)}</td><td>{cv(row.gain)}</td><td>{cv(row.assets)}</td>
                      {detail.inp.social && <><td>{row.phase === "retire" ? cv(row.li) : "—"}</td><td>{row.phase === "retire" ? cv(row.lp) : "—"}</td><td>{row.phase === "retire" ? cv(row.gap) : "—"}</td></>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note">金額單位：{unitWord(unit)}{basisTag(basis)}；帳面金額，含通膨以{SCENARIO_LABELS[detailId]}情境通膨 {detail.inflationPct}% 換算。退休期間的年儲蓄欄為每年支出缺口的負值。</p>
          <p className="note">組合報酬率：退休前 {fmtRatePct(detail.preReturnPct / 100)}／年、退休後 {fmtRatePct(detail.postReturnPct / 100)}／年（含通膨，匯率調整後加權）。</p>
        </div>
      </details>
    </>
  );
}
function GoalsCard({ c, form }: { c: Computed; form: FormState }) {
  const [mode, setMode] = useState<1 | 2 | 3>(1);
  const [targetAge, setTargetAge] = useState(String(c.inp.ageRetire));
  const [targetSpend, setTargetSpend] = useState(String(c.inp.retireSpend));
  const [savingZ, setSavingZ] = useState(String(Math.round(c.monthlyBalance)));
  const scen = c.goalScen;
  const single = !form.assetsEnabled;
  const rowLabel = (key: string) => (key === "single" ? "目前假設（與主畫面相同）" : SCENARIO_LABELS[key as ScenarioId]);

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head"><h2>目標反推</h2></div>
      <div className="card-body">
        <div className="seg no-print" role="group" aria-label="反推模式">
          <button type="button" aria-pressed={mode === 1} onClick={() => setMode(1)}>模式一：幾歲退休要存多少</button>
          <button type="button" aria-pressed={mode === 2} onClick={() => setMode(2)}>模式二：退休想領多少</button>
          <button type="button" aria-pressed={mode === 3} onClick={() => setMode(3)}>模式三：每月存 Z 元幾歲退休</button>
        </div>
        {single ? (
          <p className="note">以下答案使用與主畫面完全相同的假設（你輸入的退休前、退休後報酬率與通膨）。開啟進階設定裡的『投資標的』後，可看到保守、中性、樂觀三種情境的反推結果。反推與主畫面共用同一個模擬引擎。</p>
        ) : (
          <p className="note">以下答案都是「在目前所有假設下」的試算，依進階設定裡的投資標的與情境設定分三種情境計算。反推與主畫面共用同一個模擬引擎。</p>
        )}
        {!single && scen.paused ? (
          <p className="range-line">請先讓配置總和為 100%（目前 {fmtPlain(Math.round(scen.allocationTotalPct * 10) / 10)}%），反推暫停計算。</p>
        ) : mode === 1 ? (
          <>
            <div style={{ maxWidth: 300 }}>
              <label htmlFor="goalAge">想在幾歲退休（歲）</label>
              <input id="goalAge" type="number" inputMode="numeric" step="1" value={targetAge} onChange={(e) => setTargetAge(e.target.value)} />
            </div>
            <table className="scen-table"><thead><tr><th>情境</th><th>每月至少要存</th><th>佔月收入</th><th>與目前結餘差距</th></tr></thead>
              <tbody>
                {goalSavingAnswers(form.assetsEnabled, c.inp, scen, num(targetAge)).map(({ key, sol }) => {
                  return (
                    <tr key={key}><th>{rowLabel(key)}</th>
                      <td>{sol.found ? `${fmtPlain(sol.monthlySaving)} 元` : sol.reason}</td>
                      <td>{sol.found && sol.pctOfIncome !== null ? fmtPct(sol.pctOfIncome) : "—"}</td>
                      <td>{sol.found ? (sol.alreadyAchieved ? `目前已達成，餘裕 ${fmtPlain(Math.round(sol.surplus))} 元` : `還要多存 ${fmtPlain(Math.round(sol.gapVsCurrent))} 元`) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody></table>
          </>
        ) : mode === 2 ? (
          <>
            <div style={{ maxWidth: 300 }}>
              <label htmlFor="goalSpend">退休後每月想花（元，今日幣值）</label>
              <input id="goalSpend" type="number" inputMode="decimal" step="any" value={targetSpend} onChange={(e) => setTargetSpend(e.target.value)} />
            </div>
            <table className="scen-table"><thead><tr><th>情境</th><th>(a) 每月需要儲蓄</th><th>(b) 現在一次投入</th></tr></thead>
              <tbody>
                {goalSpendAnswers(form.assetsEnabled, c.inp, scen, num(targetSpend)).map(({ key, saving: a, lump: b }) => {
                  return (
                    <tr key={key}><th>{rowLabel(key)}</th>
                      <td>{a.found ? `${fmtPlain(a.monthlySaving)} 元${a.alreadyAchieved ? "（目前已達成）" : ""}` : a.reason}</td>
                      <td>{b.found ? `${fmtPlain(b.lumpSum)} 元` : b.reason}</td>
                    </tr>
                  );
                })}
              </tbody></table>
            <p className="note">(b) 是在每月儲蓄為 0、既有資產不變的前提下，現在需要一次投入的金額。</p>
          </>
        ) : (
          <>
            <div style={{ maxWidth: 300 }}>
              <label htmlFor="goalZ">每月可以存（元，今日幣值）</label>
              <input id="goalZ" type="number" inputMode="decimal" step="any" value={savingZ} onChange={(e) => setSavingZ(e.target.value)} />
            </div>
            <table className="scen-table"><thead><tr><th>情境</th><th>最早可退休年齡</th></tr></thead>
              <tbody>
                {goalEarliestAnswers(form.assetsEnabled, c.inp, scen, num(savingZ)).map(({ key, earliest: e }) => {
                  return (
                    <tr key={key}><th>{rowLabel(key)}</th>
                      <td>{e.type === "age" ? `${e.age} 歲` : e.type === "already" ? (e.lastsToLife ? "已退休，可撐到預期壽命" : "已退休，資產不足以撐到預期壽命") : "在目前假設下無法達成"}</td>
                    </tr>
                  );
                })}
              </tbody></table>
          </>
        )}
      </div>
    </div>
  );
}


function CompareCard({ c, form, unit }: { c: Computed; form: FormState; unit: Unit }) {
  const [years, setYears] = useState(String(paramValue("goalCompareYears")));
  const [singleAsset, setSingleAsset] = useState("voo");
  const scen = c.goalScen;
  const byId = Object.fromEntries(scen.scenarios.map((x) => [x.id, x])) as Record<ScenarioId, ScenarioOutcome>;
  const neuInp = byId.neutral?.inp ?? c.inp;
  const scenInf = Object.fromEntries(scen.scenarios.map((x) => [x.id, x.inflationPct])) as Record<ScenarioId, number>;
  const overrides = Object.fromEntries(Object.entries(form.returnOverrides).map(([k, rec]) => [k, Object.fromEntries(Object.entries(rec).map(([sid, v]) => [sid, num(v)])) as Record<ScenarioId, number>]));
  const nYears = Math.min(40, Math.max(1, num(years) || paramValue("goalCompareYears")));
  const compareRows = assetComparison(c.monthlyBalance, c.inp.initAssets, nYears, scenInf, overrides, num(form.fxChange));
  const allocSeries = (() => {
    if (scen.paused) return [];
    const mk = (alloc: Record<string, number>) => computeScenarios(c.inp, {
      allocation: alloc, retireAllocMode: form.retireAllocMode,
      retireAllocation: Object.fromEntries(Object.entries(form.retireAllocation).map(([k, v]) => [k, num(v)])),
      fxChangePct: num(form.fxChange), returnOverrides: overrides, scenarioInflation: scenInf,
      deductionPct: num(form.deduction),
    }).scenarios.find((x) => x.id === "neutral");
    const mine = byId.neutral;
    const single = mk({ [singleAsset]: 100 });
    const cash = mk({ cash: 100 });
    const pts = (o?: ScenarioOutcome) => (o ? o.res.rows.map((r) => ({ age: r.age, v: r.assets })) : []);
    return [
      { label: "我的配置（中性）", points: pts(mine), color: "#2e7d4f" },
      { label: `${ASSETS.find((a) => a.id === singleAsset)?.label ?? ""} 100%（中性）`, points: pts(single), color: "#3366aa", dash: "5 4" },
      { label: "定存 / 現金（中性）", points: pts(cash), color: "#c9a227", dash: "2 3" },
    ];
  })();
  const horizon = Math.max(1, c.inp.ageLife - c.inp.ageNow);
  const ppSeries = purchasingPowerSeries(1000000, c.inp.inflation, horizon);
  const ppAtRetire = nominalToReal(1000000, c.inp.inflation / 100, Math.max(0, c.inp.ageRetire - c.inp.ageNow));
  const variants = c.inp.social ? socialVariants(c.inp) : [];

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head"><h2>圖表比較</h2></div>
      <div className="card-body">
        <h3 style={{ margin: "6px 0" }}>各標的在假設報酬率下的資產比較</h3>
        <div style={{ maxWidth: 260 }}>
          <label htmlFor="cmpYears">比較年數 N（年，1–40）</label>
          <input id="cmpYears" type="number" inputMode="numeric" step="1" value={years} onChange={(e) => setYears(e.target.value)} />
        </div>
        <p className="note">假設每月結餘 100% 投入單一標的，{nYears} 年後資產（實質口徑，今日幣值）。</p>
        <AssetRangeBars rows={compareRows.map((r) => ({ label: r.label, cons: r.values.conservative, neu: r.values.neutral, opt: r.values.optimistic }))} unit={unit} />
        <details>
          <summary>標的比較資料表</summary>
          <table className="scen-table"><thead><tr><th>標的</th><th>保守</th><th>中性</th><th>樂觀</th></tr></thead>
            <tbody>{compareRows.map((r) => (
              <tr key={r.assetId}><th>{r.label}</th><td>{fmtNum(r.values.conservative, unit)}</td><td>{fmtNum(r.values.neutral, unit)}</td><td>{fmtNum(r.values.optimistic, unit)}</td></tr>
            ))}</tbody></table>
        </details>

        <h3 style={{ margin: "16px 0 6px" }}>配置的資產曲線比較（中性情境）</h3>
        <div style={{ maxWidth: 260 }}>
          <label htmlFor="cmpAsset">單一標的選擇</label>
          <select id="cmpAsset" value={singleAsset} onChange={(e) => setSingleAsset(e.target.value)}>
            {ASSETS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        {allocSeries.length ? <MultiLineChart series={allocSeries} unit={unit} /> : <p className="note">請先讓配置總和為 100%。</p>}

        <h3 style={{ margin: "16px 0 6px" }}>通膨影響對照</h3>
        <PurchasingPowerChart series={ppSeries} amount={1000000} unit={unit} />
        <p className="note">{Math.max(0, c.inp.ageRetire - c.inp.ageNow)} 年後的 100 萬（帳面金額），實際購買力相當於今天的 {fmtNum(ppAtRetire, unit)} {unitWord(unit)}（以通膨 {c.inp.inflation}% 計算）。</p>

        <h3 style={{ margin: "16px 0 6px" }}>勞保勞退影響對照</h3>
        {variants.length ? (
          <table className="scen-table"><thead><tr><th>情況</th><th>最早可退休年齡</th><th>資產耗盡年齡</th></tr></thead>
            <tbody>{variants.map((v) => (
              <tr key={v.key}><th>{v.label}</th>
                <td>{v.earliest.type === "age" ? `${v.earliest.age} 歲` : v.earliest.type === "already" ? "已退休" : "無法達成"}</td>
                <td>{v.exhaustAge === null ? `撐到 ${c.inp.ageLife} 歲` : `${v.exhaustAge} 歲耗盡`}</td></tr>
            ))}</tbody></table>
        ) : (
          <p className="note">未納入勞保與勞退，本對照不適用。</p>
        )}
        <p className="note">{COMPLIANCE}</p>
      </div>
    </div>
  );
}


const DCA_COLORS = ["#2e7d4f", "#3366aa", "#c9a227", "#8e44ad", "#d35400", "#00838f", "#6d4c41", "#5d6d7e"];

/** Phase 4 第六、七節：投資對照卡 + 常見 ETF 定期定額比較（共用同一組定期定額欄位） */
function InvestSection({ c, basis, unit }: { c: Computed; basis: Basis; unit: Unit }) {
  const [monthlyStr, setMonthlyStr] = useState("");
  const [stepStr, setStepStr] = useState("");
  const [yearsStr, setYearsStr] = useState(String(paramValue("dcaCompareYears")));
  const inp = c.inp;
  const monthly = monthlyStr.trim() === "" ? Math.max(0, Math.round(c.monthlyBalance)) : num(monthlyStr);
  const stepPct = stepStr.trim() === "" ? inp.salaryGrowth : num(stepStr);
  const years = Math.min(50, Math.max(1, Math.floor(num(yearsStr)) || paramValue("dcaCompareYears")));
  const cashRet = ASSET_MAP["cash"].returns.neutral.value;
  const cmp = useMemo(
    () => investCompare({ base: inp, monthlyStart: monthly, stepPct, cashRetPct: cashRet }),
    [inp, monthly, stepPct, cashRet]
  );
  const money = (v: number, t: number) => fmtMoney(v, t, inp.inflation, basis, unit);
  const workYears = Math.max(0, inp.ageRetire - inp.ageNow);
  const dyn = cmp.dyn;
  const dynStatement = stepPct > 0 ? (
    <>這個結果假設你的定期定額金額會隨薪水每年調高 {fmtRatePct(stepPct / 100)}：第 1 年每月 {fmtPlain(dyn.aMonthly)} 元 → 第 {dyn.years} 年每月約 {fmtPlain(Math.round(dyn.lastMonthlyNominal))} 元（今日幣值約 {fmtPlain(Math.round(dyn.lastMonthlyReal))} 元）。你必須真的每年跟著加碼，才會得到這個金額；如果金額一直不變，結果會是 {fmtPlain(Math.round(dyn.fixedRetireAssetsReal))} 元（今日幣值）／{fmtPlain(Math.round(dyn.fixedRetireAssetsNominal))} 元（帳面金額，含通膨）。</>
  ) : (
    <>這個結果假設你每月固定投入 {fmtPlain(dyn.aMonthly)} 元，不調高。</>
  );
  const earliestCell = (e: number | null) => (e === null ? "無法達成" : `${e} 歲`);
  const cellText = (cell: { retireAssets: number; earliest: number | null }) => (
    <>{money(cell.retireAssets, workYears)}<br /><span className="unit-hint">最早 {earliestCell(cell.earliest)} 可退休</span></>
  );

  const etfRows = ASSETS.map((a) => {
    const pair = dcaPair({ monthlyStart: monthly, stepPct, nominalReturnPct: a.returns.neutral.value, inflationPct: inp.inflation, years });
    const cons = dca({ monthlyStart: monthly, stepPct, nominalReturnPct: a.returns.conservative.value, inflationPct: inp.inflation, years });
    const opt = dca({ monthlyStart: monthly, stepPct, nominalReturnPct: a.returns.optimistic.value, inflationPct: inp.inflation, years });
    return { a, pair, cons, opt };
  });
  const pick = (real: number, nominal: number) => (basis === "nominal" ? nominal : real);
  const histText = (a: (typeof ASSETS)[number]): string =>
    a.histNote
      ? a.histNote
      : a.histAnnualPct !== null && a.histYears !== null
        ? `${fmtRatePct(a.histAnnualPct / 100)}（成立 ${a.histYears} 年，僅供參考）${a.histYears < 10 ? "；歷史太短，未經歷完整多空循環" : ""}${a.histExtra ? `；${a.histExtra}` : ""}`
        : "—";
  const chartSeries = etfRows.map((r, i) => ({
    label: r.a.id === "cash" ? "定存（基準）" : r.a.label,
    color: DCA_COLORS[i % DCA_COLORS.length],
    points: [{ age: 0, v: 0 }, ...r.pair.stepped.curve.map((pt) => ({ age: pt.t, v: pick(pt.valueReal, pt.valueNominal) }))],
  }));

  return (
    <>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>每月定期定額投資 vs 全部放定存</h2></div>
        <div className="card-body">
          <div className="grid2">
            <div>
              <label htmlFor="dcaMonthly">每月定期定額金額 <span className="unit-hint">（元，今日幣值）</span></label>
              <input id="dcaMonthly" type="number" inputMode="decimal" step="any" placeholder={String(Math.max(0, Math.round(c.monthlyBalance)))} value={monthlyStr} onChange={(e) => setMonthlyStr(e.target.value)} />
              <p className="note">留空＝使用目前每月結餘 {fmtPlain(Math.max(0, Math.round(c.monthlyBalance)))} 元。</p>
            </div>
            <div>
              <label htmlFor="dcaStep">每年調高幅度 <span className="unit-hint">（%，填 0 表示金額固定不變）</span></label>
              <input id="dcaStep" type="number" inputMode="decimal" step="any" placeholder={String(inp.salaryGrowth)} value={stepStr} onChange={(e) => setStepStr(e.target.value)} />
              <p className="note">留空＝使用薪資成長率 {fmtRatePct(inp.salaryGrowth / 100)}。</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="scen-table">
              <thead><tr><th></th><th>每年加碼</th><th>固定金額</th></tr></thead>
              <tbody>
                <tr><th>全部放定存（{fmtRatePct(cashRet / 100)}）</th><td>{cellText(cmp.cashStepped)}</td><td>{cellText(cmp.cashFixed)}</td></tr>
                <tr><th>大盤型 ETF 為主的組合（報酬率假設）</th><td>{cellText(cmp.marketStepped)}</td><td>{cellText(cmp.marketFixed)}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="note">同樣每月投入，大盤型 ETF 組合退休時比定存多約 {fmtNum(cmp.gapAssets, "wan")} 萬元{cmp.gapYears !== null && cmp.gapYears !== 0 ? `，最早可退休年齡早 ${cmp.gapYears} 歲` : ""}（假設值試算）。</p>
          <p className="note">越早開始差越多：如果晚 {cmp.delayYears} 年才開始投資（前 {cmp.delayYears} 年先放定存，之後才投資），退休時資產約少 {fmtNum(cmp.delayGapAssets, "wan")} 萬元。{cmp.delayIsHalf ? "（工作年數不到 10 年，這裡以晚一半年數計算。）" : ""}</p>
          <div className="callout">{dynStatement}</div>
          <p className="note">主畫面摘要用的是『收入 − 支出』的實際結餘，這張卡用你設定的定期定額金額，所以數字可能和上方略有不同。主畫面的模型是「每月結餘 = 收入（隨薪資成長）− 支出（今日幣值固定）」，結餘每年增加的幅度比薪資成長率快；定期定額模組則是「每月投入金額依你設定的幅度調高」，兩者口徑不同。</p>
          <p className="note">{COMPLIANCE}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>常見 ETF 每月定期定額 {years} 年試算比較</h2></div>
        <div className="card-body">
          <div style={{ maxWidth: 260 }}>
            <label htmlFor="dcaYears">試算年限 <span className="unit-hint">（年，1–50）</span></label>
            <input id="dcaYears" type="number" inputMode="numeric" step="1" value={yearsStr} onChange={(e) => setYearsStr(e.target.value)} />
          </div>
          <p className="note">每月金額與每年調高幅度使用上方投資對照卡的同一組欄位（每月 {fmtPlain(monthly)} 元、每年調高 {fmtRatePct(stepPct / 100)}）。</p>
          <div className="callout">{dynStatement}</div>
          <p className="note">試算一律使用本站的假設報酬（推算邏輯見 PARAMETERS.md），不是各 ETF 的歷史報酬；歷史報酬欄只是參考，成立時間短的參考價值更低。</p>
          <p className="note">{COMPLIANCE}</p>
          <div className="table-scroll etf-table-wrap">
            <table className="scen-table etf-table">
              <thead><tr>
                <th>名稱</th><th>類型</th><th><span className="ph">成立</span><br className="print-br" /><span className="ph">年份</span></th><th><span className="ph">總費用率</span><br className="print-br" /><span className="ph">（2025 年度）</span></th><th><span className="ph">中性假設</span><br className="print-br" /><span className="ph">年化報酬</span></th>
                <th><span className="ph">累積投入本金</span><br className="print-br" /><span className="ph">（{basis === "nominal" ? "帳面金額，含通膨" : "今日幣值"}）</span></th><th><span className="ph">{years} 年後</span><br className="print-br" /><span className="ph">（每年加碼）</span></th><th><span className="ph">{years} 年後</span><br className="print-br" /><span className="ph">（固定金額）</span></th>
                <th><span className="ph">保守–樂觀區間</span><br className="print-br" /><span className="ph">（每年加碼）</span></th><th><span className="ph">成立以來實際</span><br className="print-br" /><span className="ph">含息年化</span><br className="print-br" /><span className="ph">（參考）</span></th><th>風險提示</th>
              </tr></thead>
              <tbody>
                {etfRows.map(({ a, pair, cons, opt }) => (
                  <tr key={a.id}>
                    <th>{a.id === "cash" ? <><span className="ph">定存</span><br className="print-br" /><span className="ph">（基準）</span></> : a.label}</th>
                    <td>{a.category}</td>
                    <td>{a.inceptionDate ? a.inceptionDate.slice(0, 4) : "—"}</td>
                    <td>{a.expenseRatioPct !== null ? `${a.expenseRatioPct}%` : "—"}</td>
                    <td>{fmtRatePct(a.returns.neutral.value / 100)}</td>
                    <td>{fmtNum(pick(pair.stepped.principalReal, pair.stepped.principalNominal), unit)}</td>
                    <td>{fmtNum(pick(pair.stepped.fvReal, pair.stepped.fvNominal), unit)}</td>
                    <td>{fmtNum(pick(pair.fixed.fvReal, pair.fixed.fvNominal), unit)}</td>
                    <td><span className="ph">{fmtNum(pick(cons.fvReal, cons.fvNominal), unit)}</span> – <span className="ph">{fmtNum(pick(opt.fvReal, opt.fvNominal), unit)}</span></td>
                    <td>{histText(a)}</td>
                    <td className="risk-cell">{a.riskNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="print-only">
            <p className="note">註（風險提示全文）：{etfRows.map(({ a }) => `${a.id === "cash" ? "定存（基準）" : a.label}：${a.riskNote.replace(/。$/, "")}`).join("；")}。</p>
          </div>
          <div className="etf-cards" role="list">
            {etfRows.map(({ a, pair, cons, opt }) => (
              <article className="etf-card" role="listitem" key={a.id}>
                <div className="etf-card-head">
                  <h4>{a.id === "cash" ? "定存（基準）" : a.label} <span className="tag-chip">{a.category.replace("（產業集中）", "")}</span></h4>
                  <span className="unit-hint">{a.inceptionDate ? `成立 ${a.inceptionDate.slice(0, 4)} 年` : ""}</span>
                </div>
                <div className="etf-card-main">
                  <span className="etf-card-amount">{fmtNum(pick(pair.stepped.fvReal, pair.stepped.fvNominal), unit)} {unitWord(unit)}</span>
                  <span className="unit-hint">（{years} 年後，每年加碼）</span>
                </div>
                <p className="etf-card-sub"><span className="ph">固定金額：{fmtNum(pick(pair.fixed.fvReal, pair.fixed.fvNominal), unit)} {unitWord(unit)}</span><br /><span className="ph">區間 {fmtNum(pick(cons.fvReal, cons.fvNominal), unit)} – {fmtNum(pick(opt.fvReal, opt.fvNominal), unit)} {unitWord(unit)}</span></p>
                <details className="etf-more">
                  <summary>更多資訊</summary>
                  <div className="etf-card-grid">
                    <div><span>中性假設年化報酬</span><strong>{fmtRatePct(a.returns.neutral.value / 100)}</strong></div>
                    <div><span>總費用率</span><strong>{a.expenseRatioPct !== null ? `${a.expenseRatioPct}%` : "—"}</strong></div>
                    <div><span>累積投入本金</span><strong>{fmtNum(pick(pair.stepped.principalReal, pair.stepped.principalNominal), unit)} {unitWord(unit)}</strong></div>
                  </div>
                  <p className="note">成立以來實際含息年化（參考）：{histText(a)}</p>
                  <p className="note">風險提示：{a.riskNote}</p>
                </details>
              </article>
            ))}
          </div>
          <p className="note">金額單位：{unitWord(unit)}（{basis === "nominal" ? "帳面金額，含通膨" : "今日幣值"}）。</p>
          <div className="chart-block">
          <h3 style={{ margin: "14px 0 6px" }}>累積曲線（中性、每年加碼）</h3>
          <div className="legend">
            {chartSeries.map((s) => <span key={s.label}><i className="sw" style={{ background: s.color }} />{s.label}</span>)}
          </div>
          <MultiLineChart series={chartSeries} unit={unit} />
          </div>
          <h3 style={{ margin: "16px 0 6px" }}>為什麼大盤型 ETF 常被拿來定期定額</h3>
          <p className="note">大盤型（市值型）ETF 一次買進一整個市場的大型公司，不用自己選股，成分股會定期調整，內扣費用通常也比較低。定期定額是每個月固定投入，漲的時候買到的單位少、跌的時候買到的單位多，不用猜進場時間。短期一定會遇到下跌，有時跌幅很大；長期持有、持續投入，才有機會接近長期平均報酬，但沒有任何保證，也可能虧損。高股息型和產業集中型 ETF 各有不同的風險與成本，請看各檔的風險提示（列印版在表格下方）。</p>
          <p className="note">{COMPLIANCE}</p>
        </div>
      </div>
    </>
  );
}

function ReturnsCard({ form, set, validation, onResetAssumptions }: {
  form: FormState; set: (patch: Partial<FormState>) => void;
  validation: ValidationResult; onResetAssumptions: () => void;
}) {
  const resetAssumptions = onResetAssumptions;
  return (
    <div className="card">
      <div className="card-head"><h2>報酬率假設</h2></div>
      <div className="card-body">
      <p className="note" style={{ marginTop: 6 }}>預設值為假設，請自行查證後調整。以下數字都是「假設值」，不是對未來的預測。</p>
      <p className="note">{INFLATION_FIXED_NOTE}</p>
      <div className="grid2">
        <div><label htmlFor="retPre">退休前投資每年報酬率（假設值，含通膨） <span className="unit-hint">（%／年）</span></label><input id="retPre" type="number" inputMode="decimal" step="any" value={form.retPre} onChange={(e) => set({ retPre: e.target.value })} /></div>
        <div><label htmlFor="retPost">退休後投資每年報酬率（假設值，含通膨） <span className="unit-hint">（%／年）</span></label><input id="retPost" type="number" inputMode="decimal" step="any" value={form.retPost} onChange={(e) => set({ retPost: e.target.value })} /></div>
      </div>
      <p className="note">實質報酬率<span className="q" tabIndex={0} data-tip="扣掉通膨後的報酬率，算法是 (1＋含通膨報酬率) ÷ (1＋通膨率) − 1，不能直接用相減。">?</span>會依通膨（固定 2%）自動換算，不需另外輸入。</p>
      <p className="msg">{[...validation.assumpErrors, ...validation.warnings].map((m, i) => <span key={i}>{m}<br /></span>)}</p>
      {Number.isFinite(num(form.retPost)) && Number.isFinite(num(form.retPre)) && num(form.retPost) > num(form.retPre) && (
        <p className="soft-hint show">目前退休後報酬假設（{form.retPost}%）高於退休前（{form.retPre}%），請確認這是你的意思。</p>
      )}
      <div>
        <button type="button" className="ghost small" onClick={resetAssumptions}>還原預設值</button>
        <span className="note">（投資報酬 {paramValue("retPre")}%、退休後報酬 {paramValue("retPost")}%、薪資成長 {paramValue("salaryGrowth")}%）</span>
      </div>
    </div>
  </div>
  );
}

function AssetsCard({ form, set }: { form: FormState; set: (patch: Partial<FormState>) => void }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head"><h2>投資標的：看看長期投資大盤型 ETF 能讓你提早幾年退休（選用）</h2></div>
      <div className="card-body">
      <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
        <input type="checkbox" checked={form.assetsEnabled} onChange={(e) => set({ assetsEnabled: e.target.checked })} />
        啟用後用下面的配置跑三種情境；關閉時使用上面『報酬率假設』的單一報酬率
      </label>
      {form.assetsEnabled && (
        <>
          <p className="note">各標的報酬率皆為「假設值，非預測」，推算邏輯與來源見設定檔（每個欄位的來源欄）與 PARAMETERS.md。提到標的名稱只作為常見例子。美元計價標的（VOO、QQQ、美國公債）換算成新台幣報酬時只套用一次匯率調整；新台幣計價標的不套用。組合報酬率以每年固定比例再平衡簡化。三種情境的通膨率固定為保守 2.5%、中性 2%、樂觀 1.5%。</p>
          <p className="note">{COMPLIANCE}</p>
          <div className="grid2">
            <div>
              <label htmlFor="fxChange">新台幣對美元年變動率 <span className="unit-hint">（%／年）</span></label>
              <input id="fxChange" type="number" inputMode="decimal" step="any" value={form.fxChange} onChange={(e) => set({ fxChange: e.target.value })} />
              <p className="note">正值＝新台幣升值，美元資產換回新台幣的報酬變差；負值＝新台幣貶值，報酬變好。</p>
            </div>
          </div>

          <h3 style={{ margin: "14px 0 6px" }}>退休前配置（%）</h3>
          <div className="no-print" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {ALLOCATION_PRESETS.map((pr) => (
              <button key={pr.id} type="button" className="ghost small"
                onClick={() => set({ allocation: Object.fromEntries(ASSETS.map((a) => [a.id, String(pr.alloc[a.id] ?? 0)])) })}>
                {pr.label}
              </button>
            ))}
          </div>
          <table className="alloc-table"><tbody>
            {ASSETS.map((a) => (
              <tr key={a.id}>
                <td style={{ minWidth: 170 }}>
                  <b>{a.label}</b> <span className="unit-hint">{a.currency === "USD" ? "美元計價" : "新台幣計價"}</span>
                  <span className="risk">{a.riskNote}</span>
                </td>
                {SCENARIO_IDS.map((sid) => (
                  <td key={sid}>
                    <label className="unit-hint" htmlFor={`ret-${a.id}-${sid}`}>{SCENARIO_LABELS[sid]}報酬%</label>
                    <input id={`ret-${a.id}-${sid}`} type="number" inputMode="decimal" step="any"
                      value={form.returnOverrides[a.id]?.[sid] ?? ""}
                      onChange={(e) => set({ returnOverrides: { ...form.returnOverrides, [a.id]: { ...form.returnOverrides[a.id], [sid]: e.target.value } } })} />
                  </td>
                ))}
                <td>
                  <label className="unit-hint" htmlFor={`alloc-${a.id}`}>配置%</label>
                  <input id={`alloc-${a.id}`} type="number" inputMode="decimal" step="any"
                    value={form.allocation[a.id] ?? "0"}
                    onChange={(e) => set({ allocation: { ...form.allocation, [a.id]: e.target.value } })} />
                </td>
              </tr>
            ))}
          </tbody></table>
          {(() => {
            const total = ASSETS.reduce((sum, a) => sum + num(form.allocation[a.id] ?? "0"), 0);
            const concPct = num(form.allocation["qqq"] ?? "0");
            return (
              <>
                <p className="note" aria-live="polite">配置總和：{fmtPlain(Math.round(total * 10) / 10)}%{Math.abs(total - 100) >= 1e-9 ? `（還差 ${fmtPlain(Math.round((100 - total) * 10) / 10)}%，總和為 100% 前暫停計算）` : ""}</p>
                {concPct > paramValue("concentrationWarnPct") && concPct <= paramValue("concentrationStrongPct") && (
                  <p className="soft-hint show">集中風險提醒：QQQ 配置已超過 {paramValue("concentrationWarnPct")}%。QQQ 屬於產業集中型 ETF，配置比例高時波動會明顯放大。</p>
                )}
                {concPct > paramValue("concentrationStrongPct") && (
                  <p className="soft-hint show warn-strong">集中風險提醒（明確）：QQQ 配置已超過 {paramValue("concentrationStrongPct")}%。QQQ 屬於產業集中型 ETF，配置比例高時波動會明顯放大，請確認這是你的意思（不會阻止你繼續試算）。</p>
                )}
              </>
            );
          })()}

          <h3 style={{ margin: "14px 0 6px" }}>退休後配置</h3>
          <div className="seg" role="group" aria-label="退休後配置模式">
            <button type="button" aria-pressed={form.retireAllocMode === "same"} onClick={() => set({ retireAllocMode: "same" })}>與退休前相同</button>
            <button type="button" aria-pressed={form.retireAllocMode === "custom"} onClick={() => set({ retireAllocMode: "custom" })}>另一組配置</button>
          </div>
          {form.retireAllocMode === "same" ? (
            <div style={{ marginTop: 8, maxWidth: 320 }}>
              <label htmlFor="deduction">退休後保守折減 <span className="unit-hint">（百分點，下限為同情境定存報酬率）</span></label>
              <input id="deduction" type="number" inputMode="decimal" step="any" value={form.deduction} onChange={(e) => set({ deduction: e.target.value })} />
            </div>
          ) : (
            <table className="alloc-table" style={{ marginTop: 8 }}><tbody>
              {ASSETS.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.label}</b></td>
                  <td>
                    <label className="unit-hint" htmlFor={`ralloc-${a.id}`}>退休後配置%</label>
                    <input id={`ralloc-${a.id}`} type="number" inputMode="decimal" step="any"
                      value={form.retireAllocation[a.id] ?? "0"}
                      onChange={(e) => set({ retireAllocation: { ...form.retireAllocation, [a.id]: e.target.value } })} />
                  </td>
                </tr>
              ))}
            </tbody></table>
          )}
        </>
      )}
    </div>
  </div>
  );
}

/** 「怎麼改善」分頁最上方：無法達成時的方向說明＋每月多存多少（自舊版結果卡搬移） */
function ImproveNote({ c }: { c: Computed }) {
  const scen = c.scenarios && !c.scenarios.paused ? c.scenarios : null;
  if (scen) {
    const neu = scen.scenarios.find((x) => x.id === "neutral")!;
    if (neu.earliest.type !== "none") return null;
    const extra = findExtraSavingForEarliest(neu.inp);
    return (
      <div className="note" style={{ marginBottom: 12 }}>
        <p style={{ margin: "0 0 6px" }}>中性情境下最早可退休年齡無法達成。可以調整的方向包括：提高每月儲蓄、延後退休年齡、降低退休後支出、調整報酬假設值。</p>
        {extra?.found && (
          <p style={{ margin: 0 }}>用試算結果來看：若每月多存 {fmtPlain(extra.extraMonthly)} 元（今日幣值），中性情境下最早可於 {extra.earliestAge} 歲退休（其餘假設不變）。</p>
        )}
      </div>
    );
  }
  const { earliest } = c;
  if (earliest.type === "already") {
    return <p className="note" style={{ marginBottom: 12 }}>{earliestText(earliest, c.inp.ageLife).sub}。</p>;
  }
  if (earliest.type !== "none") return null;
  return (
    <div className="note" style={{ marginBottom: 12 }}>
      <p style={{ margin: "0 0 6px" }}>最早可退休年齡：在目前假設下無法達成。可以調整的方向包括：提高每月儲蓄、延後退休年齡、降低退休後支出、調整報酬假設值。</p>
      {c.extraSolution?.found ? (
        <p style={{ margin: 0 }}>用試算結果來看：若每月多存 {fmtPlain(c.extraSolution.extraMonthly)} 元（今日幣值），最早可於 {c.extraSolution.earliestAge} 歲退休（其餘假設不變）。</p>
      ) : c.extraSolution ? (
        <p style={{ margin: 0 }}>用試算結果來看：即使每月多存到月收入的 {paramValue("solverMaxExtraMultiple")} 倍，在目前其他假設下仍無法於 {paramValue("earliestRetirementCap")} 歲前達成，需要同時調整其他方向（例如降低退休後支出或延後預期退休安排）。</p>
      ) : null}
    </div>
  );
}

const RESULT_TABS = [
  { id: "improve", label: "怎麼改善" },
  { id: "dca", label: "定期定額學習" },
  { id: "advanced", label: "進階設定" },
  { id: "details", label: "明細與說明" },
];

export interface ResultsPageProps {
  c: Computed | null;
  formDb: FormState;
  formLive: FormState;
  set: (patch: Partial<FormState>) => void;
  validation: ValidationResult;
  basis: Basis; unit: Unit;
  setBasis: (b: Basis) => void; setUnit: (u: Unit) => void;
  stale: boolean;
  exampleActive: boolean;
  onClearAmounts: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  importMsg: string;
  onCsv: () => void;
  onGoStep: (n: number) => void;
  onOpenHowTo: () => void;
  onResetAssumptions: () => void;
}

export default function ResultsPage(p: ResultsPageProps) {
  const [tab, setTab] = useState("improve");
  const fileRef = useRef<HTMLInputElement>(null);
  const c = p.c;
  if (!c) {
    return <div className="card"><div className="card-body"><p className="note">請先修正前面步驟的提示，再查看試算結果。</p></div></div>;
  }
  const scen = c.scenarios;
  const scenActive = !!(scen && !scen.paused);
  const neu = scenActive ? scen!.scenarios.find((x) => x.id === "neutral")! : null;
  const activeRes = neu ? neu.res : c.res;
  const conclusion = plainConclusion({
    earliest: neu ? neu.earliest : c.earliest,
    res: activeRes,
    retireAge: c.inp.ageRetire, lifeExpectancy: c.inp.ageLife,
    cap: paramValue("earliestRetirementCap"), scenario: !!neu,
    finalAssetsText: activeRes.exhaustAge === null
      ? fmtMoney(activeRes.finalAssets, c.inp.ageLife - c.inp.ageNow, neu ? neu.inflationPct : c.inp.inflation, p.basis, p.unit)
      : undefined,
  });
  const socialStatusText = p.formDb.laborInsured === "no"
    ? "勞保：沒有"
    : p.formDb.laborInsured === "unsure"
      ? "勞保：不確定（依估算）"
      : p.formDb.socialInputMode === "manual"
        ? "勞保：有（自行填寫）"
        : "勞保：有（依年齡和薪水估算）";
  const panelCls = (id: string) => `tab-panel${tab === id ? "" : " tab-hidden"}`;

  return (
    <>
      {p.exampleActive && (
        <div className="example-banner no-print">
          <span>這是範例（30 歲、實領月薪 5 萬、剛開始工作），請改成你自己的數字。</span>
          <button type="button" className="ghost small" style={{ background: "transparent" }} onClick={p.onClearAmounts}>一鍵清空金額</button>
        </div>
      )}
      {p.stale && <p className="stale-banner show">目前輸入有需要修正的地方，以下顯示的是上一次有效輸入的結果。</p>}

      <p className="conclusion-line">{conclusion}</p>
      {p.formDb.laborInsured === "unsure" && c.inp.social && (
        <p className="callout">此結果含估計的勞保勞退，要準確請到勞保局查。<button type="button" className="ghost small" style={{ marginLeft: 8 }} onClick={p.onOpenHowTo}>怎麼查？</button></p>
      )}
      {p.formDb.laborInsured === "yes" && p.formDb.socialInputMode === "estimate" && c.inp.social && (
        <p className="note">勞保勞退是用你的年齡和薪水估的。<button type="button" className="ghost small" style={{ marginLeft: 6 }} onClick={p.onOpenHowTo}>怎麼查？</button></p>
      )}

      <div className="toggle-row no-print" style={{ marginTop: 12 }}>
        <span><span className="tg-label">金額口徑</span>
          <span className="seg" role="group" aria-label="金額口徑">
            <button type="button" aria-pressed={p.basis === "real"} onClick={() => p.setBasis("real")}>今日幣值（用今天的物價換算）</button>
            <button type="button" aria-pressed={p.basis === "nominal"} onClick={() => p.setBasis("nominal")}>帳面金額，含通膨</button>
          </span></span>
        <span><span className="tg-label">顯示單位</span>
          <span className="seg" role="group" aria-label="顯示單位">
            <button type="button" aria-pressed={p.unit === "wan"} onClick={() => p.setUnit("wan")}>萬元</button>
            <button type="button" aria-pressed={p.unit === "yuan"} onClick={() => p.setUnit("yuan")}>元</button>
          </span></span>
      </div>
      <p className="note">今日幣值是把未來的錢換成今天的物價，方便跟現在的生活費比較；帳面金額，含通膨是未來當時的金額，數字會看起來比較大。</p>

      {scen && scen.paused ? (
        <div className="card" style={{ marginTop: 16 }}><div className="card-body">
          <p className="range-line">請先讓配置總和為 100%</p>
          <p className="note">目前配置總和為 {fmtPlain(Math.round(scen.allocationTotalPct * 10) / 10)}%，在總和達到 100% 前暫停計算，不會用不完整的配置繼續算。</p>
        </div></div>
      ) : scenActive ? (
        <ScenarioMain c={c} scen={scen!} basis={p.basis} unit={p.unit} />
      ) : (
        <BaseMain c={c} basis={p.basis} unit={p.unit} />
      )}

      <div style={{ marginTop: 20 }}>
        <Tabs tabs={RESULT_TABS} active={tab} onChange={setTab} />
        <div className={panelCls("improve")} role="tabpanel" id="panel-improve" aria-labelledby="tab-improve">
          <h3 className="tab-print-title">怎麼改善</h3>
          <ImproveNote c={c} />
          <GoalsCard c={c} form={p.formDb} />
        </div>
        <div className={panelCls("dca")} role="tabpanel" id="panel-dca" aria-labelledby="tab-dca">
          <h3 className="tab-print-title">定期定額學習</h3>
          <InvestSection c={c} basis={p.basis} unit={p.unit} />
        </div>
        <div className={panelCls("advanced")} role="tabpanel" id="panel-advanced" aria-labelledby="tab-advanced">
          <h3 className="tab-print-title">進階設定</h3>
          <ReturnsCard form={p.formLive} set={p.set} validation={p.validation} onResetAssumptions={p.onResetAssumptions} />
          <AssetsCard form={p.formLive} set={p.set} />
          <p className="note" style={{ marginTop: 12 }}>預期壽命在<button type="button" className="linklike step-link" onClick={() => p.onGoStep(1)}>步驟 ① 關於你</button>、薪資調幅在<button type="button" className="linklike step-link" onClick={() => p.onGoStep(2)}>步驟 ② 每個月的錢</button>、勞保勞退的細項在<button type="button" className="linklike step-link" onClick={() => p.onGoStep(3)}>步驟 ③ 勞保勞退與其他收入</button>的『進階』裡。</p>
        </div>
        <div className={panelCls("details")} role="tabpanel" id="panel-details" aria-labelledby="tab-details">
          <h3 className="tab-print-title">明細與說明</h3>
          <BaseDetails c={c} basis={p.basis} unit={p.unit} onCsv={p.onCsv} socialStatusText={socialStatusText} />
          {scenActive && <ScenarioYearly c={c} scen={scen!} basis={p.basis} unit={p.unit} />}
          <CompareCard c={c} form={p.formDb} unit={p.unit} />
        </div>
      </div>

      <div className="card no-print save-row" style={{ marginTop: 20 }}>
        <div className="card-body" style={{ paddingTop: 16 }}>
          <div className="actions">
            <button type="button" className="ghost" onClick={p.onExport}>匯出設定檔（JSON）</button>
            <span className="file-pick">
              <span className="file-pick-name">匯入設定檔</span>
              <input ref={fileRef} type="file" accept="application/json" aria-label="匯入設定檔"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onImport(f); e.target.value = ""; }} />
            </span>
            <button type="button" className="ghost" onClick={() => window.print()}>列印 / 另存 PDF</button>
          </div>
          <p className="note">匯出與匯入都是你主動點按才會發生的操作；本頁不會自動儲存任何資料。匯出的設定檔只含你輸入的數字，不含試算結果。</p>
          {p.importMsg && <p className="msg show">{p.importMsg}</p>}
        </div>
      </div>

      <footer className="disclaimer">
        <h2>免責聲明</h2>
        <p>{DISCLAIMER_FULL}</p>
      </footer>
    </>
  );
}
