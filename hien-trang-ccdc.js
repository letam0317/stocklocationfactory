/* ============================================================================================
 *  HIỆN TRẠNG CCDC / TSCĐ — Audit Factory › Công cụ kho (11/11/2026, user duyệt mẫu PDF «Mẫu ghi nhận
 *  hiện trạng CCDC - TSCĐ 11-11-2026.pdf»). Nạp lười khi mở tab lần đầu (khuôn do-rfid.js).
 *
 *  Ghi nhận bằng ẢNH/CLIP + GHI CHÚ là chính (user: «không đánh giá — mất nhiều thao tác»):
 *    1 · SKU / mã tài sản — KHÔNG bắt buộc: gõ tay · Quét mã/QR (bộ quét qtcQuetMo) · Nhận diện SKU (pop-up
 *        chứa nguyên tab Nhận diện SKU; «Chọn SKU này»/bấm thẻ ⇒ điền ô). Khớp danh mục thì hiện hàng dưới.
 *    2 · Ảnh / clip (bắt buộc ≥ 1) — bấm ảnh ⇒ khoanh vùng hư (Khoanh · Bút · Hoàn tác), ghi chú từng vùng.
 *    3 · Ghi chú (bắt buộc) + Phân loại 1 chạm (Tái sử dụng / Sửa chữa / Thanh lý, bỏ trống được).
 *  GỬI / SỬA = TỨC THÌ: dòng hiện ngay ở «Đã ghi nhận», form trống; tải ảnh lên Drive + ghi Sheet chạy nền
 *  (ccdc_tai / ccdc_ghi). Chưa xong mà mất mạng / đóng trang ⇒ cất IndexedDB, mở lại tự gửi tiếp.
 *  Người gửi = phiên tài khoản (máy chủ đọc từ phiên — form không tự khai được).
 *  In tem: khuôn tem SKU NHÀ MÁY (PR_TEM). Máy in RIÊNG chưa có ⇒ «In ngay» tắt; «Thêm vào chờ in» ghi tab
 *  IN-TEM (KHÔNG dùng hàng đợi pr_them — agent máy in nhà máy nhặt mọi lệnh ở đó).
 *  Sheet chỉ xem: https://docs.google.com/spreadsheets/d/1sXd8imGeXriBFrUoxQlyfjESdhxv9tUxjLDfsJ06_do
 * ============================================================================================ */
(function () {
  'use strict';
  if (window.ccdcMo) return;
  var PL = ['Tái sử dụng', 'Sửa chữa', 'Thanh lý'];
  var PL_LOP = { 'Tái sử dụng': 'tsd', 'Sửa chữa': 'sc', 'Thanh lý': 'tl' };
  var K_DS = 'ccdc-ds-v1', TRANG = 20, MAX_ANH = 1600;
  var CC = window.CC = { ds: [], loc: '', soHien: TRANG, napLan: 0, dangNap: false, f: null, dang: {} };
  var e_ = function (s) { return (typeof esc === 'function') ? esc(s == null ? '' : s) : String(s == null ? '' : s); };
  var $ = function (id) { return document.getElementById(id); };
  var bao = function (m, t) { if (typeof toast === 'function') toast(m, t || 'ok'); };

  /* ---------------- 0. CSS (gói trong mô-đun, chỉ áp vào #viewCcdc + pop-up cc*) ---------------- */
  var css = [
    '#viewCcdc .cc-grid{display:grid;grid-template-columns:minmax(0,600px) minmax(0,1fr);gap:16px;align-items:start}',
    '@media(max-width:1000px){#viewCcdc .cc-grid{grid-template-columns:minmax(0,1fr)}}',
    '#viewCcdc .panel h2{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}',
    '#viewCcdc .panel h2 small{font-size:12px;font-weight:400;color:var(--ink3)}',
    '#viewCcdc .cc-h3{font-size:14px;font-weight:600;margin:16px 0 8px;display:flex;align-items:baseline;gap:6px}',
    '#viewCcdc .cc-h3 i{font-style:normal;color:var(--bad,#ef4444)} #viewCcdc .cc-h3 small{font-weight:400;font-size:12px;color:var(--ink3)}',
    '#viewCcdc .cc-sku{display:flex;gap:8px;flex-wrap:wrap}',
    '#viewCcdc .cc-sku input{flex:1 1 200px;min-width:0;height:38px;border:1px solid var(--line);border-radius:8px;padding:0 12px;font-size:16px;background:var(--surface);color:var(--ink)}',
    '#viewCcdc .cc-nut,.cc-pop .cc-nut{height:38px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font-size:14px;padding:0 12px;cursor:pointer;white-space:nowrap}',
    '#viewCcdc .cc-nut.vien,.cc-pop .cc-nut.vien{border-color:var(--brand2);color:var(--brand2)}',
    '.cc-nut.xanh,#viewCcdc .cc-nut.xanh,.cc-pop .cc-nut.xanh{background:var(--brand2);border-color:var(--brand2);color:#fff;font-weight:600}',
    '.cc-nut:disabled{opacity:.45;cursor:not-allowed}',
    '#viewCcdc .cc-nut svg,.cc-pop .cc-nut svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}',
    '@media(max-width:640px){#viewCcdc .cc-sku input{flex-basis:100%}#viewCcdc .cc-sku .cc-nut{flex:1 1 0}}',
    '#viewCcdc .cc-kq{margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px solid #b7eb8f;background:#f6ffed;border-radius:8px;padding:7px 10px;font-size:14px;color:#1f1f1f}',
    '#viewCcdc .cc-kq b{font-weight:600} #viewCcdc .cc-kq .ten{flex:1 1 160px;min-width:0}',
    '#viewCcdc .cc-kq .x{border:0;background:none;color:#8c8c8c;font-size:18px;cursor:pointer;line-height:1;padding:0 2px}',
    '.cc-tag{font-size:11.5px;font-weight:600;border-radius:4px;padding:0 6px;border:1px solid;white-space:nowrap}',
    '.cc-tag.ac{color:#389e0d;background:#f6ffed;border-color:#b7eb8f}.cc-tag.in{color:#595959;background:#fafafa;border-color:#d9d9d9}',
    '#viewCcdc .cc-hai{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '#viewCcdc .cc-to{border:1.5px solid #91caff;border-radius:8px;background:#e6f4ff;text-align:center;padding:11px 4px;color:#1677ff;font-weight:600;font-size:14.5px;cursor:pointer;position:relative}',
    '#viewCcdc .cc-to small{display:block;font-weight:400;font-size:12px;color:#69b1ff}',
    '#viewCcdc .cc-to.nhat{border:1.5px dashed var(--line);background:var(--surface);color:var(--ink2)} #viewCcdc .cc-to.nhat small{color:var(--ink3)}',
    '#viewCcdc .cc-to input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%}',
    '#viewCcdc .cc-to.keo{border-color:#1677ff;background:#e6f4ff}',
    '#viewCcdc .cc-anhs{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
    '.cc-anh{width:88px;height:88px;border-radius:8px;overflow:hidden;position:relative;border:1px solid var(--line);flex:none;background:#f0f0f0;cursor:pointer}',
    '.cc-anh img,.cc-anh video{width:100%;height:100%;object-fit:cover;display:block}',
    '.cc-anh .so{position:absolute;left:4px;bottom:4px;background:rgba(0,0,0,.65);color:#fff;font-size:10.5px;border-radius:4px;padding:0 5px;white-space:nowrap}',
    '.cc-anh .xn{position:absolute;right:4px;top:4px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:12px;display:grid;place-items:center;border:0;cursor:pointer}',
    '.cc-anh .play{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}',
    '.cc-anh .play i{width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-style:normal;display:grid;place-items:center;font-size:11px}',
    '#viewCcdc textarea{width:100%;min-height:84px;border:1px solid var(--line);border-radius:8px;padding:9px 12px;font:inherit;font-size:16px;resize:vertical;background:var(--surface);color:var(--ink)}',
    '#viewCcdc .cc-pl{display:flex;gap:6px}',
    '#viewCcdc .cc-pl button{flex:1;border:1px solid var(--line);border-radius:8px;padding:7px 0;font-weight:600;font-size:13.5px;color:var(--ink2);background:var(--surface);cursor:pointer}',
    '#viewCcdc .cc-pl button.on.tsd{border-color:#52c41a;background:#f6ffed;color:#389e0d}',
    '#viewCcdc .cc-pl button.on.sc{border-color:#faad14;background:#fffbe6;color:#d48806}',
    '#viewCcdc .cc-pl button.on.tl{border-color:#ff4d4f;background:#fff1f0;color:#cf1322}',
    '#viewCcdc .cc-gui{display:flex;align-items:center;gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}',
    '#viewCcdc .cc-gui .ng{flex:1;font-size:13.5px;color:var(--ink3);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '#viewCcdc .cc-gui .ng b{color:var(--ink);font-weight:600}',
    '#viewCcdc .cc-gui .cc-nut.xanh{padding:0 28px}',
    '.cc-av{width:28px;height:28px;border-radius:50%;background:#1677ff;color:#fff;display:inline-grid;place-items:center;font-size:11px;font-weight:600;flex:none;overflow:hidden}',
    '.cc-av.n{width:22px;height:22px;font-size:9px} .cc-av img{width:100%;height:100%;object-fit:cover}',
    '#viewCcdc .cc-loi{color:var(--bad,#cf1322);font-size:13px;margin-top:6px}',
    '#viewCcdc .cc-sua{display:flex;align-items:center;gap:8px;background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;padding:6px 10px;font-size:13px;margin-bottom:10px}',
    '#viewCcdc .cc-sua button{margin-left:auto;border:0;background:none;color:#1677ff;cursor:pointer;font-size:13px}',
    '#viewCcdc .cc-loc{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:6px}',
    '#viewCcdc .cc-loc::-webkit-scrollbar{display:none}',
    '#viewCcdc .cc-loc .kktab{flex:0 0 auto;white-space:nowrap}',
    '#viewCcdc .cc-dong{display:flex;gap:10px;padding:10px 6px;border-top:1px solid var(--line);align-items:flex-start;cursor:pointer;border-radius:8px}',
    '#viewCcdc .cc-dong:first-child{border-top:0} #viewCcdc .cc-dong:hover{background:var(--hover,#f5f5f5)}',
    '#viewCcdc .cc-dong.vua{background:#f0f7ff}',
    '#viewCcdc .cc-dong .cc-tb{width:52px;height:52px;border-radius:6px;overflow:hidden;flex:none;background:#f0f0f0}',
    '#viewCcdc .cc-dong .cc-tb img{width:100%;height:100%;object-fit:cover;display:block}',
    '#viewCcdc .cc-dong .cc-nd{flex:1;min-width:0}',
    '#viewCcdc .cc-dong .cc-t1{display:flex;gap:6px;align-items:center;font-size:14px;font-weight:600;white-space:nowrap}',
    '#viewCcdc .cc-dong .cc-t1 span:first-child{overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}',
    '#viewCcdc .cc-dong .cc-t2{font-size:13px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}',
    '#viewCcdc .cc-dong .cc-t3{font-size:12.5px;color:var(--ink3);display:flex;align-items:center;gap:6px;margin-top:3px;white-space:nowrap;overflow:hidden}',
    '#viewCcdc .cc-dong .cc-t3>span:not(.cc-av){flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}',   /* chữ co «…» — tràn thì bấm «In tem» làm khung tự cuộn, che mất tên */
    '#viewCcdc .cc-dong .in{margin-left:auto;color:#1677ff;border:0;background:none;cursor:pointer;font-size:12.5px;display:inline-flex;align-items:center;gap:3px;flex:none}',
    '.cc-kqc{border-radius:6px;padding:0 8px;font-size:12px;font-weight:600;border:1px solid;flex:none}',
    '.cc-kqc.tsd{background:#f6ffed;color:#389e0d;border-color:#b7eb8f}.cc-kqc.sc{background:#fffbe6;color:#d48806;border-color:#ffe58f}.cc-kqc.tl{background:#fff1f0;color:#cf1322;border-color:#ffa39e}',
    '#viewCcdc .cc-tt{font-size:12px;display:flex;align-items:center;gap:5px;margin-top:3px;color:#1677ff}',
    '#viewCcdc .cc-tt.loi{color:#cf1322} #viewCcdc .cc-tt button{border:0;background:none;color:#1677ff;cursor:pointer;font-size:12px;padding:0}',
    '#viewCcdc .cc-vong{width:10px;height:10px;border:2px solid #bae0ff;border-top-color:#1677ff;border-radius:50%;animation:ccxoay .8s linear infinite}',
    '@keyframes ccxoay{to{transform:rotate(360deg)}}',
    '#viewCcdc .cc-them{display:block;width:100%;margin-top:8px}',
    '#viewCcdc .cc-trong{color:var(--ink3);font-size:13.5px;padding:24px 8px;text-align:center}',
    '#viewCcdc .cc-sheet{font-size:12.5px;color:#1677ff;text-decoration:none;margin-left:auto;font-weight:400}',
    /* pop-up chung */
    '.cc-pop .modalbox{width:min(560px,96vw);max-height:92vh;max-height:92dvh;display:flex;flex-direction:column;overflow:hidden}',
    '.cc-pop .cc-than{padding:14px 18px;overflow:auto;flex:1}',
    '#ccNdsModal .modalbox{width:min(1100px,96vw);height:min(900px,92dvh)}',
    '#ccNdsModal .cc-than{padding:0 4px} #ccNdsModal #viewNds{display:block}',
    '@media(max-width:640px){.cc-pop .modalbox{width:100%;max-height:100dvh;height:100dvh;border-radius:0}}',
    /* khoanh vùng */
    '#ccVe{position:fixed;inset:0;z-index:120;background:#0b1220;color:#fff;display:none;flex-direction:column}',
    '#ccVe.mo{display:flex}',
    '#ccVe .vd{display:flex;align-items:center;gap:10px;padding:12px 16px;padding-top:calc(env(safe-area-inset-top,0px) + 12px);font-size:15px}',
    '#ccVe .vd b{flex:1} #ccVe .vd button{border:0;cursor:pointer;font-size:14px}',
    '#ccVe .vd .huy{background:none;color:#cbd5e1;font-size:20px} #ccVe .vd .xong{background:#1677ff;color:#fff;border-radius:8px;padding:6px 16px;font-weight:600}',
    '#ccVe .khung{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;touch-action:none}',
    '#ccVe canvas{max-width:100%;max-height:100%;touch-action:none;cursor:crosshair}',
    '#ccVe .cong{display:flex;justify-content:center;gap:28px;padding:10px 8px;border-top:1px solid #1e293b}',
    '#ccVe .cong button{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11.5px;color:#94a3b8;background:none;border:0;cursor:pointer;width:60px}',
    '#ccVe .cong button i{width:40px;height:40px;border-radius:8px;display:grid;place-items:center;background:#1e293b;font-style:normal;font-size:18px;color:#e2e8f0}',
    '#ccVe .cong button.on{color:#fff} #ccVe .cong button.on i{background:#ef4444}',
    '#ccVe .vung{padding:4px 14px 14px;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 14px);max-height:30vh;overflow:auto}',
    '#ccVe .vung label{display:flex;align-items:center;gap:8px;background:#1e293b;border-radius:8px;padding:6px 10px;margin-top:7px}',
    '#ccVe .vung label b{width:22px;height:22px;border-radius:50%;background:#ef4444;display:grid;place-items:center;font-size:12px;flex:none}',
    '#ccVe .vung input{flex:1;background:transparent;border:0;color:#fff;font-size:16px;outline:0;min-width:0}',
    '#ccVe .vung input::placeholder{color:#64748b}',
    '#ccVe .goi{color:#64748b;font-size:13px;text-align:center;padding:6px}',
    /* in tem */
    '#ccInModal .tem{display:flex;justify-content:center;margin-bottom:14px}',
    '#ccInModal .tem svg{width:150px;height:auto;border:1px solid #d9d9d9;background:#fff}',
    '#ccInModal .luoi{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '#ccInModal label.n{display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:var(--ink2)}',
    '#ccInModal input.o{width:100%;height:38px;border:1px solid var(--line);border-radius:8px;padding:0 10px;font-size:16px;background:var(--surface);color:var(--ink)}',
    '#ccInModal .bac{display:flex;gap:6px} #ccInModal .bac input{text-align:center} #ccInModal .bac .cc-nut{width:38px;padding:0;flex:none}',
    '#ccInModal .ng{height:38px;display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:var(--hover,#fafafa);font-size:14px;overflow:hidden;white-space:nowrap}',
    '#ccInModal .may{height:38px;display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:8px;padding:0 10px;color:var(--ink3);font-size:14px;margin-top:4px}',
    '#ccInModal .day{display:flex;gap:8px;margin-top:16px} #ccInModal .day .cc-nut{flex:1}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'ccdcCss'; st.textContent = css; document.head.appendChild(st);

  var IC = {
    quet: '<svg viewBox="0 0 20 20"><path d="M3 6V3h3M14 3h3v3M17 14v3h-3M6 17H3v-3M6 7v6M9 7v6M11 7v6M14 7v6"/></svg>',
    ai: '<svg viewBox="0 0 20 20"><path d="M10 2l1.6 4.4L16 8l-4.4 1.6L10 14l-1.6-4.4L4 8l4.4-1.6zM15.5 13l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>',
    inn: '<svg viewBox="0 0 20 20"><path d="M6 8V3h8v5M6 14H3V8h14v6h-3M6 11h8v6H6z"/></svg>'
  };

  /* ---------------- 1. Tiện ích ---------------- */
  function maMoi() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return 'CC' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + Math.random().toString(36).slice(2, 7).toUpperCase(); }
  function gio(ms) { if (!ms) return ''; var d = new Date(ms), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ' ' + p(d.getDate()) + '/' + p(d.getMonth() + 1); }
  function haiChuCuoi(t) { var w = String(t || '').trim().split(/\s+/); return w.slice(-2).join(' '); }
  function chuTat(t) { var w = String(t || '').trim().split(/\s+/).filter(Boolean); return ((w.length > 1 ? w[w.length - 2][0] : '') + (w.length ? w[w.length - 1][0] : '')).toUpperCase(); }
  function av(ten, nho) { return '<span class="cc-av' + (nho ? ' n' : '') + '" data-anh-nv="' + e_(ten) + '">' + e_(chuTat(ten)) + '</span>'; }
  function nguoi() { return (window.TK && TK.nguoi) || null; }
  function danhMuc() { return (typeof cdDanhMuc === 'function') ? cdDanhMuc() : null; }
  function dvCua(pn) { var m = String(pn || '').split('/'); return m.length > 1 ? m[m.length - 1].trim() : ''; }
  function traSku(v) {
    v = String(v || '').replace(/[^0-9A-Za-z-]/g, ''); if (!v) return null;
    var ds = danhMuc(); if (!ds) return null;
    var hit = null, dem = 0;
    for (var i = 0; i < ds.length; i++) if (String(ds[i].sku) === v) return ds[i];
    if (v.length >= 5) for (var j = 0; j < ds.length; j++) if (String(ds[j].sku).indexOf(v) === 0) { dem++; hit = ds[j]; if (dem > 1) return null; }
    return hit;
  }
  function thumb(t) { return t.url || (t.ve && t.ve.url) || (t.id ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(t.ve || t.id) + '&sz=w200' : ''); }
  async function goiGas(body, han) {
    var n = nguoi(); body = Object.assign({ phien: (window.TK && TK.phien) || '' }, body);
    if (!n || !body.phien) { var e0 = new Error('Cần đăng nhập'); e0.code = 401; throw e0; }
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, hen = ctl ? setTimeout(function () { ctl.abort(); }, han || 60000) : 0;
    try {
      var r = await fetch(APPSCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined });
      var t = String(await r.text() || '').trim();
      if (t.charAt(0) !== '{') throw new Error(/^<!DOCTYPE|^<html/i.test(t) ? 'Apps Script trả trang HTML — thử lại' : 'phản hồi lạ');
      var j = JSON.parse(t); if (j.status !== 'success') { var e = new Error(j.message || 'Lỗi'); e.code = j.code; throw e; }
      return j;
    } finally { if (hen) clearTimeout(hen); }
  }
  function docB64(blob) { return new Promise(function (ok, loi) { var fr = new FileReader(); fr.onload = function () { ok(String(fr.result)); }; fr.onerror = loi; fr.readAsDataURL(blob); }); }
  function napAnh(src) { return new Promise(function (ok, loi) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = loi; im.src = src; }); }
  async function nenAnh(file) {   // ảnh điện thoại 4–12 MB → JPEG cạnh dài 1600: tải lên nhanh, đủ nét soi chỗ hư
    var u = URL.createObjectURL(file);
    try { var im = await napAnh(u), k = Math.min(1, MAX_ANH / Math.max(im.naturalWidth, im.naturalHeight));
      var c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      return await new Promise(function (ok) { c.toBlob(function (b) { ok(b || file); }, 'image/jpeg', 0.84); });
    } catch (e) { return file; } finally { URL.revokeObjectURL(u); }
  }

  /* ---------------- 2. Kho chờ (IndexedDB) — lượt gửi chưa xong sống qua F5 / mất mạng ---------------- */
  var DB = null;
  function db() { if (DB) return DB; DB = new Promise(function (ok, loi) { try { var r = indexedDB.open('ccdc-cho', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('cho', { keyPath: 'ma' }); };
      r.onsuccess = function () { ok(r.result); }; r.onerror = function () { loi(r.error); }; } catch (e) { loi(e); } }); return DB; }
  function dbLam(che, fn) { return db().then(function (d) { return new Promise(function (ok, loi) { var tx = d.transaction('cho', che), s = tx.objectStore('cho'), r = fn(s);
    tx.oncomplete = function () { ok(r && r.result); }; tx.onerror = function () { loi(tx.error); }; }); }).catch(function () { return null; }); }
  function choCat(it) {   // chỉ cất thứ cần để gửi lại: blob của tệp chưa có id
    var b = { ma: it.ma, it: Object.assign({}, it, { tep: it.tep.map(function (t) { return { id: t.id || '', veId: t.veId || '', goc: t.goc || '', loai: t.loai, blob: t.id ? null : t.blob, veBlob: t.id ? null : (t.ve && t.ve.blob), hinh: t.hinh || [] }; }), _dang: false }) };
    return dbLam('readwrite', function (s) { return s.put(b); });
  }
  function choXoa(ma) { return dbLam('readwrite', function (s) { return s.delete(ma); }); }
  function choDoc() { return dbLam('readonly', function (s) { return s.getAll(); }); }

  /* ---------------- 3. Khung trang ---------------- */
  function veKhung() {
    var v = $('viewCcdc'); if (!v || v.dataset.dung) return; v.dataset.dung = '1';
    v.innerHTML =
      '<div class="cc-grid">' +
      '<section class="panel" id="ccForm"></section>' +
      '<section class="panel" id="ccDsKhoi"><h2>Đã ghi nhận <small id="ccDem"></small>' +
        '<a class="cc-sheet" href="https://docs.google.com/spreadsheets/d/1sXd8imGeXriBFrUoxQlyfjESdhxv9tUxjLDfsJ06_do/edit" target="_blank" rel="noopener">Mở Sheet ↗</a></h2>' +
        '<div class="cc-loc" id="ccLoc"></div><div id="ccDs"></div></section>' +
      '</div>';
    var pop = function (id, tieuDe, than) { var m = document.createElement('div'); m.id = id; m.className = 'modal cc-pop';
      m.innerHTML = '<div class="modalbox"><div class="modalhd"><div><div class="mt">' + tieuDe + '</div></div><button class="mclose" type="button">&times;</button></div><div class="cc-than">' + than + '</div></div>';
      document.body.appendChild(m); return m; };
    var mN = pop('ccNdsModal', 'Nhận diện SKU', '<div id="ccNdsCho"></div>');
    mN.addEventListener('click', function (ev) { if (ev.target === mN || ev.target.closest('.mclose')) ndsDong(); });
    var mI = pop('ccInModal', 'In tem SKU', '<div id="ccInThan"></div>');
    mI.addEventListener('click', function (ev) { if (ev.target === mI || ev.target.closest('.mclose')) plgDongModal('ccInModal'); });
    var ve = document.createElement('div'); ve.id = 'ccVe';
    ve.innerHTML = '<div class="vd"><button class="huy" type="button" aria-label="Huỷ">✕</button><b id="ccVeTd">Khoanh vùng hư</b><button class="xong" type="button">Xong</button></div>' +
      '<div class="khung"><canvas id="ccVeCv"></canvas></div>' +
      '<div class="cong"><button type="button" data-cu="o" class="on"><i>◯</i>Khoanh</button><button type="button" data-cu="p"><i>✎</i>Bút</button><button type="button" data-cu="u"><i>↶</i>Hoàn tác</button></div>' +
      '<div class="vung" id="ccVeVung"></div>';
    document.body.appendChild(ve);
    veGanSuKien();
    window.addEventListener('beforeunload', function (ev) { if (CC.ds.some(function (x) { return x._dang; })) { ev.preventDefault(); ev.returnValue = ''; } });
    document.addEventListener('tk-doi', function () { veForm(); });
  }

  /* ---------------- 4. Form ---------------- */
  function formMoi() { CC.f = { ma: '', sua: false, sku: '', maGo: '', cach: '', ten: '', loai: '', dv: '', status: '', tep: [], ghiChu: '', phanLoai: '', loi: '' }; }
  function veForm() {
    var el = $('ccForm'); if (!el) return; var f = CC.f, n = nguoi();
    var kq = f.sku ? '<div class="cc-kq">' + (f.status ? '<span class="cc-tag ' + (f.status === 'INACTIVE' ? 'in' : 'ac') + '">' + e_(f.status) + '</span>' : '') +
      '<b>' + e_(f.sku) + '</b>' + (f.loai ? '<span class="cc-tag in">' + e_(f.loai) + '</span>' : '') + '<span class="ten">' + e_(f.ten) + '</span>' +
      '<button type="button" class="cc-nut vien" data-lam="in" style="height:28px;padding:0 10px;font-size:13px">' + IC.inn + 'In tem</button>' +
      '<button type="button" class="x" data-lam="boSku" aria-label="Bỏ SKU">✕</button></div>' : '';
    var anh = f.tep.map(function (t, i) {
      var so = t.loai === 'video' ? 'Clip ' + (f.tep.slice(0, i + 1).filter(function (x) { return x.loai === 'video'; }).length) : 'Ảnh ' + (f.tep.slice(0, i + 1).filter(function (x) { return x.loai !== 'video'; }).length);
      var nv = (t.hinh || []).length;
      return '<div class="cc-anh" data-anh="' + i + '" title="' + (t.loai === 'video' ? 'Xem clip' : 'Bấm để khoanh vùng hư') + '">' +
        (t.loai === 'video' ? (t.url ? '<video src="' + e_(t.url) + '" muted playsinline preload="metadata"></video>' : '<img src="' + e_(thumb(t)) + '" alt="">') + '<span class="play"><i><svg viewBox="0 0 10 10" width="10" height="10"><path d="M2.5 1.5v7l6-3.5z" fill="#fff"/></svg></i></span>' : '<img src="' + e_(thumb(t)) + '" alt="">') +
        '<span class="so">' + so + (nv ? ' · ' + nv + ' vùng' : '') + '</span><button type="button" class="xn" data-bo="' + i + '" aria-label="Bỏ">✕</button></div>';
    }).join('');
    el.innerHTML =
      (f.sua ? '<div class="cc-sua">Đang sửa <b>' + e_(f.ma) + '</b><button type="button" data-lam="huySua">Huỷ sửa</button></div>' : '') +
      '<h2>1 · SKU / Mã tài sản <small>không bắt buộc</small></h2>' +
      '<div class="cc-sku"><input id="ccSku" type="text" inputmode="text" autocomplete="off" placeholder="Gõ SKU / mã tài sản…" value="' + e_(f.maGo) + '">' +
      '<button type="button" class="cc-nut" data-lam="quet">' + IC.quet + 'Quét mã / QR</button>' +
      '<button type="button" class="cc-nut vien" data-lam="nds">' + IC.ai + 'Nhận diện SKU</button></div>' + kq +
      '<div class="cc-h3">2 · Ảnh / clip hiện trạng <i>*</i></div>' +
      '<div class="cc-hai"><label class="cc-to">Chụp / quay<small>mở camera</small><input type="file" accept="image/*,video/*" capture="environment" data-tep="cam"></label>' +
      '<label class="cc-to nhat" id="ccKeo">Chọn từ máy<small>hoặc kéo thả</small><input type="file" accept="image/*,video/*" multiple data-tep="tv"></label></div>' +
      (anh ? '<div class="cc-anhs">' + anh + '</div>' : '') +
      '<div class="cc-h3">3 · Ghi chú <i>*</i></div>' +
      '<textarea id="ccGhiChu" placeholder="Hiện trạng, chỗ hư…">' + e_(f.ghiChu) + '</textarea>' +
      '<div class="cc-h3">Phân loại <small>không bắt buộc</small></div>' +
      '<div class="cc-pl">' + PL.map(function (p) { return '<button type="button" data-pl="' + e_(p) + '" class="' + PL_LOP[p] + (f.phanLoai === p ? ' on' : '') + '">' + e_(p) + '</button>'; }).join('') + '</div>' +
      (f.loi ? '<div class="cc-loi">' + e_(f.loi) + '</div>' : '') +
      '<div class="cc-gui">' + (n ? av(n.ten) + '<div class="ng">Người gửi <b>' + e_(n.ten) + '</b> · ' + e_(n.id) + '</div>' : '<div class="ng">Chưa đăng nhập</div>') +
      '<button type="button" class="cc-nut xanh" data-lam="gui">' + (n ? (f.sua ? 'Lưu' : 'Gửi') : 'Đăng nhập để gửi') + '</button></div>';
  }
  function ganSku(r, cach, maGo) {
    var f = CC.f;
    if (r) { f.sku = String(r.sku); f.ten = r.pn || ''; f.status = r.status || ''; f.loai = r.type || ''; f.dv = r.donVi || dvCua(r.pn); }
    else { f.sku = ''; f.ten = ''; f.status = ''; f.loai = ''; f.dv = ''; }
    if (maGo != null) f.maGo = maGo; if (cach) f.cach = cach;
  }
  function veGanSuKien() {
    var v = $('viewCcdc');
    v.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t.id === 'ccSku') { var r = traSku(t.value), coTruoc = !!CC.f.sku; ganSku(r, 'Gõ tay', t.value.trim());
        if (!!r !== coTruoc || r) { var vt = t.selectionStart; veForm(); var o = $('ccSku'); if (o) { o.focus(); try { o.setSelectionRange(vt, vt); } catch (e) {} } } }
      if (t.id === 'ccGhiChu') { CC.f.ghiChu = t.value; if (CC.f.loi) { CC.f.loi = ''; var l = v.querySelector('.cc-loi'); if (l) l.remove(); } }
    });
    v.addEventListener('change', function (ev) { var t = ev.target; if (t.dataset && t.dataset.tep) { themTep(t.files); t.value = ''; } });
    v.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-lam],[data-pl],[data-bo],[data-anh],[data-locpl],[data-dong],[data-thu],[data-inma]');
      if (!b || !v.contains(b)) return;
      if (b.dataset.bo != null) { ev.stopPropagation(); ev.preventDefault(); var t = CC.f.tep.splice(+b.dataset.bo, 1)[0]; if (t && t.url) URL.revokeObjectURL(t.url); veForm(); return; }
      if (b.dataset.inma) { ev.stopPropagation(); var x = timMa(b.dataset.inma); if (x) moIn({ sku: x.sku, ten: x.ten, dv: x.dv, ma: x.ma }); return; }
      if (b.dataset.thu) { ev.stopPropagation(); var y = timMa(b.dataset.thu); if (y) { y._loi = ''; dayLen(y); } return; }
      if (b.dataset.anh != null) { var tp = CC.f.tep[+b.dataset.anh]; if (!tp) return;
        if (tp.loai === 'video') { if (tp.url) window.open(tp.url, '_blank'); else if (tp.id) window.open('https://drive.google.com/file/d/' + tp.id + '/view', '_blank'); return; }
        if (!tp.blob) { window.open('https://drive.google.com/file/d/' + (tp.ve || tp.id) + '/view', '_blank'); return; }
        veMo(+b.dataset.anh); return; }
      if (b.dataset.pl) { CC.f.phanLoai = CC.f.phanLoai === b.dataset.pl ? '' : b.dataset.pl; veForm(); return; }
      if (b.dataset.locpl != null) { CC.loc = b.dataset.locpl; CC.soHien = TRANG; veDs(); return; }
      if (b.dataset.dong) { moSua(b.dataset.dong); return; }
      var lam = b.dataset.lam;
      if (lam === 'boSku') { ganSku(null, '', ''); CC.f.cach = ''; veForm(); }
      else if (lam === 'quet') moQuet();
      else if (lam === 'nds') ndsMo();
      else if (lam === 'in') moIn({ sku: CC.f.sku, ten: CC.f.ten, dv: CC.f.dv, ma: CC.f.ma });
      else if (lam === 'gui') gui();
      else if (lam === 'huySua') { formMoi(); veForm(); veDs(); }
      else if (lam === 'xemThem') { CC.soHien += TRANG; veDs(); }
    });
    v.addEventListener('dragover', function (ev) { var k = ev.target.closest && ev.target.closest('#ccKeo'); if (k) { ev.preventDefault(); k.classList.add('keo'); } });
    v.addEventListener('dragleave', function (ev) { var k = ev.target.closest && ev.target.closest('#ccKeo'); if (k) k.classList.remove('keo'); });
    v.addEventListener('drop', function (ev) { var k = ev.target.closest && ev.target.closest('#ccKeo'); if (k) { ev.preventDefault(); k.classList.remove('keo'); themTep(ev.dataTransfer.files); } });
  }
  async function themTep(files) {
    var ds = [].slice.call(files || []); if (!ds.length) return;
    for (var i = 0; i < ds.length; i++) {
      var f = ds[i], vid = /^video\//.test(f.type);
      if (!vid && !/^image\//.test(f.type)) { bao('Chỉ nhận ảnh hoặc clip: ' + f.name, 'warn'); continue; }
      if (f.size > 38 * 1048576) { bao('Tệp quá lớn (> 38 MB): ' + f.name, 'warn'); continue; }
      var blob = vid ? f : await nenAnh(f);
      CC.f.tep.push({ loai: vid ? 'video' : 'image', blob: blob, url: URL.createObjectURL(blob), ten: f.name, hinh: [] });
    }
    CC.f.loi = ''; veForm();
  }

  /* ---------------- 5. Quét mã + Nhận diện SKU (dùng lại bộ sẵn có) ---------------- */
  function moQuet() {
    if (typeof qtcQuetMo !== 'function' || typeof QTC === 'undefined') { bao('Chưa có bộ quét mã', 'err'); return; }
    QTC.dich = function (ma) { var r = traSku(ma); ganSku(r, 'Quét mã', ma); veForm(); bao(r ? 'Đã quét: ' + r.sku : 'Đã quét mã ' + ma + ' (không có trong danh mục SKU)', r ? 'ok' : 'warn'); };
    qtcQuetMo();
  }
  var NDS_CHO = null;
  function ndsMo() {
    var v = $('viewNds'), cho = $('ccNdsCho'); if (!v || !cho) return;
    NDS_CHO = { cha: v.parentNode, sau: v.nextSibling, an: v.hidden };
    cho.appendChild(v); v.hidden = false;
    if (typeof NDS !== 'undefined' && !NDS.loadedOnce && typeof ndsLoad === 'function') { NDS.loadedOnce = true; ndsLoad(); }
    window.ccdcNhanSku = function (sku, r) {
      r = r || traSku(sku) || { sku: sku, pn: '' };
      ganSku(r, 'Nhận diện SKU', String(sku)); ndsDong(); veForm(); bao('Đã chọn SKU ' + sku, 'ok'); return true;
    };
    plgMoModal('ccNdsModal');
  }
  function ndsDong() {
    window.ccdcNhanSku = null;
    var v = $('viewNds');
    if (v && NDS_CHO) { NDS_CHO.cha.insertBefore(v, NDS_CHO.sau); v.hidden = (typeof TOPTAB === 'undefined' || TOPTAB !== 'sku'); NDS_CHO = null; }
    if (typeof ndsRoiTab === 'function' && (typeof TOPTAB === 'undefined' || TOPTAB !== 'sku')) ndsRoiTab();
    plgDongModal('ccNdsModal');
  }

  /* ---------------- 6. Khoanh vùng hư ---------------- */
  var VE = { i: -1, cu: 'o', hinh: [], im: null, k: 1, dang: null };
  function veMo(i) {
    var t = CC.f.tep[i]; if (!t) return;
    VE.i = i; VE.hinh = JSON.parse(JSON.stringify(t.hinh || [])); VE.dang = null;
    var anhSo = CC.f.tep.slice(0, i + 1).filter(function (x) { return x.loai !== 'video'; }).length;
    $('ccVeTd').textContent = 'Ảnh ' + anhSo + ' · Khoanh vùng hư';
    var src = URL.createObjectURL(t.blob);
    napAnh(src).then(function (im) { VE.im = im; $('ccVe').classList.add('mo'); veVe(); veVung(); });
  }
  function veCo() {   // cỡ canvas vừa khung
    var kh = $('ccVe').querySelector('.khung'), c = $('ccVeCv'), im = VE.im;
    var W = kh.clientWidth - 16, H = kh.clientHeight - 16, k = Math.min(W / im.naturalWidth, H / im.naturalHeight);
    c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k)); VE.k = k;
  }
  function veHinh(ctx, W, H, h, so, nhan) {
    ctx.save(); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = Math.max(3, W / 160); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    if (h.k === 'o') { var cx = (h.a[0] + h.b[0]) / 2 * W, cy = (h.a[1] + h.b[1]) / 2 * H, rx = Math.abs(h.b[0] - h.a[0]) / 2 * W, ry = Math.abs(h.b[1] - h.a[1]) / 2 * H;
      ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx, 2), Math.max(ry, 2), 0, 0, Math.PI * 2); ctx.stroke(); x1 = cx + rx * 0.72; y1 = cy - ry * 0.72; }
    else { ctx.beginPath(); h.d.forEach(function (p, j) { if (j) ctx.lineTo(p[0] * W, p[1] * H); else ctx.moveTo(p[0] * W, p[1] * H); }); ctx.stroke();
      h.d.forEach(function (p) { if (p[1] < y0) { y0 = p[1]; x0 = p[0]; } }); x1 = x0 * W; y1 = y0 * H; }
    if (nhan) { var r = Math.max(10, W / 40); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x1, y1, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '600 ' + Math.round(r * 1.15) + 'px Segoe UI,Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(so), x1, y1 + 1); }
    ctx.restore();
  }
  function veVe() {
    if (!VE.im) return; veCo(); var c = $('ccVeCv'), ctx = c.getContext('2d');
    ctx.drawImage(VE.im, 0, 0, c.width, c.height);
    VE.hinh.forEach(function (h, j) { veHinh(ctx, c.width, c.height, h, j + 1, true); });
    if (VE.dang) veHinh(ctx, c.width, c.height, VE.dang, 0, false);
  }
  function veVung() {
    var el = $('ccVeVung');
    if (!VE.hinh.length) { el.innerHTML = ''; return; }
    el.innerHTML = VE.hinh.map(function (h, j) { return '<label><b>' + (j + 1) + '</b><input type="text" data-vung="' + j + '" value="' + e_(h.nd || '') + '" placeholder="Ghi chú vùng ' + (j + 1) + ' (bỏ trống được)"></label>'; }).join('');
  }
  (function () {
    var diem = function (ev) { var c = $('ccVeCv'), r = c.getBoundingClientRect(); return [Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))]; };
    document.addEventListener('pointerdown', function (ev) {
      if (ev.target.id !== 'ccVeCv') return; ev.preventDefault(); ev.target.setPointerCapture(ev.pointerId);
      var p = diem(ev); VE.dang = VE.cu === 'p' ? { k: 'p', d: [p] } : { k: 'o', a: p, b: p }; veVe();
    });
    document.addEventListener('pointermove', function (ev) {
      if (!VE.dang || ev.target.id !== 'ccVeCv') return; var p = diem(ev);
      if (VE.dang.k === 'p') VE.dang.d.push(p); else VE.dang.b = p; veVe();
    });
    var xong = function () {
      if (!VE.dang) return; var h = VE.dang; VE.dang = null;
      var nho = h.k === 'o' ? (Math.abs(h.b[0] - h.a[0]) < 0.02 && Math.abs(h.b[1] - h.a[1]) < 0.02) : h.d.length < 3;
      if (!nho) { h.nd = ''; VE.hinh.push(h); veVung(); } veVe();
    };
    document.addEventListener('pointerup', xong); document.addEventListener('pointercancel', xong);
    window.addEventListener('resize', function () { if ($('ccVe') && $('ccVe').classList.contains('mo')) veVe(); });
  })();
  document.addEventListener('click', function (ev) {
    var ve = $('ccVe'); if (!ve || !ve.contains(ev.target)) return;
    var b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.cu === 'u') { VE.hinh.pop(); veVe(); veVung(); return; }
    if (b.dataset.cu) { VE.cu = b.dataset.cu; ve.querySelectorAll('.cong button[data-cu]').forEach(function (x) { x.classList.toggle('on', x === b); }); return; }
    if (b.classList.contains('huy')) { ve.classList.remove('mo'); VE.im = null; return; }
    if (b.classList.contains('xong')) veXong();
  });
  document.addEventListener('input', function (ev) { var t = ev.target; if (t.dataset && t.dataset.vung != null && VE.hinh[+t.dataset.vung]) VE.hinh[+t.dataset.vung].nd = t.value; });
  function veXong() {
    var t = CC.f.tep[VE.i]; if (!t) return; t.hinh = VE.hinh;
    var im = VE.im, done = function () { $('ccVe').classList.remove('mo'); VE.im = null; veForm(); };
    if (!t.hinh.length) { if (t.ve && t.ve.url) URL.revokeObjectURL(t.ve.url); t.ve = null; done(); return; }
    var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;   // ảnh đã nén ≤1600 ⇒ vẽ đúng cỡ gốc
    var ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0);
    t.hinh.forEach(function (h, j) { veHinh(ctx, c.width, c.height, h, j + 1, true); });
    c.toBlob(function (b) { if (t.ve && t.ve.url) URL.revokeObjectURL(t.ve.url); t.ve = { blob: b, url: URL.createObjectURL(b) }; t.url && (t.urlGoc = t.url); t.url = t.ve.url; done(); }, 'image/jpeg', 0.86);
  }

  /* ---------------- 7. Gửi tức thì + chạy nền ---------------- */
  function vungCua(tep) { var out = [], na = 0; tep.forEach(function (t) { if (t.loai === 'video') return; na++; (t.hinh || []).forEach(function (h, j) { out.push({ anh: na, so: j + 1, nd: h.nd || '' }); }); }); return out; }
  function gui() {
    var n = nguoi(); if (!n) { if (typeof tkMoDangNhap === 'function') tkMoDangNhap(); return; }
    var f = CC.f, gc = $('ccGhiChu'); if (gc) f.ghiChu = gc.value;
    if (!f.tep.length) { f.loi = 'Cần ít nhất 1 ảnh hoặc clip.'; veForm(); return; }
    if (!String(f.ghiChu).trim()) { f.loi = 'Cần ghi chú hiện trạng.'; veForm(); var g = $('ccGhiChu'); if (g) g.focus(); return; }
    var cu = f.sua ? timMa(f.ma) : null, now = Date.now();
    var it = { ma: f.ma || maMoi(), luc: cu ? cu.luc : now, capNhat: now, nguoi: cu ? cu.nguoi : n.ten, tk: cu ? cu.tk : n.id,
      sku: f.sku, maGo: f.maGo, cach: f.sku || f.maGo ? (f.cach || 'Gõ tay') : '', ten: f.ten, loai: f.loai, dv: f.dv, phanLoai: f.phanLoai,
      ghiChu: String(f.ghiChu).trim(), tep: f.tep, vung: vungCua(f.tep), soTem: cu ? cu.soTem : 0, lichSu: cu ? cu.lichSu : '', _cho: true, _dang: false, _loi: '', _vua: true };
    CC.ds = CC.ds.filter(function (x) { x._vua = false; return x.ma !== it.ma; }); CC.ds.unshift(it);
    bao((f.sua ? 'Đã lưu · ' : 'Đã gửi · ') + (it.sku || it.maGo || it.ma), 'ok');
    formMoi(); veForm(); veDs(); luuDs();
    dayLen(it);
  }
  async function dayLen(it) {
    if (it._dang) return; it._dang = true; it._loi = ''; veDs(); choCat(it);
    try {
      var can = it.tep.filter(function (t) { return !t.id || (t.ve && t.ve.blob && !t.veId); }), xong = 0;
      it._tien = can.length ? '0/' + can.length : ''; veDs();
      var hang = can.slice(), chay = async function () {
        while (hang.length) { var t = hang.shift();
          if (!t.id) { var r = await goiGas({ action: 'ccdc_tai', ma: it.ma, mime: t.blob.type || (t.loai === 'video' ? 'video/mp4' : 'image/jpeg'), ten: t.ten || (t.loai === 'video' ? 'clip.mp4' : 'anh.jpg'), base64: await docB64(t.blob) }, t.loai === 'video' ? 300000 : 90000); t.id = r.id; }
          if (t.ve && t.ve.blob && !t.veId) { var r2 = await goiGas({ action: 'ccdc_tai', ma: it.ma, mime: 'image/jpeg', ten: 'khoanh.jpg', base64: await docB64(t.ve.blob) }, 90000); t.veId = r2.id; }
          xong++; it._tien = xong + '/' + can.length; veDs(); choCat(it);
        } };
      await Promise.all([chay(), chay(), chay()]);
      /* tệp có khoanh: link chính = bản đã vẽ, kèm «(gốc)» */
      var tep = it.tep.map(function (t) { return t.veId ? { id: t.veId, loai: 'image', goc: t.id } : { id: t.id, loai: t.loai, goc: t.goc || '' }; });
      var kq = await goiGas({ action: 'ccdc_ghi', ghi: { ma: it.ma, sku: it.sku, maGo: it.maGo, cach: it.cach, ten: it.ten, loai: it.loai, dv: it.dv, phanLoai: it.phanLoai, ghiChu: it.ghiChu, vung: it.vung, tep: tep } }, 60000);
      it._cho = false; it._tien = ''; if (kq.lichSu != null) it.lichSu = kq.lichSu; if (kq.luc) it.luc = kq.luc;
      choXoa(it.ma);
    } catch (e) {
      it._loi = e.code === 401 ? 'Phiên đăng nhập hết hạn — đăng nhập lại rồi thử' : ('Chưa lưu — ' + (e.name === 'AbortError' ? 'mạng chậm' : e.message));
    } finally { it._dang = false; veDs(); luuDs(); }
  }

  /* ---------------- 8. Danh sách «Đã ghi nhận» ---------------- */
  function timMa(ma) { for (var i = 0; i < CC.ds.length; i++) if (CC.ds[i].ma === ma) return CC.ds[i]; return null; }
  function luuDs() {   // cache gọn cho lần mở sau (hiện ngay, máy chủ về thì thay) — không cất blob
    try { localStorage.setItem(K_DS, JSON.stringify({ at: Date.now(), ds: CC.ds.filter(function (x) { return !x._cho; }).slice(0, 200).map(function (x) {
      return Object.assign({}, x, { tep: x.tep.map(function (t) { return { id: t.veId || t.id, loai: t.loai, goc: t.veId ? t.id : (t.goc || '') }; }), _vua: false }); }) })); } catch (e) { }
  }
  function veDs() {
    var el = $('ccDs'); if (!el) return;
    var ds = CC.ds.filter(function (x) { return !CC.loc || (CC.loc === '_' ? !x.phanLoai : x.phanLoai === CC.loc); });
    $('ccDem').textContent = CC.ds.length ? '(' + (typeof nf === 'function' ? nf(CC.ds.length) : CC.ds.length) + ')' : '';
    $('ccLoc').innerHTML = [['', 'Tất cả']].concat(PL.map(function (p) { return [p, p]; })).concat([['_', 'Chưa phân loại']]).map(function (c) {
      return '<button type="button" class="kktab' + (CC.loc === c[0] ? ' active' : '') + '" data-locpl="' + e_(c[0]) + '">' + e_(c[1]) + '</button>'; }).join('');
    if (!ds.length) { el.innerHTML = '<div class="cc-trong">' + (CC.dangNap && !CC.ds.length ? 'Đang tải…' : (CC.ds.length ? 'Không có mục nào ở bộ lọc này.' : 'Chưa có ghi nhận nào.')) + '</div>'; return; }
    el.innerHTML = ds.slice(0, CC.soHien).map(function (x) {
      var t0 = x.tep[0] || {}, na = x.tep.filter(function (t) { return t.loai !== 'video'; }).length, nc = x.tep.length - na, nv = (x.vung || []).length;
      var tt = x._loi ? '<div class="cc-tt loi">' + e_(x._loi) + ' · <button type="button" data-thu="' + e_(x.ma) + '">thử lại</button></div>'
        : (x._cho ? '<div class="cc-tt"><span class="cc-vong"></span>Đang lưu' + (x._tien ? ' ' + e_(x._tien) : '') + '…</div>' : '');
      return '<div class="cc-dong' + (x._vua ? ' vua' : '') + '" data-dong="' + e_(x.ma) + '"><div class="cc-tb">' + (thumb(t0) ? '<img loading="lazy" src="' + e_(thumb(t0)) + '" alt="">' : '') + '</div><div class="cc-nd">' +
        '<div class="cc-t1"><span>' + e_([x.sku, x.ten || (!x.sku ? x.maGo : '')].filter(Boolean).join(' · ') || 'Không có SKU') + '</span>' + (x.phanLoai ? '<span class="cc-kqc ' + PL_LOP[x.phanLoai] + '">' + e_(x.phanLoai) + '</span>' : '') + '</div>' +
        '<div class="cc-t2">' + e_(x.ghiChu) + '</div>' +
        '<div class="cc-t3">' + av(x.nguoi, true) + '<span>' + e_(haiChuCuoi(x.nguoi)) + ' · ' + gio(x.luc) + ' · ' + [na && na + ' ảnh', nc && nc + ' clip', nv && nv + ' vùng hư'].filter(Boolean).join(' · ') + '</span>' +
        (x.sku ? '<button type="button" class="in" data-inma="' + e_(x.ma) + '">' + IC.inn.replace('<svg', '<svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.7"') + 'In tem</button>' : '') + '</div>' + tt + '</div></div>';
    }).join('') + (ds.length > CC.soHien ? '<button type="button" class="kktab cc-them" data-lam="xemThem">Xem thêm</button>' : '');
  }
  function moSua(ma) {
    var x = timMa(ma); if (!x) return;
    if (x._dang) { bao('Mục này đang lưu — chờ xong rồi sửa', 'warn'); return; }
    CC.f = { ma: x.ma, sua: true, sku: x.sku, maGo: x.maGo || x.sku, cach: x.cach, ten: x.ten, loai: x.loai, dv: x.dv, status: '', ghiChu: x.ghiChu, phanLoai: x.phanLoai, loi: '',
      tep: x.tep.map(function (t) { var hinhCu = []; return Object.assign({}, t, { hinh: hinhCu }); }) };
    /* vùng hư cũ gắn lại theo thứ tự ảnh (chỉ để đếm/hiện; ảnh đã lên Drive không vẽ lại được) */
    var na = 0; CC.f.tep.forEach(function (t) { if (t.loai === 'video') return; na++; t.hinh = (x.vung || []).filter(function (v) { return v.anh === na; }).map(function (v) { return { k: 'x', nd: v.nd }; }); });
    var r = x.sku ? traSku(x.sku) : null; if (r) CC.f.status = r.status || '';
    veForm(); var fo = $('ccForm'); if (fo && fo.scrollIntoView) fo.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  async function napDs(ep) {
    if (CC.dangNap || !nguoi()) { veDs(); return; }
    if (!ep && CC.napLan && Date.now() - CC.napLan < 30000) return;
    CC.dangNap = true; veDs();
    try {
      var j = await goiGas({ action: 'ccdc_lay' }, 45000), cho = CC.ds.filter(function (x) { return x._cho; }), coCho = {};
      cho.forEach(function (x) { coCho[x.ma] = 1; });
      CC.ds = cho.concat((j.ds || []).filter(function (x) { return !coCho[x.ma]; }));
      CC.napLan = Date.now(); luuDs();
    } catch (e) { if (e.code !== 401) bao('Chưa tải được danh sách: ' + e.message, 'warn'); }
    finally { CC.dangNap = false; veDs(); }
  }

  /* ---------------- 9. In tem (khuôn tem SKU nhà máy) ---------------- */
  var IN = null;
  function moIn(o) {
    if (!o.sku) return;
    var homNay = new Date();
    IN = { sku: o.sku, ten: o.ten || '', dv: o.dv || '', ma: o.ma || '', sl: '1', ngay: homNay, soTem: 1 };
    var n = nguoi();
    $('ccInThan').innerHTML = '<div class="tem" id="ccInTem"></div><div class="luoi">' +
      '<div><label class="n" for="ccInSl">SL</label><input class="o" id="ccInSl" inputmode="decimal" value="1"></div>' +
      '<div><label class="n">Ngày in</label><div id="ccInNgay"></div></div>' +
      '<div><label class="n">Người in</label><div class="ng">' + (n ? av(n.ten, true) + e_(haiChuCuoi(n.ten)) : 'Chưa đăng nhập') + '</div></div>' +
      '<div><label class="n">Số tem</label><div class="bac"><button type="button" class="cc-nut" data-st="-1">−</button><input class="o" id="ccInSo" inputmode="numeric" value="1"><button type="button" class="cc-nut" data-st="1">+</button></div></div></div>' +
      '<label class="n" style="margin-top:12px">Máy in</label><div class="may">' + IC.inn.replace('<svg', '<svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7"') + 'Chưa có thiết bị</div>' +
      '<div class="day"><button type="button" class="cc-nut" id="ccInCho">Thêm vào chờ in</button><button type="button" class="cc-nut xanh" disabled title="Chưa gắn thiết bị in">In ngay</button></div>';
    var nr = $('ccInNgay');
    if (typeof taoBoLocNgay === 'function') {
      var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      var bl = taoBoLocNgay({ root: nr, motNgay: true, khongRong: true, presets: [{ k: 'today', lb: 'Hôm nay' }], macDinh: function () { var x = iso(new Date()); return [x, x]; },
        onApply: function (tu) { if (tu) { var p = tu.split('-'); IN.ngay = new Date(+p[0], +p[1] - 1, +p[2]); veTem(); } } });
      bl.dat(iso(homNay), iso(homNay));
    } else nr.innerHTML = '<div class="ng">' + homNay.toLocaleDateString('vi-VN') + '</div>';
    veTem(); plgMoModal('ccInModal');
  }
  function veTem() {
    var el = $('ccInTem'); if (!el || !IN) return;
    try { el.innerHTML = PR_TEM.mau(PR_TEM.MAU_MAC_DINH).ve({ sku: IN.sku, pn: IN.ten + (IN.dv && IN.ten.indexOf('/') < 0 ? '/' + IN.dv : ''), sl: IN.sl, ngay: PR_TEM.ngayTem(IN.ngay), uid: '', loai: '', vitri: '', dv: '' }); }
    catch (e) { el.textContent = IN.sku; }
  }
  document.addEventListener('input', function (ev) {
    if (!IN) return; var t = ev.target;
    if (t.id === 'ccInSl') { IN.sl = t.value.trim(); veTem(); }
    if (t.id === 'ccInSo') { IN.soTem = Math.max(1, Math.min(50, parseInt(t.value, 10) || 1)); }
  });
  document.addEventListener('click', function (ev) {
    var m = $('ccInModal'); if (!m || !m.contains(ev.target) || !IN) return;
    var b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.st) { IN.soTem = Math.max(1, Math.min(50, IN.soTem + (+b.dataset.st))); $('ccInSo').value = IN.soTem; return; }
    if (b.id === 'ccInCho') {
      if (!nguoi()) { if (typeof tkMoDangNhap === 'function') tkMoDangNhap(); return; }
      var lenh = { action: 'ccdc_in', sku: IN.sku, ten: IN.ten, sl: IN.sl, dv: IN.dv, ngay: PR_TEM.ngayTem(IN.ngay), soTem: IN.soTem, ma: IN.ma };
      plgDongModal('ccInModal'); bao('Đã thêm ' + IN.soTem + ' tem ' + IN.sku + ' vào chờ in', 'ok');
      goiGas(lenh, 45000).catch(function (e) { bao('Chưa ghi được lệnh in ' + lenh.sku + ': ' + e.message, 'err'); });
    }
  });

  /* ---------------- 10. Mở tab ---------------- */
  window.ccdcMo = function (ep) {
    veKhung(); if (!CC.f) formMoi(); veForm();
    if (!CC.ds.length) { try { var c = JSON.parse(localStorage.getItem(K_DS) || 'null'); if (c && c.ds) CC.ds = c.ds; } catch (e) { } }
    veDs();
    if (!CC._choNap) { CC._choNap = 1; choDoc().then(function (ds) {   // lượt gửi dở dang từ lần trước ⇒ gửi tiếp
      (ds || []).forEach(function (b) { var it = b.it; it.tep.forEach(function (t) { if (t.blob) t.url = URL.createObjectURL(t.blob); if (t.veBlob) { t.ve = { blob: t.veBlob, url: URL.createObjectURL(t.veBlob) }; t.url = t.ve.url; } });
        it._cho = true; CC.ds = CC.ds.filter(function (x) { return x.ma !== it.ma; }); CC.ds.unshift(it); dayLen(it); });
      veDs(); }); }
    if (!danhMuc() && typeof ndsTaiDanhMuc === 'function' && !CC._dmNap) { CC._dmNap = 1; ndsTaiDanhMuc(false).catch(function () { }); }
    napDs(ep);
  };
  window.ccdcSo = function () { return CC.ds.length ? CC.ds.length : null; };
  window.ccdcRoiTab = function () { if (NDS_CHO) ndsDong(); };
})();
