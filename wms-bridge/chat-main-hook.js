/* chat-main-hook.js — chạy ở MAIN world trên chat.hasaki.vn (v1.6.0, 25/09/2026).
 *
 * VÌ SAO CÓ FILE NÀY: chat.hasaki.vn theo LUẬT 1 PHIÊN như WMS — bot/cò TỰ đăng nhập là ĐÁ VĂNG
 * phiên cửa sổ đang làm của chính chủ (đã bị bắt quả tang 25/09). App còn ép nhập lại mật khẩu mỗi
 * phiên trình duyệt mới và token chỉ nằm trong bộ nhớ trang. Nên cách DUY NHẤT để bot đọc lịch phân
 * công vệ sinh nhắn hằng ngày trong nhóm là MƯỢN token của CHÍNH phiên người dùng đang mở — y hệt
 * cách wms-main-hook.js đang làm cho WMS/work/hr.
 *
 * CHỈ QUAN SÁT — không sửa request, không tạo request mới, KHÔNG đăng nhập, không đọc localStorage.
 * Mỗi request app tự bắn tới api.hasakichat.com mà có Authorization thì chép token ra postMessage
 * cho wms-relay.js (isolated world) chuyển tới service worker. Token là của chính người đang dùng
 * chat trên máy này, không đi đâu khác ngoài GAS của dự án. */
(() => {
  "use strict";
  const RE = /^(https?|wss?):\/\/[^/]*hasakichat\.com\//i;   // REST + WebSocket của chat
  let _cuoi = "", _lanBao = 0;

  function bao(auth) {
    try {
      if (!auth) return;
      const tok = String(auth).replace(/^Bearer\s+/i, "").trim();
      if (tok.length < 100) return;                 // token thật là JWT dài; bỏ chuỗi rác/ngắn
      const now = Date.now();
      if (tok === _cuoi && now - _lanBao < 60 * 1000) return;   // token cũ: nhắc lại tối đa mỗi 60s
      _cuoi = tok; _lanBao = now;
      window.postMessage({ __wmsBridgeTok: 1, tok, loai: "chat" }, window.location.origin);
    } catch (e) { /* quan sát lỗi thì bỏ qua — tuyệt đối không làm hỏng request của app */ }
  }

  // ---- fetch (app chat gọi REST: scrollLoad, getRoomAttributes… mang Bearer) ----
  const goc = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      if (RE.test(url)) {
        let a = "";
        if (init && init.headers) a = new Headers(init.headers).get("authorization") || "";
        if (!a && typeof Request !== "undefined" && input instanceof Request) a = input.headers.get("authorization") || "";
        if (a) bao(a);
      }
    } catch (e) { /* bỏ qua */ }
    return goc.apply(this, arguments);
  };

  // ---- XMLHttpRequest ----
  const oOpen = XMLHttpRequest.prototype.open;
  const oSet = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (m, url) {
    try { this.__chatUrl = String(url || ""); } catch (e) { /* bỏ qua */ }
    return oOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    try { if (/^authorization$/i.test(k) && RE.test(this.__chatUrl || "")) bao(String(v || "")); } catch (e) { /* bỏ qua */ }
    return oSet.apply(this, arguments);
  };

  // ---- localStorage (CHẮC ĂN NHẤT — 25/09: khe request/WS không ăn vì app chat có thể chỉ dùng
  //      Bearer từ localStorage cho một số call/WebSocket). Token của CHÍNH người đang đăng nhập trang
  //      này nằm ở localStorage key "chat_token"/"access_token". Đọc trên chính origin chat.hasaki.vn —
  //      không đụng site khác. Quét lúc tải + mỗi 15s (token đổi khi gia hạn) để luôn có bản mới nhất. ----
  const RE_JWT = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;   // JWT ở BẤT KỲ đâu trong chuỗi (kể cả bọc JSON)
  function laTokenChat(jwt) {
    try { const p = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      // token API chat có user_id/uid; loại token IdP (aud/iss là auth-gateway/oidc)
      const s = JSON.stringify(p).toLowerCase();
      if (/oidc|authorize|id_token/.test(s)) return false;
      return !!(p.user_id || p.uid || p.partner_user_id || /chat/.test(s) || p.sub);
    } catch (e) { return true; }   // không giải được payload thì cứ thử
  }
  function quetLocalStorage() {
    try {
      const ung = [];
      for (const store of [localStorage, sessionStorage]) {
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (/^oidc\./i.test(k)) continue;            // token của IdP, không phải API chat
          const raw = store.getItem(k) || "";
          const m = raw.match(RE_JWT);
          if (m) ung.push({ k, tok: m[0], uu: /chat|token|auth|access/i.test(k) });
        }
      }
      // ưu tiên khoá tên có chat/token/auth/access + payload giống token chat, rồi tới bất kỳ JWT nào
      ung.sort((a, b) => (b.uu - a.uu) || (b.tok.length - a.tok.length));
      const pick = ung.find((x) => laTokenChat(x.tok)) || ung[0];
      if (pick) bao(pick.tok);
    } catch (e) { /* localStorage bị chặn thì thôi — các kênh khác vẫn chạy */ }
  }
  quetLocalStorage();
  setInterval(quetLocalStorage, 15000);

  // ---- WebSocket (chat tải tin realtime qua WS; nhiều app nhét token vào query của URL WS) ----
  try {
    const OWS = window.WebSocket;
    if (OWS) {
      const Wrap = function (url, protocols) {
        try {
          const u = String(url || "");
          if (RE.test(u)) {
            const m = u.match(/[?&](token|access_token|authorization)=([^&]+)/i);
            if (m) bao(decodeURIComponent(m[2]));
          }
        } catch (e) { /* bỏ qua */ }
        return protocols === undefined ? new OWS(url) : new OWS(url, protocols);
      };
      Wrap.prototype = OWS.prototype;
      Wrap.CONNECTING = OWS.CONNECTING; Wrap.OPEN = OWS.OPEN; Wrap.CLOSING = OWS.CLOSING; Wrap.CLOSED = OWS.CLOSED;
      window.WebSocket = Wrap;
    }
  } catch (e) { /* trình duyệt chặn ghi đè WebSocket thì thôi — 2 kênh fetch/XHR vẫn chạy */ }
})();
