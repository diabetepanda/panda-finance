// ui/components/HowToCheck.tsx｜「怎麼查自己的勞保和勞退？」收合框（規格 Phase 5 第五節，原文照放）
const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

export default function HowToCheck({ open, onToggle }: { open: boolean; onToggle: (open: boolean) => void }) {
  return (
    <div className="howto">
      <button type="button" className="howto-toggle" aria-expanded={open} onClick={() => onToggle(!open)}>
        怎麼查自己的勞保和勞退？{open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="howto-body">
          <h4>1. 線上馬上查：勞保局 e 化服務系統</h4>
          <ul>
            <li>入口：勞保局網站「線上申辦 → e 化服務系統（需登入）→ 個人申報及查詢」，網址 <a href="https://edesk.bli.gov.tw/me/" {...ext}>https://edesk.bli.gov.tw/me/</a></li>
            <li>最容易的登入方式是「行動電話認證」：準備身分證號、健保卡號和本人的月租型手機門號，申請一次後會綁定在那支手機或那台電腦的瀏覽器。說明：<a href="https://www.bli.gov.tw/0100074.html" {...ext}>https://www.bli.gov.tw/0100074.html</a></li>
            <li>也可以用自然人憑證（要讀卡機）、虛擬勞保憑證、行動自然人憑證（TW FidO）或金融電子憑證登入。流程說明：<a href="https://www.bli.gov.tw/0012986.html" {...ext}>https://www.bli.gov.tw/0012986.html</a></li>
            <li>登入後可以查：勞保投保年資、投保資料（含投保薪資調整）、勞退個人專戶明細和累計金額，也可以用勞保局的資料試算勞保老年給付。</li>
          </ul>
          <h4>2. ATM 查：勞動保障卡或郵政金融卡</h4>
          <ul>
            <li>勞動保障卡（土地銀行、玉山、台北富邦、台新、第一銀行發卡）：在發卡銀行的 ATM 可以查、印最近 6 筆勞保異動、勞保年資、勞退提繳和累計金額；用發卡銀行的網路 ATM 可以連到 e 化服務系統看完整資料。</li>
            <li>郵政金融卡：先到郵局簽同意書，3 個工作天後可以在郵局 ATM 查、印同樣的資料。</li>
            <li>依據：<a href="https://www.bli.gov.tw/0108235.html" {...ext}>https://www.bli.gov.tw/0108235.html</a>、<a href="https://www.bli.gov.tw/0101813.html" {...ext}>https://www.bli.gov.tw/0101813.html</a></li>
          </ul>
          <h4>3. 臨櫃</h4>
          <p>帶有照片的身分證件（身分證、駕照、護照、健保卡）到勞保局各地辦事處，可以當場拿到勞保投保資料和勞退個人專戶資料。<a href="https://www.bli.gov.tw/0101813.html" {...ext}>https://www.bli.gov.tw/0101813.html</a></p>
          <h4>4. 電話</h4>
          <p>勞保局電話服務中心 (02)2396-1266 轉 3111，上班時間本人來電，可以查勞保總年資（只查年資，不提供金額）。</p>
          <h4>5. 最快的估法：看薪資單</h4>
          <ul>
            <li>雇主每月要用書面（例如薪資單）通知你勞退提繳了多少（<a href="https://www.bli.gov.tw/0101813.html" {...ext}>https://www.bli.gov.tw/0101813.html</a>）。</li>
            <li>勞退提繳薪資 ≈ 薪資單上的「雇主提繳勞退」金額 ÷ 6%。例如雇主提繳 3,036 元，3,036 ÷ 0.06 = 50,600 元。</li>
          </ul>
          <h4>6. 不用登入的官方試算（輸入自己估的數字）</h4>
          <ul>
            <li>勞保老年給付及勞退月退休金整合試算：<a href="https://www.bli.gov.tw/0109187.html" {...ext}>https://www.bli.gov.tw/0109187.html</a></li>
            <li>勞保老年年金簡易試算：<a href="https://www.bli.gov.tw/0100398.html" {...ext}>https://www.bli.gov.tw/0100398.html</a></li>
          </ul>
          <p className="note">本站的估算只用你的年齡和薪水推算，實際金額以勞保局資料為準。</p>
        </div>
      )}
    </div>
  );
}
