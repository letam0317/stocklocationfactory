/* anh-nv.js — ẢNH ĐẠI DIỆN NHÂN VIÊN TOÀN DỰ ÁN (05/11/2026). Bản gốc: hasaki/kiemsoatkho/anh-nv.js — tệp này là bản chép Y HỆT.
 * User 05/11: «các ô tròn có tên viết tắt thay ảnh avatar — toàn dự án».
 * Nguồn: tab RIÊNG NHAN-SU-ANH (anh-dai-dien.mjs trên laptop thu ảnh hr-media còn 64 px webp, ~0,7 KB/người) — đọc 1 lần / trang
 * qua readTab (khoá thiết bị), giữ trong phiên (sessionStorage) để chuyển tab không tải lại.
 * Cách dùng ở mô-đun: vòng tròn chữ cái thêm thuộc tính `data-anh-nv="<họ tên>"` (tuỳ chọn `data-anh-em="<email>"`) — tệp này tự
 * gắn <img> vào và thêm lớp .co-anh khi có ảnh; không có ảnh thì giữ nguyên chữ cái. Không cần gọi hàm, không vẽ lại mô-đun. */
(function () {
  if (window.hskAnhNV) return;
  var URL_GAS = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
  var TAB = "NHAN-SU-ANH", KHOA_PHIEN = "anh-nv-v1", theoTen = null, theoEm = {}, dangTai = false;
  var chuan = function (s) { return String(s == null ? "" : s).normalize("NFC").replace(/\s+/g, " ").trim().toUpperCase(); };
  var tb = function () { try { return localStorage.getItem("tb-khoa") || (localStorage.getItem("tk-phien") ? "tk:" + localStorage.getItem("tk-phien") : ""); } catch (e) { return ""; } };
  function nap(rows, H) {
    theoTen = {}; theoEm = {};
    var iT = H.indexOf("TÊN"), iE = H.indexOf("EMAIL"), iA = H.indexOf("ẢNH");
    rows.forEach(function (r) { var a = String(r[iA] || ""); if (!/^data:image\//.test(a)) return;
      theoTen[chuan(r[iT])] = a; if (r[iE]) theoEm[String(r[iE]).toLowerCase()] = a; });
  }
  function tai() {
    if (theoTen || dangTai) return;
    try { var c = JSON.parse(sessionStorage.getItem(KHOA_PHIEN) || "null"); if (c && c.rows && Date.now() - c.luc < 6 * 3600e3) { nap(c.rows, c.H); gan(document); return; } } catch (e) {}
    if (!tb()) { theoTen = {}; return; }   // máy chưa có khoá ⇒ không đọc được tab riêng — giữ chữ cái
    dangTai = true;
    var cb = "anhnv_" + Date.now(), s = document.createElement("script"), xong = function () { dangTai = false; delete window[cb]; s.remove(); };
    window[cb] = function (j) {
      xong();
      if (!j || j.status !== "success") { theoTen = {}; return; }   // lỗi / không quyền ⇒ thôi, giữ chữ cái (không gửi lại mỗi lần trang đổi)
      var H = (j.header || []).map(chuan);
      nap(j.rows || [], H);
      try { sessionStorage.setItem(KHOA_PHIEN, JSON.stringify({ luc: Date.now(), H: H, rows: j.rows })); } catch (e) {}
      gan(document);
    };
    s.onerror = function () { xong(); theoTen = {}; };
    s.src = URL_GAS + "?action=readTab&tab=" + TAB + "&callback=" + cb + "&tb=" + encodeURIComponent(tb());
    document.head.appendChild(s);
  }
  function lay(ten, em) { if (!theoTen) return ""; return (em && theoEm[String(em).toLowerCase()]) || theoTen[chuan(ten)] || ""; }
  function gan(goc) {
    if (!theoTen) { if ((goc.querySelector ? goc : document).querySelector("[data-anh-nv]")) tai(); return; }
    (goc.querySelectorAll ? goc : document).querySelectorAll("[data-anh-nv]:not([data-anh-xong])").forEach(function (el) {
      el.setAttribute("data-anh-xong", "1");
      var a = lay(el.getAttribute("data-anh-nv"), el.getAttribute("data-anh-em")); if (!a) return;
      var im = document.createElement("img"); im.src = a; im.alt = ""; im.decoding = "async";
      el.textContent = ""; el.appendChild(im); el.classList.add("co-anh");
    });
  }
  /* ảnh lấp kín vòng tròn — kích thước/khung do lớp của mô-đun quyết */
  var st = document.createElement("style");
  st.textContent = "[data-anh-nv].co-anh{overflow:hidden;background:var(--surface2,#f0f0f0)!important;padding:0}[data-anh-nv].co-anh>img{width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block}";
  document.head.appendChild(st);
  var hen = 0;
  new MutationObserver(function () { if (hen) return; hen = requestAnimationFrame(function () { hen = 0; gan(document); }); })
    .observe(document.documentElement, { childList: true, subtree: true });
  window.hskAnhNV = { lay: lay, gan: gan, tai: tai };
})();
