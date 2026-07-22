/* wms-relay.js — isolated world trên wms.inshasaki.com: nhận token từ wms-main-hook.js
 * (MAIN world, qua postMessage) rồi chuyển cho background bằng runtime.sendMessage.
 * sendMessage ĐÁNH THỨC service worker MV3 — vá gốc rễ vụ SW ngủ bỏ lỡ token (21/07/2026). */
window.addEventListener("message", (ev) => {
  if (ev.source !== window || ev.origin !== window.location.origin) return;
  const d = ev.data;
  if (!d || d.__wmsBridgeTok !== 1 || !d.tok) return;
  try {
    chrome.runtime.sendMessage({ type: "wmsTokenFromPage", token: String(d.tok) }, () => {
      // đọc lastError để khỏi văng "Unchecked runtime.lastError" khi SW đang khởi động lại
      void chrome.runtime.lastError;
    });
  } catch (e) { /* extension đang reload — lần báo sau (≤60s) sẽ tới */ }
});
