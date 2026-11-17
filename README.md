# Panda Finance

台灣上班族理財規劃與退休試算網站。輸入收入、日常支出與已有資產後，試算每月可儲蓄多少、儲蓄率、一輩子工作收入、退休時預估資產、退休所需資金與達成率、最早可退休年齡，以及資產能撐到幾歲，並納入通膨以「今日幣值／帳面金額，含通膨」雙口徑呈現。通膨固定以 2% 計算。可加入最多 5 筆「人生大目標」（買房／買車／其他大筆支出與貸款，選填）一起試算，並在結果頁對照有／沒有大目標的差異。另有勞保與勞退試算（預設納入）、「每月定期定額投資 vs 全部放定存」投資對照卡，以及常見 ETF 定期定額比較（教育性試算比較；手機寬度 480px 以下改成每檔一張卡片：標題＋類型標籤、主數字、兩欄小網格、歷史參考與收合的風險提示，資料與表格同一份，列印時一律印表格版）。

> 以上為依假設值推算的試算結果，非預測，也不是投資建議。本網站為試算與教育工具，不構成任何投資建議、金融商品推介或勸誘；各項參數均為依公開資料推得的假設值（查證日 2026-11-17），使用者可自行調整。

線上網址：https://diabetepanda.github.io/panda-finance/

## 本機執行方式

需求：Node.js 20 以上。

```bash
npm install     # 安裝依賴
npm run dev     # 啟動開發伺服器
npm run build   # 型別檢查 + 建置到 dist/
npm run preview # 預覽建置結果
```

## 如何執行測試

```bash
npm test        # Vitest，涵蓋規格案例 1–17、Phase 3.2、Phase 4 與 Phase 5／5.1／5.2 測試（共 107 項，含 Phase 6 人生大目標）
```

## 專案架構

- `config/`：所有預設參數的單一來源（`defaults.ts` 每個參數含 id／label／value／unit／min／max／source／updatedAt／note；`regions/tw.ts` 為台灣地區設定）。
- `core/`：純函式計算模組，不依賴 UI、DOM 或全域狀態（`rates.ts`、`annuity.ts`、`simulate.ts`、`retirement.ts`、`solver.ts`、`validate.ts`、`social.ts`、`socialEstimate.ts`、`conclusion.ts`、`dca.ts`、`investCompare.ts`、`otherIncome.ts`、`importForm.ts`）。
- `ui/`：React 元件，只負責輸入與顯示，數字一律從 `core/` 取得。`App.tsx` 是外殼（狀態與步驟切換），步驟元件在 `ui/steps/`、結果頁在 `ui/results/ResultsPage.tsx`、共用小元件在 `ui/components/`（StepNav、Tabs、HowToCheck），表單型別與 toInput/compute 管線在 `ui/form.ts`。
- `tests/`：Vitest 單元測試。

## 變更紀錄
- [CHANGELOG.md](CHANGELOG.md)：各階段變更（最新：Phase 5.3 列印表格修正、手機卡片精簡、44px 點擊高度）

## 文件

- [PARAMETERS.md](PARAMETERS.md)：所有參數清單（含 Phase 4 報酬率推算邏輯與 ETF 挑選依據）
- [CALCULATION_SPEC.md](CALCULATION_SPEC.md)：計算規範與程式公式逐條對照（函式輸入/輸出/公式/範例數字）
- [TEST_REPORT.md](TEST_REPORT.md)：測試報告（91 項全過）
- [RISKS.md](RISKS.md)：已知風險與未做項目
- [ASSUMPTIONS.md](ASSUMPTIONS.md)：簡化假設與已知限制
- 計算規範與公式：見網站內「計算說明」區塊

## 部署

推送到 `main` 後，GitHub Actions 依序執行「安裝 → 跑測試 → 建置 → 部署到 GitHub Pages」；測試未通過不會部署。Vite base 為 `/panda-finance/`。

## 隱私

所有計算都在瀏覽器端完成，不呼叫外部 API、不使用 localStorage／cookie、不載入任何追蹤或分析工具。

## 使用流程（Phase 5：4 步驟引導）

打開網站先看到步驟 ①，一步一步填，每一步底部都有「目前試算」小字，可以隨時點「直接看結果」：

1. **步驟 ① 關於你**：你現在幾歲、想幾歲退休、目前存款和投資合計大約多少。預期壽命在「進階」裡。
2. **步驟 ② 每個月的錢**：每月實領薪水、每月支出（可新增/刪除項目）、退休後每月想花多少。薪資每年調幅與「支出到幾歲結束」開關在「進階」裡。
3. **步驟 ③ 勞保勞退與其他收入**：先選「有／沒有／不確定」有沒有勞保。選「有」預設用「幫我估」：只問開始全職工作的年齡與稅前月薪（選填），年資、投保薪資、勞退帳戶由程式估；查得到資料的人可以切換「我查得到，自己填」。步驟內有「怎麼查自己的勞保和勞退？」說明框。其他退休收入（租金、年金險、兼職等）也在這一步。
4. **步驟 ④ 結果**：一句白話結論、四張摘要卡、資產圖表，以及四個分頁——「怎麼改善」（目標反推）、「定期定額學習」（投資對照卡與 ETF 比較）、「進階設定」（報酬率假設與投資標的）、「明細與說明」（完整數字、逐年明細、計算說明、圖表比較）。存檔（JSON 匯出/匯入）與列印在結果頁最下方。

**舊設定檔相容**：Phase 4.1 以前匯出的 JSON 設定檔可以直接匯入。舊檔有開勞保勞退的會自動切成「有＋自己填」模式（數字沿用舊檔，結果和舊版一致），關閉的會切成「沒有」；舊檔裡有設結束年齡的支出會自動打開步驟 ② 的結束年齡開關。新匯出的設定檔 version 為 2。
