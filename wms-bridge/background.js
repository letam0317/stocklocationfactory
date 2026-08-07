/* background.js — "nghe" header Authorization từ chính request WMS của operator rồi lưu lại.
 * KHÔNG đăng nhập, KHÔNG can thiệp request (chỉ QUAN SÁT onSendHeaders + hook fetch/XHR) ->
 * không tạo phiên mới, không thể đá phiên ai. Token là của chính operator đang đăng nhập WMS.
 *
 * Từ 21/07/2026 token còn được ĐẨY LÊN GAS (action bridgeToken) để MÁY TRẠM đồng bộ dùng lại
 * phiên đang sống này thay vì tự re-login SSO (re-login = đá văng operator vì WMS 1 phiên/tài
 * khoản). Chỉ gửi tới đúng Apps Script của dự án, throttle phía client + server.
 *
 * v1.3.0 (23/07/2026) — GIỮ TOKEN SỐNG CHỦ ĐỘNG + CHỈ ĐẨY TOKEN ĐÃ XÁC THỰC:
 *   Sự cố 23/07: cụm 8h40 hoãn vì token bridge trên GAS đã CHẾT (get-me 401) — bản cũ bắt
 *   token thụ động: chỉ tóm khi SPA tự bắn request, và cứ 3' NHẮC LẠI ĐÚNG CHUỖI CŨ mà KHÔNG
 *   hề kiểm sống/chết -> khi operator bị đá phiên (ai đó đăng nhập, token cũ 401 dù JWT còn hạn),
 *   extension VẪN ôm + đẩy XÁC CHẾT lên GAS -> máy trạm kéo về 401 -> hoãn -> dữ liệu đứng im.
 *   Cải tiến: (1) chrome.alarms 2' tự gọi get-me token đang giữ; (2) get-me là CỬA CHẶN trước
 *   khi đẩy — chỉ đẩy token 200; (3) token 401/403 -> NGỪNG đẩy + xoá token đã lưu (dashboard
 *   thấy "chưa có token sống" thay vì tưởng còn sống). Token mới do SPA mint khi operator thao
 *   tác sẽ được hook bắt lại -> tự lành. */
/* v1.4.0 (30/07/2026) — HAI KHE TOKEN:
 *   wms  = wms-gw.inshasaki.com  (trọng tài: get-me)
 *   wshr = wshr.hasaki.vn        (work/hr — trọng tài: search-for-dropdown?limit=1, đúng cách
 *                                 pull-timesheet/login-hasaki đang dùng để thử token wshr)
 * Khe wshr vừa cấp token cho bộ 5S/chấm công, vừa là tín hiệu CÓ NGƯỜI ĐANG LÀM: trước đây
 * người mở work/hr mà không mở WMS thì bridge im → máy trạm tưởng vắng → đăng nhập đè → đá phiên.
 * Khe wshr CHỈ được đẩy khi GAS đã có kênh (probe bridgeCaps.bridgeWshr) — bản GAS cũ bỏ qua
 * trường `kind` nên nếu đẩy mù sẽ GHI ĐÈ token WMS bằng token wshr (máy trạm get-me 401). */
const KEY = "wms_token";
const GAS_URL = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const GET_ME = "https://wms-gw.inshasaki.com/api/v1/auth/user/get-me";
const XAC_THUC_WSHR = "https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=1";
const PUSH_KEY = "wms_token_push";     // {at, token} lần đẩy GAS gần nhất (storage.session)
const KHE = {
  wms: { key: KEY, push: PUSH_KEY, xacThuc: GET_ME, nhan: "WMS" },
  wshr: { key: "wshr_token", push: "wshr_token_push", xacThuc: XAC_THUC_WSHR, nhan: "work/hr" },
};
const LOAI = Object.keys(KHE);
const kheCua = (loai) => KHE[loai] || KHE.wms;
const KEEP_ALARM = "wmsKeepAlive";     // alarm tự kiểm + giữ token tươi (2')
const CAP_V = 2;                       // version cache caps — tăng khi đổi hình dạng caps (v2: thêm khe wshr)
const KEEP_MIN = 2;                    // phút: chu kỳ tự kiểm sống + đẩy lại
let _lastHeard = "";                   // log gọn: token đổi mới log 1 dòng (reset khi SW ngủ — vô hại)
let _lastVerifyAt = 0;                 // throttle verify khi capture cùng 1 token (in-memory, reset khi SW ngủ)
let _lastHeardWshr = "";               // hai biến trên, bản cho khe work/hr (v1.4.0)
let _lastVerifyWshrAt = 0;

/* Đặt alarm định kỳ (idempotent — create cùng tên = thay). Alarm SỐNG QUA lúc SW ngủ và tự
 * đánh thức SW -> keep-alive chạy đều dù tab WMS đứng yên, không phụ thuộc SPA bắn request. */
function armAlarm() {
  try { chrome.alarms.create(KEEP_ALARM, { periodInMinutes: KEEP_MIN }); } catch (e) {}
}
chrome.runtime.onInstalled.addListener(armAlarm);
chrome.runtime.onStartup.addListener(armAlarm);
chrome.alarms.onAlarm.addListener((a) => { if (a && a.name === KEEP_ALARM) giuMoiKheSong("keepalive"); });

// GAS đã có kênh bridge chưa? — probe GET công khai ?action=bridgeCaps, cache 30'.
// BẮT BUỘC probe trước khi POST: bản GAS cũ gặp action lạ sẽ rơi nhánh appendRow (ghi rác sheet 5S).
async function coBridgeCap() {
  const o = await chrome.storage.session.get("bridge_cap");
  const c = o && o.bridge_cap;
  // Chỉ tin cache khi ok=TRUE (30'). ok=FALSE chỉ giữ 90s rồi probe lại — tránh 1 lần
  // lỗi mạng lúc mới nạp extension khoá chết việc đẩy token suốt 30' (bẫy cũ 21/07).
  // CAP_V: đổi mã extension (thêm khe wshr) => cache caps cũ KHÔNG còn dùng được. Không có mốc
  // version này thì một cache `{ok:true}` cũ (chưa có trường wshr) sẽ khoá việc đẩy token wshr
  // tới 30' sau khi Reload — ngồi chờ mà không hiểu vì sao.
  if (c && c.v === CAP_V && c.ok && Date.now() - c.at < 30 * 60 * 1000) return c;
  if (c && c.v === CAP_V && !c.ok && Date.now() - c.at < 90 * 1000) return c;
  let ok = false, wshr = false;
  try {
    const r = await fetch(GAS_URL + "?action=bridgeCaps");
    const j = await r.json();
    ok = !!(j && j.bridgeToken);
    wshr = !!(j && j.bridgeWshr);   // GAS bản cũ không có → KHÔNG đẩy khe wshr (tránh ghi đè token WMS)
  } catch (e) { console.warn("[bridge] probe bridgeCaps LỖI (thử lại sau 90s):", e && e.message); }
  console.log("[bridge] probe bridgeCaps:", ok ? "GAS CÓ kênh bridge" : "GAS KHÔNG có kênh bridge",
    "· khe wshr:", wshr ? "CÓ" : "chưa (GAS cần deploy bản mới)");
  const cap = { v: CAP_V, ok, wshr, at: Date.now() };
  await chrome.storage.session.set({ bridge_cap: cap });
  return cap;
}

/* get-me là TRỌNG TÀI sống/chết (giống session-rules.js phía máy trạm). GET chỉ mang header
 * Authorization, KHÔNG kèm cookie -> chỉ KIỂM, không đăng nhập, không đá phiên ai.
 * Trả "alive" (2xx) | "dead" (401/403) | "unknown" (khác/lỗi mạng -> để yên, thử chu kỳ sau). */
async function kiemSong(token, loai) {
  try {
    const r = await fetch(kheCua(loai).xacThuc, { headers: { authorization: /^Bearer /i.test(token) ? token : "Bearer " + token } });
    if (r.ok) return "alive";
    if (r.status === 401 || r.status === 403) return "dead";
    return "unknown";
  } catch (e) { return "unknown"; }
}

// Đẩy token (ĐÃ biết còn sống) lên GAS cho máy trạm: token MỚI đẩy ngay (cách tối thiểu 20s),
// token cũ nhắc lại mỗi KEEP_MIN phút (giữ mốc "còn tươi" phía GAS). Lỗi mạng bỏ qua êm.
async function pushBridge(token, exp, loai) {
  const kh = kheCua(loai);
  try {
    const o = await chrome.storage.session.get(kh.push);
    const p = (o && o[kh.push]) || { at: 0, token: "" };
    const now = Date.now();
    const doiToken = token !== p.token;
    if (now - p.at < (doiToken ? 20 * 1000 : KEEP_MIN * 60 * 1000)) return;
    const cap = await coBridgeCap();
    if (!cap.ok) return;                                  // GAS chưa redeploy bản có bridge → chưa đẩy
    if (loai === "wshr" && !cap.wshr) {                   // GAS cũ bỏ qua `kind` → đẩy mù sẽ ghi đè token WMS
      console.log("[bridge] khe work/hr: GAS chưa có kênh (bridgeWshr) — CHƯA đẩy, chờ deploy.");
      return;
    }
    await chrome.storage.session.set({ [kh.push]: { at: now, token } });
    const r = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "bridgeToken", kind: loai === "wshr" ? "wshr" : "wms", token, exp: exp || 0 }),
    });
    console.log("[bridge] đẩy token " + kh.nhan + " (đã xác thực OK) lên GAS:", r.status, (await r.text()).slice(0, 120));
  } catch (e) { console.warn("[bridge] đẩy token " + kh.nhan + " LỖI (lần sau thử lại):", e && e.message); }
}

/* CỬA CHẶN sống/chết dùng chung cho cả 2 lối: alarm keep-alive + lúc capture token mới.
 * - alive  -> cập nhật mốc 'at' (dashboard 1-click còn hạn) + đẩy lại GAS (verified-live).
 * - dead   -> XOÁ token đã lưu (ngừng đẩy xác chết; dashboard hiện "mở lại WMS"). Không xoá
 *             PUSH_KEY để throttle không nhả token cũ; token mới do SPA mint sẽ được bắt lại.
 * - unknown-> để yên, thử lại chu kỳ sau (tránh xoá oan lúc rớt mạng). */
async function giuTokenSong(reason, loai = "wms") {
  const kh = kheCua(loai);
  const o = await chrome.storage.session.get(kh.key);
  const t = o && o[kh.key];
  if (!t || !t.token) return;
  const tt = await kiemSong(t.token, loai);
  if (tt === "alive") {
    await chrome.storage.session.set({ [kh.key]: { token: t.token, at: Date.now(), exp: t.exp || 0 } });
    await pushBridge(t.token, t.exp, loai);
  } else if (tt === "dead") {
    console.log("[bridge] token " + kh.nhan + " đã CHẾT (401) — ngừng đẩy, chờ SPA mint token mới. (" + reason + ")");
    if (loai === "wms") _lastHeard = "";
    else _lastHeardWshr = "";
    await chrome.storage.session.set({ [kh.key]: { token: "", at: 0, exp: 0, deadAt: Date.now() } });
  }
}
/** Alarm keep-alive: kiểm + đẩy lại CẢ HAI khe (khe nào chưa có token thì tự thoát ngay). */
async function giuMoiKheSong(reason) { for (const l of LOAI) await giuTokenSong(reason, l); }

// Xử lý 1 token nghe được (dùng chung cho 2 kênh: webRequest + hook MAIN world qua relay).
function nhanToken(raw, loai = "wms") {
  try {
    const kh = kheCua(loai);
    const token = String(raw || "").replace(/^Bearer\s+/i, "").trim();
    if (token.length < 20) return;
    // decode exp (JWT) để dashboard biết token còn hạn — không bắt buộc, lỗi thì bỏ qua
    let exp = 0;
    try { exp = (JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp || 0) * 1000; } catch (e) {}
    const nghe = loai === "wshr" ? _lastHeardWshr : _lastHeard;
    const doiToken = token !== nghe;
    if (doiToken) {
      if (loai === "wshr") _lastHeardWshr = token; else _lastHeard = token;
      console.log("[bridge] nghe được token " + kh.nhan + " (đuôi …" + token.slice(-8) + ", exp " + (exp ? new Date(exp).toLocaleTimeString() : "?") + ")");
    }
    chrome.storage.session.set({ [kh.key]: { token, at: Date.now(), exp } });
    armAlarm();   // đảm bảo keep-alive đã bật (phòng SW mới dậy chưa qua onStartup)
    // Verify-before-push: token MỚI -> kiểm+đẩy ngay; token CŨ -> để alarm lo (tránh spam xác thực
    // khi SPA bắn liên tục cùng 1 token), nhưng nếu đã >90s chưa verify thì kiểm luôn.
    const now = Date.now();
    const moc = loai === "wshr" ? _lastVerifyWshrAt : _lastVerifyAt;
    if (doiToken || now - moc > 90 * 1000) {
      if (loai === "wshr") _lastVerifyWshrAt = now; else _lastVerifyAt = now;
      giuTokenSong(doiToken ? "capture-moi" : "capture-cu", loai);
    }
  } catch (e) {}
}

// Kênh 1 (cũ): webRequest — CHỈ hoạt động khi SW thức; Bearer là header được bảo vệ
// -> cần "extraHeaders" mới đọc được trong onSendHeaders.
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    const h = (details.requestHeaders || []).find((x) => x.name.toLowerCase() === "authorization");
    if (h && h.value && /^Bearer\s+/i.test(h.value)) {
      nhanToken(h.value, /^https:\/\/wshr\.hasaki\.vn\//.test(details.url || "") ? "wshr" : "wms");
    }
  },
  { urls: ["https://wms-gw.inshasaki.com/*", "https://wshr.hasaki.vn/*"] },
  ["requestHeaders", "extraHeaders"]
);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Kênh 2 (v1.2.0): hook fetch/XHR trong trang WMS (wms-main-hook.js → wms-relay.js).
  // sendMessage tự đánh thức SW → không còn cảnh SW ngủ bỏ lỡ token (bẫy 21/07).
  if (msg && msg.type === "wmsTokenFromPage") { nhanToken(msg.token, msg.loai === "wshr" ? "wshr" : "wms"); return; }
  // Content script trên trang dashboard hỏi token -> trả token mới nhất đã nghe được.
  if (!msg || msg.type !== "getToken") return;
  chrome.storage.session.get(KEY).then((o) => {
    const t = o && o[KEY];
    // token quá cũ (>25') hoặc đã hết hạn -> coi như không có, để dashboard nhắc mở lại WMS
    const stale = !t || !t.token || (t.exp && Date.now() > t.exp - 15000) || (Date.now() - (t.at || 0) > 25 * 60 * 1000);
    sendResponse(stale ? { token: "", at: 0 } : { token: t.token, at: t.at, exp: t.exp });
  });
  return true;   // async sendResponse
});
