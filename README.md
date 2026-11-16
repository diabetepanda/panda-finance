# Panda Finance

台灣上班族理財規劃與退休試算網站。輸入收入、日常支出與已有資產後，試算每月可儲蓄多少、儲蓄率、一輩子工作收入、退休時預估資產、退休所需資金與達成率、最早可退休年齡，以及資產能撐到幾歲，並納入通膨以「今日幣值／名目」雙口徑呈現。

> 以上為依假設值推算的試算結果，非預測，也不是投資建議。本網站為試算與教育工具，不構成任何投資建議、金融商品推介或勸誘；各項參數均為暫定假設值，請自行查證並調整。

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
npm test        # Vitest，涵蓋規格案例 1、2、3、4、6、7、8、15 與範例回歸
```

## 專案架構

- `config/`：所有預設參數的單一來源（`defaults.ts` 每個參數含 id／label／value／unit／min／max／source／updatedAt／note；`regions/tw.ts` 為台灣地區設定）。
- `core/`：純函式計算模組，不依賴 UI、DOM 或全域狀態（`rates.ts`、`annuity.ts`、`simulate.ts`、`retirement.ts`、`solver.ts`、`validate.ts`）。
- `ui/`：React 元件，只負責輸入與顯示，數字一律從 `core/` 取得。
- `tests/`：Vitest 單元測試。

## 文件

- [PARAMETERS.md](PARAMETERS.md)：所有暫定參數清單
- [ASSUMPTIONS.md](ASSUMPTIONS.md)：簡化假設與已知限制
- 計算規範與公式：見網站內「計算說明」區塊

## 部署

推送到 `main` 後，GitHub Actions 依序執行「安裝 → 跑測試 → 建置 → 部署到 GitHub Pages」；測試未通過不會部署。Vite base 為 `/panda-finance/`。

## 隱私

所有計算都在瀏覽器端完成，不呼叫外部 API、不使用 localStorage／cookie、不載入任何追蹤或分析工具。
