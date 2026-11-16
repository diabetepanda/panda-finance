// ============================================================
// 地區設定：台灣（規格第 1.3 節）
// 日後擴充其他地區時只需新增檔案，不改 core/。
// 制度參數皆為暫定假設，source 一律「待查證」。
// ============================================================

export const TW_REGION = {
  id: "tw",
  label: "台灣",
  currency: "TWD",
  currencyLabel: "新台幣",
  language: "zh-TW",
  numberFormat: {
    locale: "zh-TW",
    wanUnit: 10000, // 萬元顯示的換算單位
    wanDecimals: 1, // 萬元顯示保留一位小數（第 2.1 節）
  },
  // 制度參數：Phase 1 尚未使用（勞保、勞退為 Phase 3），
  // 先集中放置並標示待查證，避免日後寫死在 core 或 UI。
  systemParams: {
    laborInsurance: {
      label: "勞保老年年金（Phase 3 才啟用）",
      source: "待查證",
      updatedAt: "待填",
      note: "費率、投保薪資上限、請領年齡等依規格第 6.1 節於 Phase 3 查證後填入。",
    },
    laborPension: {
      label: "勞退新制（Phase 3 才啟用）",
      source: "待查證",
      updatedAt: "待填",
      note: "提繳率與提繳工資上限依規格第 6.1 節於 Phase 3 查證後填入。",
    },
  },
} as const;
