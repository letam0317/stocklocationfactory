/* bridge.js — cầu nối chạy TRÊN trang dashboard (github.io). Chuyển tiếp yêu cầu token
 * giữa trang (window.postMessage) và background (chrome.runtime). Trang KHÔNG cần biết ID extension.
 * v1.4.1 (audit 23/08/2026): manifest thu hẹp match về ĐÚNG 2 dashboard
 * (/stocklocationfactory/* + /kiemsoatkho/* — trang lạ cùng host không xin được token nữa)
 * và postMessage ĐÍCH DANH location.origin thay vì "*". */
var GOC = location.origin;
window.addEventListener("message", function (e) {
  if (e.source !== window || e.origin !== GOC || !e.data || e.data.__wmsbridge !== "req") return;
  try {
    chrome.runtime.sendMessage({ type: "getToken" }, function (resp) {
      window.postMessage({ __wmsbridge: "resp", token: (resp && resp.token) || "", at: (resp && resp.at) || 0, exp: (resp && resp.exp) || 0 }, GOC);
    });
  } catch (err) {
    window.postMessage({ __wmsbridge: "resp", token: "", at: 0 }, GOC);
  }
});
// Báo cho trang biết extension đã có mặt (để dashboard bật nút 1-click)
window.postMessage({ __wmsbridge: "hello", v: "1.4.1" }, GOC);
