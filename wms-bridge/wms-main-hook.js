/* wms-main-hook.js — chạy ở MAIN world trên wms.inshasaki.com (v1.2.0, 22/07/2026).
 *
 * VÌ SAO CÓ FILE NÀY: kênh cũ chỉ dựa webRequest.onSendHeaders trong service worker MV3 —
 * SW ngủ sau ~30s nên BỎ LỠ request (operator bấm menu WMS lúc SW ngủ = không nghe được
 * token, bridge trống, máy trạm phải re-login = đá phiên). Hook fetch/XHR ngay trong trang
 * thì KHÔNG BAO GIỜ lỡ: mỗi request mang Authorization đều báo về relay (isolated world),
 * relay sendMessage đánh THỨC service worker dậy để lưu + đẩy GAS.
 *
 * CHỈ QUAN SÁT — không sửa request, không tạo request mới, không đăng nhập. */
(() => {
  "use strict";
  const GW = /^https:\/\/wms-gw\.inshasaki\.com\//;
  let _cuoi = "", _lanBao = 0;

  function bao(auth) {
    try {
      if (!auth || !/^Bearer\s+/i.test(auth)) return;
      const tok = auth.replace(/^Bearer\s+/i, "").trim();
      if (tok.length < 100) return;
      const now = Date.now();
      // token đổi → báo ngay; token cũ → nhắc lại mỗi 60s (giữ mốc "còn tươi" + đánh thức SW đều đặn)
      if (tok === _cuoi && now - _lanBao < 60 * 1000) return;
      _cuoi = tok; _lanBao = now;
      window.postMessage({ __wmsBridgeTok: 1, tok }, window.location.origin);
    } catch (e) { /* quan sát thất bại thì bỏ qua — không được làm hỏng request của app */ }
  }

  // ---- fetch ----
  const goc = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      if (GW.test(url)) {
        let a = "";
        if (init && init.headers) a = new Headers(init.headers).get("authorization") || "";
        if (!a && typeof Request !== "undefined" && input instanceof Request) a = input.headers.get("authorization") || "";
        bao(a);
      }
    } catch (e) { /* bỏ qua */ }
    return goc.apply(this, arguments);
  };

  // ---- XMLHttpRequest ----
  const oOpen = XMLHttpRequest.prototype.open;
  const oSet = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (m, url) {
    try { this.__wmsUrl = String(url || ""); } catch (e) { /* bỏ qua */ }
    return oOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    try { if (/^authorization$/i.test(k) && GW.test(this.__wmsUrl || "")) bao(String(v || "")); } catch (e) { /* bỏ qua */ }
    return oSet.apply(this, arguments);
  };
})();
