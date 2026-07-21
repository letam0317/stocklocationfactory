/* background.js — "nghe" header Authorization từ chính request WMS của operator rồi lưu lại.
 * KHÔNG đăng nhập, KHÔNG can thiệp request (chỉ QUAN SÁT onSendHeaders) -> không tạo phiên mới,
 * không thể đá phiên ai. Token là của chính operator đang đăng nhập WMS trong trình duyệt này.
 *
 * Từ 21/07/2026 token còn được ĐẨY LÊN GAS (action bridgeToken) để MÁY TRẠM đồng bộ dùng lại
 * phiên đang sống này thay vì tự re-login SSO (re-login = đá văng operator vì WMS 1 phiên/tài
 * khoản). Chỉ gửi tới đúng Apps Script của dự án, throttle phía client + server. */
const KEY = "wms_token";
const GAS_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const PUSH_KEY = "wms_token_push";   // {at, token} lần đẩy GAS gần nhất (storage.session — sống qua các lần SW ngủ)

// GAS đã có kênh bridge chưa? — probe GET công khai ?action=bridgeCaps, cache 30'.
// BẮT BUỘC probe trước khi POST: bản GAS cũ gặp action lạ sẽ rơi nhánh appendRow (ghi rác sheet 5S).
async function coBridgeCap() {
  const o = await chrome.storage.session.get("bridge_cap");
  const c = o && o.bridge_cap;
  if (c && Date.now() - c.at < 30 * 60 * 1000) return c.ok;
  let ok = false;
  try {
    const r = await fetch(GAS_URL + "?action=bridgeCaps");
    const j = await r.json();
    ok = !!(j && j.bridgeToken);
  } catch (e) { /* mạng lỗi → coi như chưa có, 30' sau probe lại */ }
  await chrome.storage.session.set({ bridge_cap: { ok, at: Date.now() } });
  return ok;
}

// Đẩy token lên GAS cho máy trạm: token MỚI thì đẩy ngay (cách tối thiểu 20s),
// token cũ thì 3 phút nhắc lại 1 lần (giữ mốc "còn tươi" phía GAS). Lỗi mạng bỏ qua êm.
async function pushBridge(token, exp) {
  try {
    const o = await chrome.storage.session.get(PUSH_KEY);
    const p = (o && o[PUSH_KEY]) || { at: 0, token: "" };
    const now = Date.now();
    const doiToken = token !== p.token;
    if (now - p.at < (doiToken ? 20 * 1000 : 3 * 60 * 1000)) return;
    if (!(await coBridgeCap())) return;   // GAS chưa redeploy bản có bridge → chưa đẩy
    await chrome.storage.session.set({ [PUSH_KEY]: { at: now, token } });
    await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "bridgeToken", token, exp: exp || 0 }),
    });
  } catch (e) { /* mạng lỗi — bỏ qua, lần sau thử lại */ }
}

// Bearer là header được bảo vệ -> cần "extraHeaders" mới đọc được trong onSendHeaders.
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    try {
      const h = (details.requestHeaders || []).find((x) => x.name.toLowerCase() === "authorization");
      if (!h || !h.value || !/^Bearer\s+/i.test(h.value)) return;
      const token = h.value.replace(/^Bearer\s+/i, "").trim();
      if (token.length < 20) return;
      // decode exp (JWT) để dashboard biết token còn hạn — không bắt buộc, lỗi thì bỏ qua
      let exp = 0;
      try { exp = (JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp || 0) * 1000; } catch (e) {}
      chrome.storage.session.set({ [KEY]: { token, at: Date.now(), exp } });
      pushBridge(token, exp);   // cho máy trạm dùng lại phiên này — không đá ai
    } catch (e) {}
  },
  { urls: ["https://wms-gw.inshasaki.com/*"] },
  ["requestHeaders", "extraHeaders"]
);

// Content script trên trang dashboard hỏi token -> trả token mới nhất đã nghe được.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "getToken") return;
  chrome.storage.session.get(KEY).then((o) => {
    const t = o && o[KEY];
    // token quá cũ (>25') hoặc đã hết hạn -> coi như không có, để dashboard nhắc mở lại WMS
    const stale = !t || (t.exp && Date.now() > t.exp - 15000) || (Date.now() - (t.at || 0) > 25 * 60 * 1000);
    sendResponse(stale ? { token: "", at: 0 } : { token: t.token, at: t.at, exp: t.exp });
  });
  return true;   // async sendResponse
});
