# CALCULATION_SPEC.md｜計算規範對照（Phase 3 最終版）

把規格第 3 節（與第 5、6 節的公式）與實際程式逐條對照。每個核心函式列出：檔案、輸入、輸出、公式、範例數字（皆為測試實際驗證值）。所有計算在 core/，純函式。

## 基礎換算（core/rates.ts）

### realRate(nominal, inflation)
- 輸入：名目報酬率（小數）、通膨率（小數）。輸出：實質報酬率（小數）。
- 公式：(1 + nominal) / (1 + inflation) − 1（不得用相減）。
- 範例：realRate(0.07, 0.02) = 0.049019… ≈ 4.902%（案例 1）。

### realToNominal(realAmount, inflation, years) / nominalToReal(nominalAmount, inflation, years)
- 公式：名目 = 實質 × (1 + 通膨)^years；實質 = 名目 ÷ (1 + 通膨)^years。
- 範例：nominalToReal(1,000,000, 0.02, 20) 的逆運算 realToNominal(1,000,000, 0.02, 20) = 1,485,947（案例 3，誤差 < 1 元）。

## 年金（core/annuity.ts）

### pvAnnuity(payment, rate, years)
- 輸入：每年金額、實質利率（小數）、年數。輸出：現值。
- 公式：payment × (1 − (1 + rate)^(−years)) / rate；rate = 0 時 = payment × years（特例，不除零）。
- 範例：pvAnnuity(600000, 0.02, 25) = 11,714,074（約 1,171.4 萬，案例 6）；pvAnnuity(100000, 0, 10) = 1,000,000（案例 7）。

### fvAnnuity(payment, rate, years)
- 公式：payment × ((1 + rate)^years − 1) / rate；rate = 0 時 = payment × years。現金流年底發生。
- 範例：fvAnnuity(240000, realRate(0.06, 0.02), 35) 與案例 2 的退休資產一致（誤差 < 1 元）。

## 主模擬（core/simulate.ts）

### simulate(inp, retireAge, tolerance)
- 輸入：SimInput（年齡、資產、收支、假設、可選分類通膨/退休拆分/勞保勞退）、退休年齡、耗盡容許誤差。輸出：SimResult（逐年 rows、退休資產、所需資金、達成率、耗盡年齡、各缺口、勞保勞退明細）。
- 工作期（第 t 年）：收入 = 月收入 × 12 × (1 + g)^(t−1)，g = realRate(薪資成長, 通膨)；支出 = 各項目 × 12（分類通膨開啟時各項目再乘 (1 + 類別實質成長率)^(t−1)，類別實質成長率 = (1 + 類別通膨)/(1 + 總通膨) − 1）；年底資產 = 去年資產 × (1 + r) + (收入 − 支出 + 額外儲蓄 × 12)，r = realRate(退休前報酬, 通膨)；資產負數下限 0，差額累計 workGap。
- 退休期（第 k 年，總經過年數 t2 = 工作年數 + k）：支出缺口 = max(0, 退休支出 − 勞保年金 − 勞退月領 − 其他退休收入)，超額不回投；年底資產 = 去年資產 × (1 + rho) − 缺口，rho = realRate(退休後報酬, 通膨)；跌破 −tolerance 記耗盡年齡、資產歸 0、差額累計 uncovered。
- 退休所需資金：缺口固定時 pvAnnuity(缺口, rho, 退休年數)；缺口逐年不同（分類拆分或勞保勞退）時逐年折現加總 Σ 缺口_k / (1 + rho)^k。
- 範例（範例資料）：退休資產 20,351,xxx（2,035.1 萬）、所需資金 4,432,xxx（443.2 萬）、達成率 459.2%、耗盡年齡 null（撐到 85 歲）。

## 退休（core/retirement.ts）

### earliestRetirement(inp)
- 從 A+1 逐歲到 min(75, L−1) 重跑 simulate（每個候選年齡都重算勞保年資、減給、勞退累積），回傳第一個耗盡年齡為 null 的年齡；不假設單調。R = A 時回傳 already 並附 lastsToLife / exhaustAge。
- 範例：範例資料 → 49 歲。

### defaultRetireSpend(totalMonthlyExpense, ratioPct) / defaultRetireSpendByCategory(totals, ratioPct)
- 退休支出連動預設 = 目前支出（合計或各類別）× 比例%，四捨五入到元。

## 勞保勞退（core/social.ts）

### laborInsuranceMonthly(li, years)
- 公式（第 58-1 條兩式擇優）：base = max(第一式, 第二式)；第一式 = min(平均月投保薪資, 上限) × 年資 × 0.775% ＋ 3,000；第二式 = min(平均月投保薪資, 上限) × 年資 × 1.55%。月領 = base × 增減給因子 × (1 − 打折)。3,000 元當今日幣值處理。
- 增減給因子：提前 = 1 − min(法定年齡 − 請領年齡, 5) × 4%；延後 = 1 + min(請領年齡 − 法定年齡, 5) × 4%。
- 範例：40,000 × 30 年：第一式 12,300、第二式 18,600 → 取 18,600（案例 12）；60 歲請領 → ×0.8 = 14,880；70 歲 → ×1.2 = 22,320。擇優範例：45,800 × 35 年 → 第二式 24,846.5 勝出；29,500 × 10 年 → 第一式 5,286.25 勝出（Phase 3.2 測試）。

### laborInsuranceRealAnnual(monthlyToday, indexed, inflation, yearsToClaim, k)
- indexed：月領 × 12（實質不變）。
- 非 indexed：名目固定年金 = 月領 × 12 × (1 + 通膨)^yearsToClaim；第 k 年實質 = 名目固定年金 ÷ (1 + 通膨)^k。k 為從現在起算的總經過年數（基準點見程式註解）。
- 範例：月領 18,600、通膨 2%、35 年後請領：k=35 → 223,200；k=40 → 223,200 / 1.02^5 ≈ 202,139（案例 13）。

### laborPensionAccumulate(lp, ageNow, retireAge, salaryGrowthPct, inflationPct)
- 每年提繳（名目）= min(月提繳工資 × (1 + 名目薪資成長)^(t−1), 150,000) × 12 × (雇主% + 自提%)；實質提繳 = 名目 ÷ (1 + 通膨)^(t−1)；餘額 = 餘額 × (1 + 實質基金收益率) + 實質提繳（年底）。
- 自提只進本帳戶，不從月收入重複扣除。

### laborPensionStartAge(lp, retireAge) / laborPensionGrow(balance, fundReturnPct, inflationPct, waitYears)
- 開始領取年齡 = max(退休年齡, 勞退法定請領年齡（參數 lrLegalClaimAge，預設 60）)。
- 空窗期帳戶續累積：請領時帳戶 = 退休時帳戶 × (1 + 基金實質收益率)^waitYears（不再提繳）。
- 一次領：無空窗期時退休當下併入資產；有空窗期時於請領那一年併入（金額為上式）。
- 月領：年金化期間 = 預期壽命 − 開始領取年齡，年金化金額為請領時帳戶。

### laborPensionMonthlyAnnual(balance, fundReturnPct, inflationPct, years)
- 年額 = balance ÷ pvAnnuity(1, 實質基金收益率, years)；實質收益率 0 時 = balance ÷ years。
- 範例：1,200,000、名目 2%、通膨 2%（實質 0）、20 年 → 60,000/年。

## 配置與匯率（core/portfolio.ts）

### fxAdjustedReturn(nominalReturn, fxChange)
- 公式：(1 + 名目) × (1 + 美元對新台幣變動率) − 1，其中美元對新台幣變動率 = 1/(1 + fx) − 1。fx > 0 = 新台幣升值 → 報酬變差。
- 範例：報酬 7%、fx +3% → 3.88%（< 7%）；fx −3% → 10.31%（> 7%）（案例 9）。

### portfolioReturn(allocation, scenario, overrides, fx)
- 各標的先各自套匯率（僅 USD 標的、只套一次）再依比例加權；每年固定比例再平衡的簡化。

### postRetirementReturn(...)
- 自訂退休後配置：直接用其組合報酬。與退休前相同：max(退休前組合報酬 − 折減， 同情境定存報酬）。

## 情境管線（core/compute.ts）

### computeScenarios(baseInp, settings)
- 配置總和 ≠ 100% → paused（不計算）。每情境以自己的通膨與組合報酬跑 simulate + earliestRetirement；名目換算一律用該情境通膨。
- resolveScenarioInflation：中性通膨未手動修改時 = 主畫面通膨（Phase 3 連動修正）。

## 目標反推（core/goals.ts）

### solveMonthlySaving(inp, targetRetireAge)
- 二分搜尋最小每月儲蓄 S（extraMonthlySaving = S − 目前結餘代入 simulate），區間 [0, 月收入]，不足擴大到 2 倍，再不足回傳無法達成；最多 60 次迭代；成功條件：耗盡年齡為 null 且最後剩餘 < max(所需資金 × 0.1%, 1 元） 等級。
- 範例：範例資料、65 歲退休 → 目前結餘 20,000 已達成且有餘裕；求得 S 代回 simulate 撐到 85 歲、finalAssets 在容許誤差內（案例 14b）。

### solveLumpSum(inp, targetRetireAge)
- 每月儲蓄設 0（extra = −結餘），二分搜尋現在需一次投入金額（initAssets + X 代入 simulate），上限以倍增擴展，超過 60 次擴展回傳未收斂。

### solveEarliestWithSaving(inp, Z)
- earliestRetirement({...inp, extraMonthlySaving: Z − 結餘})；Z = 結餘時與主畫面最早退休年齡相同（案例 14a：49 歲）。

## 比較（core/compare.ts）

### assetComparison(monthlySaving, initAssets, years, scenarioInflation, overrides, fxPct)
- 每標的每情境：實質報酬 = realRate（標的台幣報酬（匯率調整後）, 情境通膨）；N 年後 = 既有資產 × (1 + r)^N + fvAnnuity（月結餘 × 12, r, N)。

### purchasingPowerSeries(amount, inflationPct, years)
- 第 t 年實質 = nominalToReal(amount, 通膨， t)。

### socialVariants(inp)
- 目前設定 / 無勞保 / 無勞退 / 打折 0% / 30% / 50% 六個變體，各自跑 simulate + earliestRetirement。

### goalRows / goalEarliestAnswers（UI 入口，core/goals.ts）
- 標的未啟用：rows = [{ key: "single", inp: 主畫面 inp }]，反推與主畫面同一組假設。
- 標的啟用：rows = 三情境各自的 inp。
- 範例：未啟用、Z = 目前結餘 → 模式三答案 = 主畫面最早退休年齡 49 歲（測試驗證）。
