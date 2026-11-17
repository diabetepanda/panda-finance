// ============================================================
// 地區設定：台灣（規格第 1.3 節）
// 日後擴充其他地區時只需新增檔案，不改 core/。
// 制度參數已於 Phase 3.2（2026-11-17）依官方來源查證，實際參數見 config/social.ts。
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
  // 制度參數已於 Phase 3 啟用，實際參數集中於 config/social.ts。
  systemParams: {
    laborInsurance: {
      label: "勞保老年年金",
      source: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0050001",
      updatedAt: "2026-11-17",
      note: "已於 Phase 3 啟用，參數見 config/social.ts",
    },
    laborPension: {
      label: "勞退新制",
      source: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030020",
      updatedAt: "2026-11-17",
      note: "已於 Phase 3 啟用，參數見 config/social.ts",
    },
  },
} as const;
