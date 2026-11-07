/* anh-nv.js — ẢNH ĐẠI DIỆN NHÂN VIÊN TOÀN DỰ ÁN (05/11/2026). Bản gốc: hasaki/kiemsoatkho/anh-nv.js — tệp này là bản chép Y HỆT.
 * User 05/11: «các ô tròn có tên viết tắt thay ảnh avatar — toàn dự án».
 * Nguồn: tab RIÊNG NHAN-SU-ANH (anh-dai-dien.mjs trên laptop thu ảnh hr-media còn 64 px webp, ~0,7 KB/người) — đọc 1 lần / trang
 * qua readTab (khoá thiết bị), giữ trong phiên (sessionStorage) để chuyển tab không tải lại.
 * Cách dùng ở mô-đun: vòng tròn chữ cái thêm thuộc tính `data-anh-nv="<họ tên>"` (tuỳ chọn `data-anh-em="<email>"`) — tệp này tự
 * gắn <img> vào và thêm lớp .co-anh khi có ảnh; không có ảnh thì giữ nguyên chữ cái. Không cần gọi hàm, không vẽ lại mô-đun.
 * Danh bạ (tên · mã · email, cả người không có ảnh): hskAnhNV.san(f) chờ tải xong, .ds() danh sách, .theoMa(mã) — ô gợi ý người. */
(function () {
  if (window.hskAnhNV) return;
  var URL_GAS = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
  var TAB = "NHAN-SU-ANH", KHOA_PHIEN = "anh-nv-v2", theoTen = null, theoEm = {}, theoMa = {}, DS = [], doi = [], dangTai = false;
  /* 07/11 user «vào Bảo dưỡng từ thiết bị khác chỉ hiện khung tròn — không hình, mã NV thay tên»: trước đây hỏng 1 lần (trang mở khi CHƯA đăng nhập,
     GAS chập chờn 404, mã máy hết hạn) là khoá «không danh bạ» tới hết trang. Nay hỏng = tạm: thử lại khi khoá/phiên đổi (vừa đăng nhập) hoặc sau 30 s;
     403 bằng mã máy mà có phiên tài khoản ⇒ thử ngay bằng phiên; tải được thì gắn ảnh cả vòng đã vẽ chữ cái + báo «hsk-anh-nv» để mô-đun vẽ lại tên. */
  var hong = 0, hongTb = "", henLai = 0;
  var chuan = function (s) { return String(s == null ? "" : s).normalize("NFC").replace(/\s+/g, " ").trim().toUpperCase(); };
  var tb = function () { try { return localStorage.getItem("tb-khoa") || (localStorage.getItem("tk-phien") ? "tk:" + localStorage.getItem("tk-phien") : ""); } catch (e) { return ""; } };
  function nap(rows, H) {
    theoTen = {}; theoEm = {}; theoMa = {}; DS = [];
    var iT = H.indexOf("TÊN"), iM = H.indexOf("MÃ NV"), iE = H.indexOf("EMAIL"), iA = H.indexOf("ẢNH");
    rows.forEach(function (r) { var a = String(r[iA] || ""), co = /^data:image\//.test(a) ? a : "", ma = String(r[iM] || "").replace(/^'/, "");
      var x = { ten: String(r[iT] || ""), ma: ma, em: String(r[iE] || "").toLowerCase(), anh: co }; DS.push(x); if (ma) theoMa[ma] = x;
      if (!co) return; theoTen[chuan(r[iT])] = co; if (x.em) theoEm[x.em] = co; });
  }
  function daHong() {   // giữ chữ cái tạm, KHÔNG khoá: lượt sau thử lại
    if (!theoTen) theoTen = {}; hong = Date.now(); hongTb = tb(); xongTai();
    if (!henLai) henLai = setTimeout(function () { henLai = 0; if (hong) tai(); }, 30e3);
  }
  function daXong(rows, H) { hong = 0; nap(rows, H); gan(document, true); xongTai(); try { window.dispatchEvent(new Event("hsk-anh-nv")); } catch (e) {} }
  function tai(khoaThu) {
    if (dangTai || (theoTen && !hong)) return;
    if (hong && !khoaThu && tb() === hongTb && Date.now() - hong < 30e3) return;
    try { var c = JSON.parse(sessionStorage.getItem(KHOA_PHIEN) || "null"); if (c && c.rows && Date.now() - c.luc < 6 * 3600e3) { daXong(c.rows, c.H); return; } } catch (e) {}
    var k = khoaThu || tb();
    if (!k) { daHong(); return; }   // máy chưa có khoá / chưa đăng nhập ⇒ chữ cái tạm, đăng nhập xong tự thử lại
    dangTai = true;
    var cb = "anhnv_" + Date.now(), s = document.createElement("script"), xong = function () { dangTai = false; delete window[cb]; s.remove(); };
    window[cb] = function (j) {
      xong();
      if (!j || j.status !== "success") {
        var ph = ""; try { ph = localStorage.getItem("tk-phien") || ""; } catch (e) {}
        if (j && j.code === 403 && ph && k !== "tk:" + ph) { tai("tk:" + ph); return; }   // mã máy hết hạn nhưng phiên tài khoản còn
        daHong(); return; }
      var H = (j.header || []).map(chuan);
      try { sessionStorage.setItem(KHOA_PHIEN, JSON.stringify({ luc: Date.now(), H: H, rows: j.rows })); } catch (e) {}
      daXong(j.rows || [], H);
    };
    s.onerror = function () { xong(); daHong(); };
    s.src = URL_GAS + "?action=readTab&tab=" + TAB + "&callback=" + cb + "&tb=" + encodeURIComponent(k);
    document.head.appendChild(s);
  }
  function xongTai() { var d = doi; doi = []; d.forEach(function (f) { try { f(); } catch (e) {} }); }
  /* danh bạ sẵn sàng thì gọi f (ô gợi ý người cần danh bạ, không chỉ ảnh) */
  function san(f) { if (theoTen && !dangTai) { if (hong) tai(); f(); return; } doi.push(f); tai(); }   // đang hỏng: trả chữ cái ngay, về được thì báo «hsk-anh-nv»
  function lay(ten, em) { if (!theoTen) return ""; return (em && theoEm[String(em).toLowerCase()]) || theoTen[chuan(ten)] || ""; }
  function gan(goc, lai) {
    if (!theoTen || hong) { if ((goc.querySelector ? goc : document).querySelector("[data-anh-nv]")) tai(); if (!theoTen) return; }
    /* lai = danh bạ vừa về sau lượt hỏng ⇒ gắn cả vòng đã vẽ chữ cái */
    (goc.querySelectorAll ? goc : document).querySelectorAll(lai ? "[data-anh-nv]:not(.co-anh)" : "[data-anh-nv]:not([data-anh-xong])").forEach(function (el) {
      el.setAttribute("data-anh-xong", "1");
      var a = lay(el.getAttribute("data-anh-nv"), el.getAttribute("data-anh-em")); if (!a) return;
      var im = document.createElement("img"); im.src = a; im.alt = ""; im.decoding = "async";
      el.textContent = ""; el.appendChild(im); el.classList.add("co-anh");
    });
  }
  /* ảnh lấp kín vòng tròn — kích thước/khung do lớp của mô-đun quyết */
  var st = document.createElement("style");
  /* 05/11 user «rà các mục như CCTV — hiện bản tạm rồi nhảy»: chưa biết có ảnh hay không thì KHÔNG vẽ chữ cái (tránh chữ cái → ảnh);
     danh bạ về (hoặc hỏng / không có ảnh) mới hiện ảnh hoặc chữ cái — gan() đánh dấu data-anh-xong. */
  st.textContent = "[data-anh-nv]:not([data-anh-xong]){color:transparent!important}[data-anh-nv]:not([data-anh-xong])>*{visibility:hidden}" +
    "[data-anh-nv].co-anh{overflow:hidden;background:var(--surface2)!important;padding:0}[data-anh-nv].co-anh>img{width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block}";
  document.head.appendChild(st);
  var hen = 0;
  new MutationObserver(function () { if (hen) return; hen = requestAnimationFrame(function () { hen = 0; gan(document); }); })
    .observe(document.documentElement, { childList: true, subtree: true });
  /* nạp sớm lúc trang rảnh (1 lượt / phiên) — mở mục có vòng người là ảnh đã sẵn, không vẽ vòng trống chờ */
  var som = function () { if (tb()) tai(); };
  if (window.requestIdleCallback) requestIdleCallback(som, { timeout: 1500 }); else setTimeout(som, 300);
  window.hskAnhNV = { lay: lay, gan: gan, tai: tai, san: san, ds: function () { return DS; }, theoMa: function (m) { return theoMa[String(m)] || null; }, chuan: chuan };
})();
