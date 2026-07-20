/* bridge.js — cầu nối chạy TRÊN trang dashboard (github.io). Chuyển tiếp yêu cầu token
 * giữa trang (window.postMessage) và background (chrome.runtime). Trang KHÔNG cần biết ID extension. */
window.addEventListener("message", function (e) {
  if (e.source !== window || !e.data || e.data.__wmsbridge !== "req") return;
  try {
    chrome.runtime.sendMessage({ type: "getToken" }, function (resp) {
      window.postMessage({ __wmsbridge: "resp", token: (resp && resp.token) || "", at: (resp && resp.at) || 0, exp: (resp && resp.exp) || 0 }, "*");
    });
  } catch (err) {
    window.postMessage({ __wmsbridge: "resp", token: "", at: 0 }, "*");
  }
});
// Báo cho trang biết extension đã có mặt (để dashboard bật nút 1-click)
window.postMessage({ __wmsbridge: "hello", v: "1.0.0" }, "*");
