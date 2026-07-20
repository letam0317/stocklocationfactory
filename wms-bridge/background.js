/* background.js — "nghe" header Authorization từ chính request WMS của operator rồi lưu lại.
 * KHÔNG đăng nhập, KHÔNG can thiệp request (chỉ QUAN SÁT onSendHeaders) -> không tạo phiên mới,
 * không thể đá phiên ai. Token là của chính operator đang đăng nhập WMS trong trình duyệt này. */
const KEY = "wms_token";

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
