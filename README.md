# Panda Finance

台灣上班族理財規劃與退休試算網站。輸入收入、日常支出與已有資產後，試算每月可儲蓄多少、儲蓄率、一輩子工作收入、退休時預估資產、退休所需資金與達成率、最早可退休年齡，以及資產能撐到幾歲，並納入通膨以「今日幣值／名目」雙口徑呈現。通膨固定以 2% 計算。另有勞保與勞退試算（預設納入）、「每月定期定額投資 vs 全部放定存」投資對照卡，以及常見 ETF 定期定額比較（教育性試算比較）。

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
npm test        # Vitest，涵蓋規格案例 1–17、Phase 3.2 與 Phase 4 測試
```

## 專案架構

- `config/`：所有預設參數的單一來源（`defaults.ts` 每個參數含 id／label／value／unit／min／max／source／updatedAt／note；`regions/tw.ts` 為台灣地區設定）。
- `core/`：純函式計算模組，不依賴 UI、DOM 或全域狀態（`rates.ts`、`annuity.ts`、`simulate.ts`、`retirement.ts`、`solver.ts`、`validate.ts`、`social.ts`、`dca.ts`、`investCompare.ts`、`otherIncome.ts`、`importForm.ts`）。
- `ui/`：React 元件，只負責輸入與顯示，數字一律從 `core/` 取得。
- `tests/`：Vitest 單元測試。

## 文件

- [PARAMETERS.md](PARAMETERS.md)：所有參數清單（含 Phase 4 報酬率推算邏輯與 ETF 挑選依據）
- [CALCULATION_SPEC.md](CALCULATION_SPEC.md)：計算規範與程式公式逐條對照（函式輸入/輸出/公式/範例數字）
- [TEST_REPORT.md](TEST_REPORT.md)：測試報告（66 項全過）
- [RISKS.md](RISKS.md)：已知風險與未做項目
- [ASSUMPTIONS.md](ASSUMPTIONS.md)：簡化假設與已知限制
- 計算規範與公式：見網站內「計算說明」區塊

## 部署

推送到 `main` 後，GitHub Actions 依序執行「安裝 → 跑測試 → 建置 → 部署到 GitHub Pages」；測試未通過不會部署。Vite base 為 `/panda-finance/`。

## 隱私

所有計算都在瀏覽器端完成，不呼叫外部 API、不使用 localStorage／cookie、不載入任何追蹤或分析工具。
