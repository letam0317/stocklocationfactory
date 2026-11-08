/* tat-loc.js — nút «✕» Tắt lọc đứng sát BÊN TRÁI mọi nút «Bộ lọc» (Retail + Factory, cả pop-up) — 22/10/2026, sửa 23/10/2026.
 * User 22/10: «tạo thêm nút x Tắt lọc kế bên trái nút Bộ lọc — áp dụng toàn bộ các bộ lọc ở các hạng mục hiện có của cả retail và factory».
 * User 23/10 (1): «chỉ sáng đèn nút tắt lọc, tô màu đỏ khi đang áp dụng bộ lọc — không có lọc gì thì ẩn».
 * User 23/10 (2): «di chuyển nút tắt lọc ra bên trái các bộ lọc — luật vẫn vậy, chỉ di chuyển vị trí — chỉ nút X, không thêm chữ».
 *   ✕ vẫn là con của nút (span role=button, chặn sự kiện để bấm ✕ không mở/đóng bộ lọc) nhưng vẽ TUYỆT ĐỐI ra ngoài mép trái
 *   ⇒ không chen vào bố cục hàng (khung space-between / lưới / order không xê dịch). Mép trái hết chỗ (nút sát lề) thì nằm trong nút, sau chữ.
 * Cách làm CHUNG (không sửa từng mục): trong cùng khung với nút «Bộ lọc» (panel / pop-up), đưa mọi điều kiện về MẶC ĐỊNH rồi bắn đúng sự kiện
 * mà mục đó vốn nghe — ô chọn: lựa chọn ĐẦU (đúng như mục tự tính «đang lọc»: Xác minh = khác opt[0], Vi phạm/Kiểm kê = khác "" đứng đầu)
 * + change (+ đồng bộ ô chọn đẹp _csWrap); ô gõ tìm: "" + input/change; bộ lọc ngày chuẩn (bo-loc-ngay.js): bấm nút «Xoá» sẵn có trong khung lịch.
 * 23/10 KIỂM ảnh user (screenshot-1792725099771: «Bộ lọc · đang lọc» mà không có ✕): bản «nhớ giá trị lúc ô hiện lần đầu» coi bộ lọc ĐÃ NHỚ
 *   từ lần trước là mặc định ⇒ ✕ ẩn. Nay: ô chọn so với lựa chọn đầu (không nhớ); ✕ còn bám TÍN HIỆU của chính mục (chữ «đang lọc» /
 *   lớp dang-loc / huy hiệu đếm Factory) — mục nói đang lọc là có ✕. Chỉ lịch ngày còn nhớ chữ lúc hiện đầu (mục có khoảng ngày mặc định).
 * 07/11: ✕ luôn nằm trong nút bên phải (user: «lệch khung — xấu»), ẩn mũi tên ▾ khi có ✕.
 * 07/11 (2) user DUYỆT «nút Bộ lọc mới» (mẫu nutLoc() của Bảo dưỡng) ⇒ áp CHUNG mọi nút «Bộ lọc» Retail + Factory + pop-up:
 *   · không lọc: «Bộ lọc ▾» màu thường (kể cả khi đang mở khối lọc — luật màu ở CSS của từng trang);
 *   · đang lọc: lớp .tl-dang — CHỈ chữ «Đang lọc» (span .tl-chu; chữ gốc của mục vẫn nằm trong nút nhưng cỡ chữ 0 ⇒ mục ghi lại chữ
 *     nút khi vẽ lại không đánh nhau với bộ này), chữ + viền đỏ, nền đỏ rất nhạt, ✕ đỏ tròn tuyệt đối bên phải TRONG nút, không mũi tên,
 *     «tâm chấn» 2 vòng lan lệch nhịp 2,4 s = outline + ::after của chính nút (::before để yên: điện thoại dùng làm vùng bấm lớn).
 * 07/11 (3) user chốt «dấu x đỏ của nút Đang lọc ✕ là thiết kế CHUẨN cho MỌI dấu x»: lớp dùng chung .x-do (vòng tròn đỏ var(--bad) Ø18,
 *   × trắng var(--surface) 14/700, rê sẫm nhẹ). Vòng vẽ bằng radial-gradient GIỮA hộp sẵn có ⇒ nút giữ nguyên kích thước / vùng bấm (không nhảy
 *   bố cục, nút đóng pop-up vẫn ≥44 px). Bộ này TỰ gắn .x-do cho mọi phần tử bấm được mà chữ chỉ là 1 dấu × / ✕ / ✖ (đóng pop-up, bỏ SKU,
 *   bỏ từ khoá…). Mục mới: chỉ cần chữ «×» (hoặc tự đặt class="x-do"). Bảo dưỡng tự đặt lớp (#pane-baoduong không tự gắn).
 * Bản chép: factory/tat-loc.js (sửa ở đây rồi chép sang). */
(function () {
  if (window.__TAT_LOC) return; window.__TAT_LOC = 1;
  var KHUNG = ".modal-box,.modalbox,.hp-modalbox,.hk-modalbox,.ht-modalbox,.hk-dau-panel,.kk-dau-panel,.panel,.pane,section";   // 26/10: + khung pop-up module (nút «Bộ lọc» của loc-popup.js)
  var chuNut = function (b) { var c = b.cloneNode(true); c.querySelectorAll(".tat-loc,.tl-chu").forEach(function (x) { x.remove(); }); return (c.textContent || "").trim(); };
  var la = function (el) { return el.tagName === "BUTTON" && /^Bộ lọc/.test(chuNut(el)) && !el.classList.contains("tat-loc") && !el.classList.contains("bl-moi"); };   // .bl-moi (Bảo dưỡng nutLoc) = mẫu gốc tự vẽ «Đang lọc» + ✕ riêng
  /* mục tự báo đang lọc: chữ «đang lọc», lớp dang-loc, huy hiệu đếm (Factory «Bộ lọc nâng cao» n) */
  var mucBaoLoc = function (b) { var bd = b.querySelector(".fk-adv-badge"); return /đang lọc/.test(chuNut(b)) || b.classList.contains("dang-loc") || !!(bd && !bd.classList.contains("empty") && +bd.textContent > 0); };
  function oCuaKhung(k) {   // các điều kiện lọc trong khung — bỏ qua ô trong bảng dữ liệu / ô quyết định / chính các nút
    var ds = [].slice.call(k.querySelectorAll("select, input[type=search], input[type=text], input:not([type]), .date-filter"));
    return ds.filter(function (x) { return !x.closest("table, .menu, .date-pop, .tk-f, .hx-qd, [data-khong-tat-loc]") && !(x.matches("input") && x.closest(".date-filter")) && !x.disabled; });
  }
  var MD = {};   // lịch ngày: khoá → chữ lúc hiện lần đầu
  function chuNgay(x) { var s = x.querySelector(".dp-sel"); return s ? s.textContent.trim() : ""; }
  function khoaNgay(x) { var k = x.closest(KHUNG); return ((k && (k.id || ((k.parentElement && k.parentElement.closest("[id]")) || {}).id)) || "") + "|" + (x.dataset.ngay || [].indexOf.call(k ? k.querySelectorAll(".date-filter") : [], x)); }
  function ngayMacDinh(x) {
    var kk = khoaNgay(x);
    if (!(kk in MD)) MD[kk] = chuNgay(x);
    return MD[kk];
  }
  function dangLoc(x) {
    if (x.classList.contains("date-filter")) {
      if (x.__ngay) { var md = x.__ngay.macDinh(), v = x.__ngay.lay(); return String(v[0] || "") + "|" + String(v[1] || "") !== String(md[0] || "") + "|" + String(md[1] || ""); }   // 23/10 trạng thái THẬT của lịch
      var c = chuNgay(x); return c !== "Chưa chọn" && c !== ngayMacDinh(x); }
    if (x.tagName === "SELECT") return x.options.length > 0 && x.value !== x.options[0].value;
    return !!String(x.value || "").trim();
  }
  function tatLoc(k, manh) {   // manh = mục báo đang lọc ⇒ lịch ngày khác «Chưa chọn» cũng xoá (khoảng ngày đặt từ trước khi trang mở)
    oCuaKhung(k).forEach(function (x) {
      /* «Xoá» trả về mặc định của mục (mục bắt buộc có ngày → hôm nay/hôm qua) ⇒ chữ sau Xoá chính là mặc định */
      if (x.classList.contains("date-filter") && x.__ngay) { if (dangLoc(x)) x.__ngay.xoa(); return; }   // 23/10 Theo máy: lịch dời ra body → .dp-clear không còn trong ô, xoá thẳng qua API
      if (x.classList.contains("date-filter")) { if (dangLoc(x) || (manh && chuNgay(x) !== "Chưa chọn")) { var b = x.querySelector(".dp-clear"); if (b) { b.click(); MD[khoaNgay(x)] = chuNgay(x); } } return; }
      if (!dangLoc(x)) return;
      if (x.tagName === "SELECT") { x.selectedIndex = 0;
        x.dispatchEvent(new Event("change", { bubbles: true })); if (x._csWrap && typeof x._csWrap._csDongBo === "function") x._csWrap._csDongBo(); return; }
      x.value = ""; x.dispatchEvent(new Event("input", { bubbles: true })); x.dispatchEvent(new Event("change", { bubbles: true }));
      x.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Backspace" }));
    });
  }
  function bam(ev) {
    ev.preventDefault(); ev.stopPropagation();
    var nut = ev.currentTarget, b = nut.parentNode, k = nut.closest(KHUNG); if (k) tatLoc(k, !!b && mucBaoLoc(b)); setTimeout(henGan, 60);
  }
  function gan() {
    [].slice.call(document.querySelectorAll("button")).forEach(function (b) {
      if (!la(b)) return; var k = b.closest(KHUNG); if (!k) return;
      var nut = b.querySelector(":scope > .tat-loc");
      if (!nut) {
        nut = document.createElement("span"); nut.className = "tat-loc x-do";   // 07/11 x-do = mặt dấu x chuẩn chung nut.setAttribute("role", "button"); nut.tabIndex = 0;
        nut.setAttribute("aria-label", "Bỏ lọc"); nut.title = "Bỏ lọc — bỏ mọi điều kiện lọc ở khung này"; nut.textContent = "×";
        nut.addEventListener("click", bam);
        nut.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") bam(ev); });
        b.appendChild(nut);
      }
      var hien = mucBaoLoc(b) || oCuaKhung(k).some(dangLoc);
      nut.hidden = !hien; datDang(b, nut, hien);
      if (!hien) { if (b.dataset.tlMl != null) { b.style.removeProperty("margin-left"); if (b.dataset.tlMl) b.style.marginLeft = b.dataset.tlMl; delete b.dataset.tlMl; } return; }
      if (getComputedStyle(b).position === "static") b.classList.add("tl-goc");
      /* 07/11 user «dấu x bị lệch khung — xấu»: ✕ vẽ ngoài mép trái lệch khỏi hàng ⇒ nay LUÔN nằm TRONG nút, bên phải chữ, thay mũi tên ▾ (khuôn nút Bộ lọc mới) */
      if (!nut.classList.contains("tl-trong")) nut.classList.add("tl-trong");
    });
  }
  function datDang(b, nut, on) {   // 07/11 khuôn «Đang lọc» (chỉ đổi khi trạng thái đổi ⇒ không tự kích MutationObserver vòng lặp)
    var s = b.querySelector(":scope > .tl-chu");
    if (!on) { if (b.classList.contains("tl-dang")) { b.classList.remove("tl-dang"); b.style.removeProperty("--tl-co"); } if (s) s.remove(); return; }
    if (!b.classList.contains("tl-dang")) { b.style.setProperty("--tl-co", getComputedStyle(b).fontSize); b.classList.add("tl-dang"); }
    if (!s) { s = document.createElement("span"); s.className = "tl-chu"; s.textContent = "Đang lọc"; b.insertBefore(s, nut); }
    else if (s.nextSibling !== nut) b.insertBefore(s, nut);
  }
  /* 07/11 dấu x chuẩn: tìm nút chữ «×/✕/✖» bằng XPath (nhanh, không quét mọi phần tử) */
  var XP = "//text()[normalize-space()='×' or normalize-space()='✕' or normalize-space()='✖']";
  function ganX() {
    var r; try { r = document.evaluate(XP, document.body || document.documentElement, null, 7, null); } catch (e) { return; }
    for (var i = 0; i < r.snapshotLength; i++) {
      var t = r.snapshotItem(i), e = t.parentElement; if (!e || e.classList.contains("x-do")) continue;
      if (e.closest(".tat-loc,.bl-cum,#pane-baoduong,.vp-oc,[data-khong-x-do]") || (e.textContent || "").trim() !== t.nodeValue.trim()) continue;
      var bam = e.matches("button,[role=button],a,[onclick]") || (getComputedStyle(e).cursor === "pointer" && !(e.parentElement && getComputedStyle(e.parentElement).cursor === "pointer"));
      if (!bam) continue;
      e.classList.add("x-do");
    }
  }
  var hT = 0; function henGan() { clearTimeout(hT); hT = setTimeout(function () { gan(); ganX(); }, 150); }
  var st = document.createElement("style");
  st.textContent = ".tl-goc{position:relative}" +
    ".tat-loc{position:absolute;right:calc(100% + 6px);top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;" +
    "margin:0;padding:0;border-radius:50%;background:var(--bad);color:var(--accent-text);font-size:11px;font-weight:700;line-height:1;cursor:pointer;z-index:1}" +
    ".tat-loc.tl-trong{position:static;transform:none;flex:none;width:16px;height:16px;margin:0 -4px 0 2px;font-size:9.5px;vertical-align:middle}" +
    "button:has(>.tat-loc.tl-trong:not([hidden])):not(.tl-dang)::after{display:none!important}" +
    /* 07/11 nút «Đang lọc» — y hệt .bl-moi của Bảo dưỡng (hasaki-baoduong.js «nút Bộ lọc mới») */
    "button.tl-dang.tl-dang{font-size:0!important;font-weight:600!important;border-color:var(--bad)!important;color:var(--bad)!important;" +
      "background:color-mix(in srgb,var(--bad) 7%,var(--surface))!important;padding-right:30px!important;gap:0!important;isolation:isolate;" +
      "outline:1.5px solid transparent;outline-offset:0;animation:tlTamChan 2.4s cubic-bezier(.2,.6,.3,1) infinite}" +
    "button.tl-dang>:not(.tl-chu):not(.tat-loc){display:none!important}" +
    "button.tl-dang>.tl-chu{font-size:var(--tl-co,12px);line-height:1;font-weight:600;color:inherit;white-space:nowrap}" +
    "button.tl-dang>.tat-loc.tat-loc{position:absolute;right:5px;top:50%;transform:none;width:18px;height:18px;margin:-9px 0 0;" +
      "background:var(--bad);color:var(--surface);font:700 14px/18px system-ui,sans-serif;z-index:2}" +
    "button.tl-dang.tl-dang::after{content:''!important;display:block!important;position:absolute!important;inset:0!important;width:auto!important;height:auto!important;" +
      "margin:0!important;padding:0!important;border:1.5px solid var(--bad)!important;border-radius:inherit;background:none!important;z-index:-1;pointer-events:none;" +
      "transition:none!important;animation:blTamChan 2.4s cubic-bezier(.2,.6,.3,1) 1.2s infinite both}" +
    "@keyframes tlTamChan{0%{outline-offset:0;outline-color:color-mix(in srgb,var(--bad) 60%,transparent)}70%{outline-color:color-mix(in srgb,var(--bad) 12%,transparent)}" +
      "100%{outline-offset:10px;outline-color:transparent}}" +
    "@keyframes blTamChan{0%{transform:scale(1);opacity:.6}70%{opacity:.12}100%{transform:scale(1.3,1.75);opacity:0}}" +
    "@media (prefers-reduced-motion:reduce){button.tl-dang.tl-dang{animation:none}button.tl-dang.tl-dang::after{animation:none;opacity:0}}" +
    /* 07/11 dấu x CHUẨN toàn dự án (.x-do) — cùng mặt ✕ của nút Đang lọc */
    /* × vẽ bằng 2 dải chéo (màu var(--surface)) trên vòng đỏ; chữ gốc trong suốt nhưng GIỮ cỡ chữ ⇒ hộp nút y nguyên chỗ cũ */
    ".x-do.x-do{--xd:linear-gradient(45deg,transparent calc(50% - .9px),var(--surface) calc(50% - .9px),var(--surface) calc(50% + .9px),transparent calc(50% + .9px));" +
      "background:var(--xd) center/8px 8px no-repeat,linear-gradient(-45deg,transparent calc(50% - .9px),var(--surface) calc(50% - .9px),var(--surface) calc(50% + .9px),transparent calc(50% + .9px)) center/8px 8px no-repeat," +
      "radial-gradient(circle closest-side,var(--bad) calc(100% - .5px),transparent 100%) center/18px 18px no-repeat!important;" +
      "color:transparent!important;text-shadow:none!important;border-color:transparent!important;box-shadow:none!important;cursor:pointer}" +
    ":is(span,i,a,b).x-do.x-do{display:inline-block;min-width:18px;min-height:18px;vertical-align:middle}" +
    ".x-do.x-do:hover{filter:brightness(.88)}.x-do.x-do:focus-visible{outline:2px solid var(--bad);outline-offset:2px}" +
    ".tat-loc:hover{filter:brightness(1.12)}.tat-loc:focus-visible{outline:2px solid var(--bad);outline-offset:2px}.tat-loc[hidden]{display:none!important}";
  (document.head || document.documentElement).appendChild(st);
  var rT = 0;
  new MutationObserver(function (ms) {
    if (!ms.some(function (m) { return !(m.target.closest && m.target.closest(".tat-loc")); })) return;
    /* chữ nút «Bộ lọc» vừa bị ghi lại → ✕ rơi mất: gắn lại ngay khung hình sau, khỏi chớp */
    if (ms.some(function (m) { return m.target.tagName === "BUTTON" && la(m.target); })) { cancelAnimationFrame(rT); rT = requestAnimationFrame(gan); }
    henGan();
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  document.addEventListener("change", henGan, true); document.addEventListener("input", henGan, true);
  window.addEventListener("resize", henGan);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { gan(); ganX(); }); else { gan(); ganX(); }

  /* 08/11 user «toàn bộ Bộ lọc dạng NGĂN KÉO — không xô đẩy khung dữ liệu» (TK-28): khối .panel > .filters nổi (CSS index.html).
     Ở đây: (1) đặt --loc-top = đáy đầu khung thật (đầu khung có thể cao khác 40 px) lúc ngăn mở; (2) bấm ra ngoài ngăn / Esc ⇒ đẩy ngăn vào
     bằng CHÍNH nút Bộ lọc của khung (giữ logic riêng từng mô-đun). Lịch chọn ngày / ô chọn gắn ra body vẫn tính là «trong ngăn». */
  var NGOAI_OK = ".date-pop,.dp-sheet,.cs-list,.cs,.hsk-toast,.toast,[role=dialog]";
  var NGAN = ".panel > .filters:not(.collapsed),.pg-locbody:not(.collapsed)";   // .pg-locbody = Tiến độ Planogram Factory
  function nganMo() { return [].filter.call(document.querySelectorAll(NGAN), function (f) { return f.offsetParent !== null; }); }
  function datTop(f) { var h = f.previousElementSibling; if (h) f.parentNode.style.setProperty("--loc-top", (h.offsetTop + h.offsetHeight) + "px"); }
  function nutCua(f) { var h = f.previousElementSibling; return (h && h.querySelector(".btn-filter")) || f.parentNode.querySelector(".btn-filter"); }
  new MutationObserver(function () { nganMo().forEach(datTop); }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["class"] });
  document.addEventListener("click", function (ev) {
    var t = ev.target; if (!t || !t.closest || !document.contains(t) || t.closest(NGOAI_OK)) return;
    nganMo().forEach(function (f) { var b = nutCua(f); if (!b || f.contains(t) || b.contains(t)) return; b.click(); });
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape" || document.querySelector(".date-pop:not(.hidden),.cs.show")) return;
    var ds = nganMo(); if (!ds.length) return;
    ds.forEach(function (f) { var b = nutCua(f); if (b) b.click(); }); ev.stopPropagation();
  }, true);
})();
