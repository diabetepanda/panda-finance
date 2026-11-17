# PARAMETERS.md｜參數完整清單（Phase 4 更新）

查證日 2026-11-17。制度參數（勞保、勞退）已依官方來源逐項核對；報酬率為依「Phase 4 推算邏輯」推得的假設值（見下方說明與各列 source）；其餘為範例值／假設值／系統設定／設計門檻，依欄位標示。本表由設定檔自動對照產生，內容與 config/ 一致。

## Phase 4 報酬率推算邏輯（原文）

- 全站通膨固定 2%。股票類名目報酬 ≈ 長期實質報酬假設 + 2% 通膨；中性值取「機構前瞻預估」和「長期歷史」之間、偏保守的位置，不用近十年的牛市報酬。
- 美元標的報酬以美元計，匯率另外由 fxChange 處理（維持 0）。
- 報酬率都視為已扣內扣費用後的淨報酬。
- 債券取目前殖利率附近、略保守。定存取二年期定存利率。
- 產業集中型（QQQ）中性值只比大盤略高，區間放寬；高股息型中性值不高於同市場的大盤型（費用率較高、週轉率較高、成長性較低）。
- 成立未滿 30 年的 ETF（本站全部 ETF 都是），試算一律用這套邏輯推得的假設報酬，不直接外推該 ETF 自己的歷史報酬。
- retPre（退休前單一報酬率）6.5%：定義為「大盤型 ETF 為主、搭配少量債券（約股 8：債 2）的組合」：0.8×7 + 0.2×4.5 = 6.5。retPost 4.5%：退休後降低股票比重，6.5 − 退休後保守折減 2 = 4.5，與標的模式的折減規則一致。

## ETF 挑選依據

- 台股：集保受益人數前四名的指數型 ETF（截至 2026-11-13）：0050 3,956,621 人、0056 1,793,935 人、00878 1,774,723 人、00919 1,523,591 人。來源 MoneyDJ 台股ETF受益人數排行（資料來源集保結算所）https://www.moneydj.com/etf/x/rank/rank0016.xdjhtm 。第 5、6 名為 2026 年才掛牌的 009816 與主動式 ETF 00981A，因為成立太短或屬於主動式，不納入。
- 美股：凱基證券統計，國人美股定期定額最熱門的 ETF 依序為 VOO、QQQ、VT、SPY（2026-10-15，鉅亨網）https://news.cnyes.com/news/id/6630962 ；凱基證券 9 月未成年戶美股定期定額榜 VOO 第一、QQQ 第二（工商時報 2026-11-11）https://www.ctee.com.tw/news/20261111701107-430403
- 006208（富邦台50）追蹤同一個臺灣50指數，試算結果與 0050 幾乎相同，所以不另列；0050 的說明已註明「同指數的 006208 試算結果相同」。

## Phase 4 參數異動

- 新值：0050 4／7／10（舊 5／7／9）、VOO 4.5／7／9（舊 5／7／9）、QQQ 3／7.5／11（舊 6／9／11）、0056 3.5／6／8.5（舊 4／6／8）、00878 3.5／6／8.5（新增）、00919 3／6／8.5（新增）、美國公債 3／4.5／5（舊 2.5／4／5）、定存／現金 1.2／1.7／2（舊 1／1.5／2）、retPre 6.5（舊 6）、retPost 4.5（舊 4）、保守情境通膨 2.5（舊 3）。
- 新增參數：dcaCompareYears（定期定額比較年限，預設 30 年）；otherRetireIncome 新增「幫我估」小幫手（core/otherIncome.ts 加總，欄位本身不變）。
- 刪除參數：categoryInflationMedicalSuggested（UI 已不用）、個股標的三組報酬率（標的清單不再列個股）。
- 通膨改為固定假設：inflation 參數保留於設定檔（2%），UI 不再提供輸入；三情境通膨固定 2.5／2／1.5。

## 一、基本與假設參數（config/defaults.ts）

| 參數 | id | 預設值 | 單位 | 範圍 | source | updatedAt |
|---|---|---|---|---|---|---|
| 現在年齡 | ageNow | 30 | 歲 | 18–80 | 範例值（使用者應改成自己的數字） | 2026-11-17 |
| 預計退休年齡 | ageRetire | 65 | 歲 | 18–100 | 範例值（使用者應改成自己的數字） | 2026-11-17 |
| 預期壽命 | ageLife | 85 | 歲 | 19–110 | 使用者輸入，預設為假設值。參考：內政部 114年簡易生命表，國人平均壽命 81.27 歲（男 77.93、女 84.75）https://www.moi.gov.tw/News_Content.aspx?n=4&s=340439 。預設 85 歲比平均壽命長，是為了反映長壽風險。 | 2026-11-17 |
| 目前已有可投資資產 | initAssets | 0 | 元 | 0–1,000,000,000 | 範例值（使用者應改成自己的數字） | 2026-11-17 |
| 其他退休收入（勞保、勞退以外） | otherRetireIncome | 0 | 元/月 | 0–100,000,000 | 範例值（使用者應改成自己的數字） | 2026-11-17 |
| 月收入（稅後實領） | monthlyIncome | 50,000 | 元/月 | 0–100,000,000 | 範例值（使用者應改成自己的數字） | 2026-11-17 |
| 預期薪資年成長率（名目） | salaryGrowth | 2.5 | %/年 | -50–100 | 假設值（非預測），使用者應依自身情況調整。 | 2026-11-17 |
| 開始全職工作的年齡 | startWorkAge | 30 | 歲 | 15–80 | 範例值（使用者應改成自己的數字） | 2026-11-17 |
| 通膨率 | inflation | 2 | %/年 | -10–50 | 假設值。參考：主計總處 CPI 年增率 113年 2.18%（https://www.dgbas.gov.tw/News_Content.aspx?n=3602&s=234403 ）、114年 1.66%（https://www.stat.gov.tw/News_Content.aspx?n=3703&s=235723 ）、115年1–10月平均 1.98%（https://www.stat.gov.tw/News_Content.aspx?n=3703&s=236836 ）；中央銀行〈本行貨幣政策相關議題之說明：2%通膨率是國際間主要央行的通膨警戒線？〉（2024-06-12）https://knowledge.cbc.gov.tw/front/references/inpage/76367BD1-3029-EF11-9108-00505694F3B3 ，表示通膨率中長期平均 2% 左右可以接受。 | 2026-11-17 |
| 退休前投資每年報酬率（假設值，含通膨） | retPre | 6.5 | %/年 | -50–100 | 假設值（非預測），使用者應依自身情況調整。 | 2026-11-17 |
| 退休後投資每年報酬率（假設值，含通膨） | retPost | 4.5 | %/年 | -50–100 | 假設值（非預測），使用者應依自身情況調整。 | 2026-11-17 |
| 退休後月支出預設比例 | retireSpendRatio | 75 | % | 0–200 | 假設值（非預測），使用者應依自身情況調整。 | 2026-11-17 |
| 最早可退休年齡試算上限 | earliestRetirementCap | 75 | 歲 | 60–100 | 系統設定（演算法參數，非官方數值） | 2026-11-17 |
| 資產耗盡判定容許誤差 | exhaustTolerance | 0.5 | 元 | 0–100 | 系統設定（演算法參數，非官方數值） | 2026-11-17 |
| 輸入重算延遲 | debounceMs | 200 | 毫秒 | 150–250 | 系統設定（演算法參數，非官方數值） | 2026-11-17 |
| 反推搜尋最大迭代次數 | solverMaxIterations | 60 | 次 | 1–200 | 系統設定（演算法參數，非官方數值） | 2026-11-17 |
| 額外儲蓄搜尋上限倍數 | solverMaxExtraMultiple | 2 | 倍（月收入） | 1–10 | 系統設定（演算法參數，非官方數值） | 2026-11-17 |
| 新台幣對美元年變動率 | fxChange | 0 | %/年 | -20–20 | 假設值（非預測），使用者應依自身情況調整。 | 2026-11-17 |
| 退休後報酬保守折減 | retireReturnDeduction | 2 | 百分點 | 0–10 | 假設值（非預測），使用者應依自身情況調整。 | 2026-11-17 |
| 保守情境通膨率 | scenarioInflationConservative | 2.5 | %/年 | -10–50 | 假設值（情境設定）。近三年 CPI 都在 2.2% 以下，央行中長期約 2%；保守情境取 2.5%，多抓 0.5 個百分點的緩衝。 | 2026-11-17 |
| 中性情境通膨率 | scenarioInflationNeutral | 2 | %/年 | -10–50 | 假設值。參考：主計總處 CPI 年增率 113年 2.18%（https://www.dgbas.gov.tw/News_Content.aspx?n=3602&s=234403 ）、114年 1.66%（https://www.stat.gov.tw/News_Content.aspx?n=3703&s=235723 ）、115年1–10月平均 1.98%（https://www.stat.gov.tw/News_Content.aspx?n=3703&s=236836 ）；中央銀行〈本行貨幣政策相關議題之說明：2%通膨率是國際間主要央行的通膨警戒線？〉（2024-06-12）https://knowledge.cbc.gov.tw/front/references/inpage/76367BD1-3029-EF11-9108-00505694F3B3 ，表示通膨率中長期平均 2% 左右可以接受。 | 2026-11-17 |
| 樂觀情境通膨率 | scenarioInflationOptimistic | 1.5 | %/年 | -10–50 | 假設值（情境設定）。近三年 CPI 都在 2.2% 以下，央行中長期約 2%；保守情境取 2.5%，多抓 0.5 個百分點的緩衝。 | 2026-11-17 |
| 產業集中型 ETF 集中提醒門檻（QQQ） | concentrationWarnPct | 30 | % | 0–100 | 設計門檻（提醒用，非官方數值） | 2026-11-17 |
| 產業集中型 ETF 強提醒門檻（QQQ） | concentrationStrongPct | 50 | % | 0–100 | 設計門檻（提醒用，非官方數值） | 2026-11-17 |
| 標的比較年數 | goalCompareYears | 20 | 年 | 1–40 | 系統設定（演算法參數，非官方數值） | 2026-11-17 |
| 反推容許誤差比例 | goalToleranceRatio | 0.1 | % | 0–10 | 系統設定（演算法參數，非官方數值） | 2026-11-17 |
| 定期定額比較年限 | dcaCompareYears | 30 | 年 | 1–50 | 系統設定（演算法參數，非官方數值） | 2026-11-17 |

## 二、標的報酬率與標的資料（config/assets.ts）

| 標的 | 情境 | 報酬率（%/年） | source | updatedAt |
|---|---|---|---|---|
| 0050 | 保守 | 4 | 假設值（非預測），依 Phase 4 推算邏輯：前瞻預估中，新興市場股票 J.P. Morgan 7.8%、Vanguard 3.7–5.7%；0050 成立以來 14.07% 主要來自少數權值股大漲，不外推。中性 7 與美股大盤相同，區間比 VOO 寬，反映單一市場和成分股集中風險。J.P. Morgan 2026 Long-Term Capital Market Assumptions https://am.jpmorgan.com/us/en/asset-management/institutional/about-us/media/press-releases/jp-morgan-releases-2026-long-term-capital-market-assumptions/ ；Vanguard Capital Markets Model https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/vemo-return-forecasts.html；MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 | 2026-11-17 |
| 0050 | 中性 | 7 | 假設值（非預測），依 Phase 4 推算邏輯：前瞻預估中，新興市場股票 J.P. Morgan 7.8%、Vanguard 3.7–5.7%；0050 成立以來 14.07% 主要來自少數權值股大漲，不外推。中性 7 與美股大盤相同，區間比 VOO 寬，反映單一市場和成分股集中風險。J.P. Morgan 2026 Long-Term Capital Market Assumptions https://am.jpmorgan.com/us/en/asset-management/institutional/about-us/media/press-releases/jp-morgan-releases-2026-long-term-capital-market-assumptions/ ；Vanguard Capital Markets Model https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/vemo-return-forecasts.html；MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 | 2026-11-17 |
| 0050 | 樂觀 | 10 | 假設值（非預測），依 Phase 4 推算邏輯：前瞻預估中，新興市場股票 J.P. Morgan 7.8%、Vanguard 3.7–5.7%；0050 成立以來 14.07% 主要來自少數權值股大漲，不外推。中性 7 與美股大盤相同，區間比 VOO 寬，反映單一市場和成分股集中風險。J.P. Morgan 2026 Long-Term Capital Market Assumptions https://am.jpmorgan.com/us/en/asset-management/institutional/about-us/media/press-releases/jp-morgan-releases-2026-long-term-capital-market-assumptions/ ；Vanguard Capital Markets Model https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/vemo-return-forecasts.html；MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 | 2026-11-17 |
| VOO | 保守 | 4.5 | 假設值（非預測），依 Phase 4 推算邏輯：前瞻 J.P. Morgan 美國大型股 6.7%、Vanguard 美國股票 4.8%–6.8%；長期歷史 S&P 500 含息 1928–2025 年化約 10.0%（實質約 7%，換成 2% 通膨約 9%）。中性 7 落在兩者之間、偏前瞻；保守 4.5 接近 Vanguard 下緣；樂觀 9 等於長期歷史實質報酬加 2% 通膨。J.P. Morgan 2026 Long-Term Capital Market Assumptions https://am.jpmorgan.com/us/en/asset-management/institutional/about-us/media/press-releases/jp-morgan-releases-2026-long-term-capital-market-assumptions/ ；Vanguard Capital Markets Model https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/vemo-return-forecasts.html；Damodaran Historical Returns https://pages.stern.nyu.edu/adamodar/New_Home_Page/datafile/histretSP.html | 2026-11-17 |
| VOO | 中性 | 7 | 假設值（非預測），依 Phase 4 推算邏輯：前瞻 J.P. Morgan 美國大型股 6.7%、Vanguard 美國股票 4.8%–6.8%；長期歷史 S&P 500 含息 1928–2025 年化約 10.0%（實質約 7%，換成 2% 通膨約 9%）。中性 7 落在兩者之間、偏前瞻；保守 4.5 接近 Vanguard 下緣；樂觀 9 等於長期歷史實質報酬加 2% 通膨。J.P. Morgan 2026 Long-Term Capital Market Assumptions https://am.jpmorgan.com/us/en/asset-management/institutional/about-us/media/press-releases/jp-morgan-releases-2026-long-term-capital-market-assumptions/ ；Vanguard Capital Markets Model https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/vemo-return-forecasts.html；Damodaran Historical Returns https://pages.stern.nyu.edu/adamodar/New_Home_Page/datafile/histretSP.html | 2026-11-17 |
| VOO | 樂觀 | 9 | 假設值（非預測），依 Phase 4 推算邏輯：前瞻 J.P. Morgan 美國大型股 6.7%、Vanguard 美國股票 4.8%–6.8%；長期歷史 S&P 500 含息 1928–2025 年化約 10.0%（實質約 7%，換成 2% 通膨約 9%）。中性 7 落在兩者之間、偏前瞻；保守 4.5 接近 Vanguard 下緣；樂觀 9 等於長期歷史實質報酬加 2% 通膨。J.P. Morgan 2026 Long-Term Capital Market Assumptions https://am.jpmorgan.com/us/en/asset-management/institutional/about-us/media/press-releases/jp-morgan-releases-2026-long-term-capital-market-assumptions/ ；Vanguard Capital Markets Model https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/vemo-return-forecasts.html；Damodaran Historical Returns https://pages.stern.nyu.edu/adamodar/New_Home_Page/datafile/histretSP.html | 2026-11-17 |
| 0056 | 保守 | 3.5 | 假設值（非預測），依 Phase 4 推算邏輯：中性不高於同市場大盤型 0050；2025 年總費用率 0.57%，高於 0050 的 0.22%；成立以來 10.21% 也低於 0050 同期。MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 | 2026-11-17 |
| 0056 | 中性 | 6 | 假設值（非預測），依 Phase 4 推算邏輯：中性不高於同市場大盤型 0050；2025 年總費用率 0.57%，高於 0050 的 0.22%；成立以來 10.21% 也低於 0050 同期。MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 | 2026-11-17 |
| 0056 | 樂觀 | 8.5 | 假設值（非預測），依 Phase 4 推算邏輯：中性不高於同市場大盤型 0050；2025 年總費用率 0.57%，高於 0050 的 0.22%；成立以來 10.21% 也低於 0050 同期。MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 | 2026-11-17 |
| 00878 | 保守 | 3.5 | 假設值（非預測），依 Phase 4 推算邏輯：同 0056；成立僅約 6 年，歷史 20.64% 不外推。MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 | 2026-11-17 |
| 00878 | 中性 | 6 | 假設值（非預測），依 Phase 4 推算邏輯：同 0056；成立僅約 6 年，歷史 20.64% 不外推。MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 | 2026-11-17 |
| 00878 | 樂觀 | 8.5 | 假設值（非預測），依 Phase 4 推算邏輯：同 0056；成立僅約 6 年，歷史 20.64% 不外推。MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 | 2026-11-17 |
| 00919 | 保守 | 3 | 假設值（非預測），依 Phase 4 推算邏輯：同 0056；成立僅約 4 年、總費用率 0.69%，保守值再低一點。MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 | 2026-11-17 |
| 00919 | 中性 | 6 | 假設值（非預測），依 Phase 4 推算邏輯：同 0056；成立僅約 4 年、總費用率 0.69%，保守值再低一點。MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 | 2026-11-17 |
| 00919 | 樂觀 | 8.5 | 假設值（非預測），依 Phase 4 推算邏輯：同 0056；成立僅約 4 年、總費用率 0.69%，保守值再低一點。MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 | 2026-11-17 |
| QQQ | 保守 | 3 | 假設值（非預測），依 Phase 4 推算邏輯：產業集中型，中性只比大盤略高 0.5 個百分點。成立以來 10.88% 包含 2000 年科技泡沫，期間最大跌幅約八成，所以保守值放低、區間放寬。Invesco QQQ 官網 https://www.invesco.com/qqq-etf/en/home.html | 2026-11-17 |
| QQQ | 中性 | 7.5 | 假設值（非預測），依 Phase 4 推算邏輯：產業集中型，中性只比大盤略高 0.5 個百分點。成立以來 10.88% 包含 2000 年科技泡沫，期間最大跌幅約八成，所以保守值放低、區間放寬。Invesco QQQ 官網 https://www.invesco.com/qqq-etf/en/home.html | 2026-11-17 |
| QQQ | 樂觀 | 11 | 假設值（非預測），依 Phase 4 推算邏輯：產業集中型，中性只比大盤略高 0.5 個百分點。成立以來 10.88% 包含 2000 年科技泡沫，期間最大跌幅約八成，所以保守值放低、區間放寬。Invesco QQQ 官網 https://www.invesco.com/qqq-etf/en/home.html | 2026-11-17 |
| 美國公債 | 保守 | 3 | 假設值（非預測），依 Phase 4 推算邏輯：目前美國 10 年期公債殖利率 5.12%（2026-11-16，美國財政部 https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all/202611?_format=csv&field_tdr_date_value_month=202611&page=&type=daily_treasury_yield_curve ），J.P. Morgan 美國中期公債 4.0%；取中間略保守。J.P. Morgan 2026 Long-Term Capital Market Assumptions https://am.jpmorgan.com/us/en/asset-management/institutional/about-us/media/press-releases/jp-morgan-releases-2026-long-term-capital-market-assumptions/ ；Vanguard Capital Markets Model https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/vemo-return-forecasts.html | 2026-11-17 |
| 美國公債 | 中性 | 4.5 | 假設值（非預測），依 Phase 4 推算邏輯：目前美國 10 年期公債殖利率 5.12%（2026-11-16，美國財政部 https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all/202611?_format=csv&field_tdr_date_value_month=202611&page=&type=daily_treasury_yield_curve ），J.P. Morgan 美國中期公債 4.0%；取中間略保守。J.P. Morgan 2026 Long-Term Capital Market Assumptions https://am.jpmorgan.com/us/en/asset-management/institutional/about-us/media/press-releases/jp-morgan-releases-2026-long-term-capital-market-assumptions/ ；Vanguard Capital Markets Model https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/vemo-return-forecasts.html | 2026-11-17 |
| 美國公債 | 樂觀 | 5 | 假設值（非預測），依 Phase 4 推算邏輯：目前美國 10 年期公債殖利率 5.12%（2026-11-16，美國財政部 https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all/202611?_format=csv&field_tdr_date_value_month=202611&page=&type=daily_treasury_yield_curve ），J.P. Morgan 美國中期公債 4.0%；取中間略保守。J.P. Morgan 2026 Long-Term Capital Market Assumptions https://am.jpmorgan.com/us/en/asset-management/institutional/about-us/media/press-releases/jp-morgan-releases-2026-long-term-capital-market-assumptions/ ；Vanguard Capital Markets Model https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/vemo-return-forecasts.html | 2026-11-17 |
| 定存 / 現金 | 保守 | 1.2 | 假設值（非預測），依 Phase 4 推算邏輯：中性等於二年期定存利率 1.7108%（取 1.7）。參考：勞動部勞動基金運用局 115 年 11 月公告 https://www.blf.gov.tw/49200/49255/49261/49269/49277/73025/ | 2026-11-17 |
| 定存 / 現金 | 中性 | 1.7 | 假設值（非預測），依 Phase 4 推算邏輯：中性等於二年期定存利率 1.7108%（取 1.7）。參考：勞動部勞動基金運用局 115 年 11 月公告 https://www.blf.gov.tw/49200/49255/49261/49269/49277/73025/ | 2026-11-17 |
| 定存 / 現金 | 樂觀 | 2 | 假設值（非預測），依 Phase 4 推算邏輯：中性等於二年期定存利率 1.7108%（取 1.7）。參考：勞動部勞動基金運用局 115 年 11 月公告 https://www.blf.gov.tw/49200/49255/49261/49269/49277/73025/ | 2026-11-17 |

| 標的 | 類型 | 成立日 | 總費用率（2025 年度） | 成立以來含息年化（參考） | 截止日 | 成立年數 | 費用來源 | 歷史來源 |
|---|---|---|---|---|---|---|---|---|
| 0050 | 台股大盤 | 2003-06-25 | 0.22% | 14.07% | 2026-11-16 | 23 | MoneyDJ ETF 基本資料「總管理費用」欄（2025 年度）https://www.moneydj.com/etf/x/basic/basic0004.xdjhtm?etfid=0050.tw | MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 |
| VOO | 美股大盤 | 2010-09-07 | 0.03% | 14.94% | 2026-09-30 | 16 | Vanguard VOO fact sheet https://workplace.vanguard.com/assets/corp/fund_communications/pdf_publish/us-products/fact-sheet/F0968.pdf | Vanguard VOO fact sheet（成立以來 NAV 年化，截至 2026-09-30）https://workplace.vanguard.com/assets/corp/fund_communications/pdf_publish/us-products/fact-sheet/F0968.pdf |
| 0056 | 台股高股息 | 2007-12-13 | 0.57% | 10.21% | 2026-11-16 | 19 | MoneyDJ ETF 基本資料「總管理費用」欄（2025 年度）https://www.moneydj.com/etf/x/basic/basic0004.xdjhtm?etfid=0056.tw | MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 |
| 00878 | 台股高股息 | 2020-07-10 | 0.53% | 20.64% | 2026-11-16 | 6 | MoneyDJ ETF 基本資料「總管理費用」欄（2025 年度）https://www.moneydj.com/etf/x/basic/basic0004.xdjhtm?etfid=00878.tw | MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 |
| 00919 | 台股高股息 | 2022-10-13 | 0.69% | 31.15% | 2026-11-16 | 4 | MoneyDJ ETF 基本資料「總管理費用」欄（2025 年度）https://www.moneydj.com/etf/x/basic/basic0004.xdjhtm?etfid=00919.tw | MoneyDJ「成立以來年化報酬排行」（截至 2026-11-16，含息）https://www.moneydj.com/etf/x/rank/rank0007.xdjhtm?eord=t800652&erank=irr&etab=2&earea=47 |
| QQQ | 美股科技（產業集中） | 1999-03-10 | 0.18% | 10.88% | 2026-09-30 | 28 | Invesco QQQ 官網 https://www.invesco.com/qqq-etf/en/home.html | Invesco QQQ 官網 fact sheet（成立以來 NAV 年化，截至 2026-09-30）https://www.invesco.com/qqq-etf/en/home.html |
| 美國公債 | 債券 | — | — | 4.5% | 1928–2025 | —（資料期間，非成立年數） | — | Damodaran Historical Returns（美國 10 年期公債 1928–2025 年化約 4.5%）https://pages.stern.nyu.edu/adamodar/New_Home_Page/datafile/histretSP.html |
| 定存 / 現金 | 現金 | — | — | — | — | — | — | — |

範例支出項目 EXAMPLE_EXPENSES（房租或房貸 12,000、伙食 9,000、交通 2,000、水電網路 2,000、保險 2,000、娛樂 2,000、其他 1,000，合計 30,000 元/月）：source 為「範例值（使用者應改成自己的數字）」，updatedAt 2026-11-17。

## 三、勞保參數（config/social.ts）

| 參數 | id | 預設值 | 單位 | source | updatedAt |
|---|---|---|---|---|---|
| 勞保老年年金給付率（第二式） | liRatePerYear | 1.55 | %/年資 | 勞工保險條例第 58-1 條第 2 款；全國法規資料庫《勞工保險條例》https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050001 （最新修正 民國115年01月21日） | 2026-11-17（查證日） |
| 勞保老年年金給付率（第一式） | liRateAltPerYear | 0.775 | %/年資 | 勞工保險條例第 58-1 條第 1 款；全國法規資料庫《勞工保險條例》https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050001 （最新修正 民國115年01月21日） | 2026-11-17（查證日） |
| 勞保老年年金第一式定額加項 | liFixedAddon | 3,000 | 元/月 | 勞工保險條例第 58-1 條第 1 款；全國法規資料庫《勞工保險條例》https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050001 （最新修正 民國115年01月21日） | 2026-11-17（查證日） |
| 勞保投保薪資上限 | liSalaryCap | 45,800 | 元/月 | 勞工保險投保薪資分級表（115年1月1日起適用）最高第 11 級 https://www.bli.gov.tw/0005475.html （勞動部 114年11月21日 勞動保2字第1140091863號令修正發布，115-01-01 施行） | 2026-11-17（查證日） |
| 勞保法定請領年齡 | liLegalClaimAge | 65 | 歲 | 勞工保險條例第 58 條第 5 項（請領年齡自 98 年起第 10 年提高 1 歲，之後每 2 年提高 1 歲，上限 65 歲；115 年起為 65 歲）；全國法規資料庫《勞工保險條例》https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050001 （最新修正 民國115年01月21日） | 2026-11-17（查證日） |
| 提前請領每提前 1 年減給 | liEarlyPerYear | 4 | % | 勞工保險條例第 58-2 條第 2 項（最多提前 5 年，每年減給 4%，最多減 20%；需年資滿 15 年）；全國法規資料庫《勞工保險條例》https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050001 （最新修正 民國115年01月21日） | 2026-11-17（查證日） |
| 提前請領最多提前年數 | liEarlyMaxYears | 5 | 年 | 勞工保險條例第 58-2 條第 2 項；全國法規資料庫《勞工保險條例》https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050001 （最新修正 民國115年01月21日） | 2026-11-17（查證日） |
| 延後請領每延後 1 年增給 | liLatePerYear | 4 | % | 勞工保險條例第 58-2 條第 1 項（每延後 1 年增給 4%，最多增給 20%）；全國法規資料庫《勞工保險條例》https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050001 （最新修正 民國115年01月21日） | 2026-11-17（查證日） |
| 延後請領最多延後年數 | liLateMaxYears | 5 | 年 | 勞工保險條例第 58-2 條第 1 項；全國法規資料庫《勞工保險條例》https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050001 （最新修正 民國115年01月21日） | 2026-11-17（查證日） |
| 年金請領最低年資 | liMinYears | 15 | 年 | 勞工保險條例第 58 條第 1 項第 1 款；全國法規資料庫《勞工保險條例》https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050001 （最新修正 民國115年01月21日） | 2026-11-17（查證日） |
| 請領年齡可調下限 | liClaimAgeMin | 60 | 歲 | 依第 58、58-2 條推得：法定 65 歲 ±5 年；全國法規資料庫《勞工保險條例》https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050001 （最新修正 民國115年01月21日） | 2026-11-17（查證日） |
| 請領年齡可調上限 | liClaimAgeMax | 70 | 歲 | 依第 58、58-2 條推得：法定 65 歲 ±5 年；全國法規資料庫《勞工保險條例》https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050001 （最新修正 民國115年01月21日） | 2026-11-17（查證日） |

## 四、勞退參數（config/social.ts）

| 參數 | id | 預設值 | 單位 | source | updatedAt |
|---|---|---|---|---|---|
| 勞退雇主提繳率 | lrEmployerRate | 6 | % | 勞工退休金條例第 14 條第 1 項（雇主提繳不得低於每月工資 6%）；全國法規資料庫《勞工退休金條例》https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030020 （最新修正 民國108年05月15日） | 2026-11-17（查證日） |
| 勞退員工自提率上限 | lrEmployeeMaxRate | 6 | % | 勞工退休金條例第 14 條第 3 項（勞工自願提繳在每月工資 6% 範圍內）；全國法規資料庫《勞工退休金條例》https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030020 （最新修正 民國108年05月15日） | 2026-11-17（查證日） |
| 勞退提繳工資上限 | lrWageCap | 150,000 | 元/月 | 勞工退休金月提繳分級表（115年1月1日生效）第 62 級 https://www.bli.gov.tw/0102563.html （勞動部 114年11月24日 勞動福3字第1140153598號令，115-01-01 生效） | 2026-11-17（查證日） |
| 勞退基金收益率（名目） | lrFundReturn | 2 | %/年 | 假設值（非保證）。參考：勞工退休金法定最低保證收益率＝當地銀行二年期定存利率，115年11月公告年利率 1.7108%（勞動部勞動基金運用局 https://www.blf.gov.tw/49200/49255/49261/49269/49277/73025/ ）；新制勞退基金實際收益率 114年 15.60%、近5年（110～114）平均 10.28%（勞動基金運用局 115-02-02 新聞稿 https://www.blf.gov.tw/49200/49245/49247/198678/post ）。實際收益每年波動大，本工具取接近保證收益的保守值。 | 2026-11-17 |
| 勞退法定請領年齡 | lrLegalClaimAge | 60 | 歲 | 勞工退休金條例第 24 條（年滿 60 歲得請領）；全國法規資料庫《勞工退休金條例》https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030020 （最新修正 民國108年05月15日） | 2026-11-17（查證日） |
| 勞退月領最低提繳年資 | lrMinYearsMonthly | 15 | 年 | 勞工退休金條例第 24 條第 1 項；全國法規資料庫《勞工退休金條例》https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030020 （最新修正 民國108年05月15日） | 2026-11-17（查證日） |

## 五、級距表（115 年版）

- 勞保投保薪資分級表（115年1月1日起適用）：一般勞工 11 級，29,500–45,800。來源：勞動部勞工保險局 https://www.bli.gov.tw/0005475.html （勞動部 114年11月21日 勞動保2字第1140091863號令修正發布）。一般勞工適用；部分工時、庇護性就業、職訓機構受訓者的較低級距不納入本工具。月收入低於 29,500 時對應 29,500。
- 勞工退休金月提繳分級表（115年1月1日生效）：62 級，1,500–150,000。來源：勞動部勞工保險局 https://www.bli.gov.tw/0102563.html （勞動部 114年11月24日 勞動福3字第1140153598號令）。

## 六、地區設定（config/regions/tw.ts）

- 勞保：source https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050001，updatedAt 2026-11-17，note「已於 Phase 3 啟用，參數見 config/social.ts」
- 勞退：source https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030020，updatedAt 2026-11-17，note「已於 Phase 3 啟用，參數見 config/social.ts」

## 七、對結果影響最大的五個參數

1. 退休前報酬率（retPre／標的模式下的組合報酬）：直接決定退休時資產，影響最大。
2. 通膨率（inflation）：同時影響所有實質換算與年金實質價值。
3. 每月結餘（月收入 − 每月支出）：決定累積速度。
4. 退休後每月支出（retireSpend）：決定退休所需資金。
5. 勞保打折（discountPct）與勞退基金收益率（lrFundReturn）：決定勞保勞退這兩塊收入的實際大小。

## 八、下次需要查證的時間點

- 投保薪資分級表、月提繳分級表、最低工資：每年 1 月可能調整。
- 勞保費率：依勞工保險條例第 13 條，每兩年可能調整。
- 勞退保證收益率（銀行二年期定存利率）：每月公告。
- 勞保、勞退相關法規修正：不定期，查證時一併確認最新修正日期。
- J.P. Morgan Long-Term Capital Market Assumptions：每年約 10 月更新。
- Vanguard Capital Markets Model：每季更新。
- ETF 總費用率：每年更新（以前一年度總費用率為準）。
- 台股 ETF 受益人數排行：每週變動，查證時以最新一週為準。

## 六、步驟 ③「怎麼查」用到的官方網址（查證日 2026-11-17）

| 用途 | 網址 |
|---|---|
| 勞保局 e 化服務系統（需登入） | https://edesk.bli.gov.tw/me/ |
| 行動電話認證說明 | https://www.bli.gov.tw/0100074.html |
| e 化服務系統登入方式說明 | https://www.bli.gov.tw/0012986.html |
| 勞動保障卡查詢說明 | https://www.bli.gov.tw/0108235.html |
| 勞保/勞退查詢管道（ATM、臨櫃、薪資單） | https://www.bli.gov.tw/0101813.html |
| 勞保老年給付及勞退月退休金整合試算（免登入） | https://www.bli.gov.tw/0109187.html |
| 勞保老年年金簡易試算（免登入） | https://www.bli.gov.tw/0100398.html |
| 國民年金老年年金試算（免登入，「沒有勞保」時提供） | https://www.bli.gov.tw/0100754.html |

電話分機依據（畫面不顯示）：勞保局《勞工保險、就業保險、勞工職業災害保險及勞工退休金手冊》第五節「查詢投保資料」 https://www.bli.gov.tw/Files/21063 （PDF，查證日 2026-11-17）。

## Phase 6 人生大目標預設值（config/defaults.ts 的 LIFE_GOAL_PRESETS）
新增目標時帶入的範例值（金額皆為今日幣值），每項皆標示來源：
- 買房：總價 10,000,000 元、頭期 20%、貸款 30 年（範例值）；年利率 2.5%（範例值）。參考：中央銀行 115 年 9 月五大銀行新承做購屋貸款平均利率 2.315%（含利率較低的新青安貸款，一般方案多半較高）https://www.cbc.gov.tw/tw/cp-432-193064-9acd9-1.html ；請改成自己的核貸利率。
- 買車：總價 900,000 元、頭期 300,000 元、年利率 3%、5 年，全部是範例值，未查證，各車商與銀行方案差異很大，請以自己的報價為準。
- 其他：總價 0、不貸款（年數 0），由使用者自行填寫。
- 欄位範圍：購買年齡 現在年齡+1 ～ 預期壽命；年利率 0–20%；年數 0–40 年（0 代表不貸款）；頭期百分比 0–100%；最多 5 筆目標。
