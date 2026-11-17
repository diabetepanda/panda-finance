# PARAMETERS.md｜參數完整清單（Phase 3.2 查證更新）

查證日 2026-11-17。制度參數（勞保、勞退）已依官方來源逐項核對，source 欄位為實際依據；其餘為範例值／假設值／系統設定／設計門檻，依欄位標示。本表由設定檔自動對照產生，內容與 config/ 一致。

## 一、基本與假設參數（config/defaults.ts）

| 參數 | id | 預設值 | 單位 | 範圍 | source | updatedAt |
|---|---|---|---|---|---|---|
| 現在年齡 | ageNow | 30 | 歲 | 18–80 | 範例值（使用者應改成自己的數字） | 2026-11-17 |
| 預計退休年齡 | ageRetire | 65 | 歲 | 18–100 | 範例值（使用者應改成自己的數字） | 2026-11-17 |
| 預期壽命 | ageLife | 85 | 歲 | 19–110 | 使用者輸入，預設為假設值。參考：內政部 114年簡易生命表，國人平均壽命 81.27 歲（男 77.93、女 84.75）https://www.moi.gov.tw/News_Content.aspx?n=4&s=340439 。預設 85 歲比平均壽命長，是為了反映長壽風險。 | 2026-11-17 |
| 目前已有可投資資產 | initAssets | 0 | 元 | 0–1,000,000,000 | 範例值（使用者應改成自己的數字） | 2026-11-17 |
| 其他退休收入 | otherRetireIncome | 0 | 元/月 | 0–100,000,000 | 範例值（使用者應改成自己的數字） | 2026-11-17 |
| 月收入（稅後實領） | monthlyIncome | 50,000 | 元/月 | 0–100,000,000 | 範例值（使用者應改成自己的數字） | 2026-11-17 |
| 預期薪資年成長率（名目） | salaryGrowth | 2.5 | %/年 | -50–100 | 假設值（非預測），使用者應依自身情況調整。 | 2026-11-17 |
| 通膨率 | inflation | 2 | %/年 | -10–50 | 假設值。參考：主計總處 CPI 年增率 113年 2.18%（https://www.dgbas.gov.tw/News_Content.aspx?n=3602&s=234403 ）、114年 1.66%（https://www.stat.gov.tw/News_Content.aspx?n=3703&s=235723 ）、115年1–10月平均 1.98%（https://www.stat.gov.tw/News_Content.aspx?n=3703&s=236836 ）。 | 2026-11-17 |
| 投資年化報酬率（名目） | retPre | 6 | %/年 | -50–100 | 假設值（非預測），使用者應依自身情況調整。 | 2026-11-17 |
| 退休後年化報酬率（名目） | retPost | 4 | %/年 | -50–100 | 假設值（非預測），使用者應依自身情況調整。 | 2026-11-17 |
| 退休後月支出預設比例 | retireSpendRatio | 75 | % | 0–200 | 假設值（非預測），使用者應依自身情況調整。 | 2026-11-17 |
| 最早可退休年齡試算上限 | earliestRetirementCap | 75 | 歲 | 60–100 | 系統設定（演算法參數，非官方數值） | 2026-11-17 |
| 資產耗盡判定容許誤差 | exhaustTolerance | 0.5 | 元 | 0–100 | 系統設定（演算法參數，非官方數值） | 2026-11-17 |
| 輸入重算延遲 | debounceMs | 200 | 毫秒 | 150–250 | 系統設定（演算法參數，非官方數值） | 2026-11-17 |
| 反推搜尋最大迭代次數 | solverMaxIterations | 60 | 次 | 1–200 | 系統設定（演算法參數，非官方數值） | 2026-11-17 |
| 額外儲蓄搜尋上限倍數 | solverMaxExtraMultiple | 2 | 倍（月收入） | 1–10 | 系統設定（演算法參數，非官方數值） | 2026-11-17 |
| 新台幣對美元年變動率 | fxChange | 0 | %/年 | -20–20 | 假設值（非預測），使用者應依自身情況調整。 | 2026-11-17 |
| 退休後報酬保守折減 | retireReturnDeduction | 2 | 百分點 | 0–10 | 假設值（非預測），使用者應依自身情況調整。 | 2026-11-17 |
| 保守情境通膨率 | scenarioInflationConservative | 3 | %/年 | -10–50 | 假設值（情境設定）。參考同中性情境的主計總處 CPI 資料。 | 2026-11-17 |
| 中性情境通膨率 | scenarioInflationNeutral | 2 | %/年 | -10–50 | 假設值。參考：主計總處 CPI 年增率 113年 2.18%（https://www.dgbas.gov.tw/News_Content.aspx?n=3602&s=234403 ）、114年 1.66%（https://www.stat.gov.tw/News_Content.aspx?n=3703&s=235723 ）、115年1–10月平均 1.98%（https://www.stat.gov.tw/News_Content.aspx?n=3703&s=236836 ）。 | 2026-11-17 |
| 樂觀情境通膨率 | scenarioInflationOptimistic | 1.5 | %/年 | -10–50 | 假設值（情境設定）。參考同中性情境的主計總處 CPI 資料。 | 2026-11-17 |
| 醫療與保險類別通膨建議值 | categoryInflationMedicalSuggested | 4 | %/年 | -10–50 | 假設值（建議提示用），未引用官方數據。 | 2026-11-17 |
| 單一標的集中提醒門檻（台積電） | concentrationWarnPct | 30 | % | 0–100 | 設計門檻（提醒用，非官方數值） | 2026-11-17 |
| 單一個股強提醒門檻 | concentrationStrongPct | 50 | % | 0–100 | 設計門檻（提醒用，非官方數值） | 2026-11-17 |
| 標的比較年數 | goalCompareYears | 20 | 年 | 1–40 | 系統設定（演算法參數，非官方數值） | 2026-11-17 |
| 反推容許誤差比例 | goalToleranceRatio | 0.1 | % | 0–10 | 系統設定（演算法參數，非官方數值） | 2026-11-17 |

範例支出項目 EXAMPLE_EXPENSES（房租或房貸 12,000、伙食 9,000、交通 2,000、水電網路 2,000、保險 2,000、娛樂 2,000、其他 1,000，合計 30,000 元/月）：source 為「範例值（使用者應改成自己的數字）」，updatedAt 2026-11-17。

## 二、標的報酬率（config/assets.ts）

| 標的 | 情境 | 報酬率（%/年） | source | updatedAt |
|---|---|---|---|---|
| VOO | 保守 | 5 | 假設值（非預測）。歷史報酬可參考發行商官網：VOO https://investor.vanguard.com/investment-products/etfs/profile/voo ；QQQ https://www.invesco.com/qqq-etf/en/home.html ；0050、0056 元大投信 https://www.yuantaetfs.com/ 。 | 2026-11-17 |
| VOO | 中性 | 7 | 假設值（非預測）。歷史報酬可參考發行商官網：VOO https://investor.vanguard.com/investment-products/etfs/profile/voo ；QQQ https://www.invesco.com/qqq-etf/en/home.html ；0050、0056 元大投信 https://www.yuantaetfs.com/ 。 | 2026-11-17 |
| VOO | 樂觀 | 9 | 假設值（非預測）。歷史報酬可參考發行商官網：VOO https://investor.vanguard.com/investment-products/etfs/profile/voo ；QQQ https://www.invesco.com/qqq-etf/en/home.html ；0050、0056 元大投信 https://www.yuantaetfs.com/ 。 | 2026-11-17 |
| QQQ | 保守 | 6 | 假設值（非預測）。歷史報酬可參考發行商官網：VOO https://investor.vanguard.com/investment-products/etfs/profile/voo ；QQQ https://www.invesco.com/qqq-etf/en/home.html ；0050、0056 元大投信 https://www.yuantaetfs.com/ 。 | 2026-11-17 |
| QQQ | 中性 | 9 | 假設值（非預測）。歷史報酬可參考發行商官網：VOO https://investor.vanguard.com/investment-products/etfs/profile/voo ；QQQ https://www.invesco.com/qqq-etf/en/home.html ；0050、0056 元大投信 https://www.yuantaetfs.com/ 。 | 2026-11-17 |
| QQQ | 樂觀 | 11 | 假設值（非預測）。歷史報酬可參考發行商官網：VOO https://investor.vanguard.com/investment-products/etfs/profile/voo ；QQQ https://www.invesco.com/qqq-etf/en/home.html ；0050、0056 元大投信 https://www.yuantaetfs.com/ 。 | 2026-11-17 |
| 0050 | 保守 | 5 | 假設值（非預測）。歷史報酬可參考發行商官網：VOO https://investor.vanguard.com/investment-products/etfs/profile/voo ；QQQ https://www.invesco.com/qqq-etf/en/home.html ；0050、0056 元大投信 https://www.yuantaetfs.com/ 。 | 2026-11-17 |
| 0050 | 中性 | 7 | 假設值（非預測）。歷史報酬可參考發行商官網：VOO https://investor.vanguard.com/investment-products/etfs/profile/voo ；QQQ https://www.invesco.com/qqq-etf/en/home.html ；0050、0056 元大投信 https://www.yuantaetfs.com/ 。 | 2026-11-17 |
| 0050 | 樂觀 | 9 | 假設值（非預測）。歷史報酬可參考發行商官網：VOO https://investor.vanguard.com/investment-products/etfs/profile/voo ；QQQ https://www.invesco.com/qqq-etf/en/home.html ；0050、0056 元大投信 https://www.yuantaetfs.com/ 。 | 2026-11-17 |
| 0056 | 保守 | 4 | 假設值（非預測）。歷史報酬可參考發行商官網：VOO https://investor.vanguard.com/investment-products/etfs/profile/voo ；QQQ https://www.invesco.com/qqq-etf/en/home.html ；0050、0056 元大投信 https://www.yuantaetfs.com/ 。 | 2026-11-17 |
| 0056 | 中性 | 6 | 假設值（非預測）。歷史報酬可參考發行商官網：VOO https://investor.vanguard.com/investment-products/etfs/profile/voo ；QQQ https://www.invesco.com/qqq-etf/en/home.html ；0050、0056 元大投信 https://www.yuantaetfs.com/ 。 | 2026-11-17 |
| 0056 | 樂觀 | 8 | 假設值（非預測）。歷史報酬可參考發行商官網：VOO https://investor.vanguard.com/investment-products/etfs/profile/voo ；QQQ https://www.invesco.com/qqq-etf/en/home.html ；0050、0056 元大投信 https://www.yuantaetfs.com/ 。 | 2026-11-17 |
| 美國公債 | 保守 | 2.5 | 假設值（非預測） | 2026-11-17 |
| 美國公債 | 中性 | 4 | 假設值（非預測） | 2026-11-17 |
| 美國公債 | 樂觀 | 5 | 假設值（非預測） | 2026-11-17 |
| 台積電（2330） | 保守 | 4 | 假設值（非預測） | 2026-11-17 |
| 台積電（2330） | 中性 | 9 | 假設值（非預測） | 2026-11-17 |
| 台積電（2330） | 樂觀 | 14 | 假設值（非預測） | 2026-11-17 |
| 定存 / 現金 | 保守 | 1 | 假設值（非預測）。參考：二年期定存平均利率 1.7108%（勞動基金運用局公告 https://www.blf.gov.tw/49200/49255/49261/49269/49277/73025/ ）。 | 2026-11-17 |
| 定存 / 現金 | 中性 | 1.5 | 假設值（非預測）。參考：二年期定存平均利率 1.7108%（勞動基金運用局公告 https://www.blf.gov.tw/49200/49255/49261/49269/49277/73025/ ）。 | 2026-11-17 |
| 定存 / 現金 | 樂觀 | 2 | 假設值（非預測）。參考：二年期定存平均利率 1.7108%（勞動基金運用局公告 https://www.blf.gov.tw/49200/49255/49261/49269/49277/73025/ ）。 | 2026-11-17 |

各標的 note 一律為「假設值，非預測。」

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
