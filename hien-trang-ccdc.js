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
 *  11/11 chiều (user chốt Mẫu 2): thêm QR tài sản · S/N (ô gõ + quét) ở mục 1, Mã vị trí = biểu tượng QR trong
 *  3 nút Phân loại (bấm = chọn loại + quét mã vị trí). In tem = TEM HIỆN TRẠNG 40×60 (PR_TEM loai 'cc': dải
 *  hiện trạng đầu tem · SKU trong mã vạch · QR «Xem chi tiết» · ngày · người in), lệnh ccdc_in đi hàng đợi
 *  pr_them ra máy in laptop. QR trỏ https://audit-dc.pages.dev/factory/?cc=<mã> ⇒ trang chi tiết (Mẫu 2
 *  «Dải trạng thái»), cần đăng nhập.
 *  Sheet chỉ xem: https://docs.google.com/spreadsheets/d/1sXd8imGeXriBFrUoxQlyfjESdhxv9tUxjLDfsJ06_do
 * ============================================================================================ */
(function () {
  'use strict';
  if (window.ccdcMo) return;
  var PL = ['Tái sử dụng', 'Sửa chữa', 'Thanh lý'];
  var PL_LOP = { 'Tái sử dụng': 'tsd', 'Sửa chữa': 'sc', 'Thanh lý': 'tl' };
  /* 11/11 user: chữ trên NÚT «Tái sử dụng» → «Tái dùng» cho gọn. Giá trị lưu/gửi/lọc + chữ trên tem GIỮ «Tái sử dụng»
     (GAS whitelist CCDC_PHAN_LOAI). Chỉ dùng hàm này ở chỗ hiển thị nút. */
  function nhanPL(p) { return p === 'Tái sử dụng' ? 'Tái dùng' : p; }
  var K_DS = 'ccdc-ds-v1', TRANG = 20, MAX_ANH = 1600;
  var CC = window.CC = { ds: [], loc: '', locNg: '', dsMo: false, soHien: TRANG, napLan: 0, dangNap: false, f: null, dang: {} };
  try { CC.dsMo = localStorage.getItem('ccdc-ds-mo') === '1'; } catch (e) { }
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
    '#viewCcdc .cc-sku2{display:grid;grid-template-columns:1fr 1fr} #viewCcdc .cc-sku2 .cc-nut{justify-content:center;width:100%}',
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
    '#viewCcdc .cc-pl button{flex:1;min-width:0;border:1px solid var(--line);border-radius:8px;padding:7px 0;font-weight:600;font-size:13.5px;color:var(--ink2);background:var(--surface);cursor:pointer;display:flex;align-items:center}',
    '#viewCcdc .cc-pl .pl-t{flex:1;min-width:0;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4px}',
    '#viewCcdc .cc-pl .pl-qr{display:flex;align-items:center;justify-content:center;width:30px;flex:none;align-self:stretch;margin:-7px 0;border-left:1px solid var(--line);color:var(--ink3)}',
    '#viewCcdc .cc-pl .pl-qr svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round}',
    '#viewCcdc .cc-pl button.on .pl-qr{border-left-color:currentColor;color:inherit}',
    /* 11/11 tối user: mã vị trí nhập QUA biểu tượng QR trên chip phân loại (không có chỗ riêng) — thiếu thì tô đỏ chính các biểu tượng đó */
    '#viewCcdc .cc-pl.thieu-vt .pl-qr{color:#cf1322;background:#fff1f0;border-left-color:#ffa39e;animation:ccNhayVt 1s ease 2}',
    '@keyframes ccNhayVt{50%{background:#ffccc7}}',
    '#viewCcdc .cc-pl button.co-vt .pl-qr{background:currentColor;border-radius:0 6px 6px 0} #viewCcdc .cc-pl button.co-vt .pl-qr svg{stroke:#fff}',
    '#viewCcdc .cc-vt{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:13px;color:var(--ink2)}',
    '#viewCcdc .cc-vt b,#viewCcdc .cc-mono{font-weight:600;font-family:ui-monospace,Consolas,monospace;color:var(--ink)}',
    '#viewCcdc .cc-vt b{border:1px solid var(--line);border-radius:4px;padding:2px 6px}',
    '#viewCcdc .cc-vt .x{border:0;background:none;color:var(--ink3);cursor:pointer;font-size:14px;padding:0 4px}',
    '#viewCcdc .cc-tsk{display:flex;align-items:center;flex-wrap:wrap;gap:4px 14px;margin-top:8px;font-size:13px;color:var(--ink2)}',
    '#viewCcdc .cc-tsk>span{display:inline-flex;align-items:center;gap:6px;min-width:0}',
    '#viewCcdc .cc-tsk b{font-weight:600;font-family:ui-monospace,Consolas,monospace;color:var(--ink);border:1px solid var(--line);border-radius:4px;padding:2px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60vw}',
    '#viewCcdc .cc-tsk .x{border:0;background:none;color:var(--ink3);cursor:pointer;font-size:14px;padding:0 4px}',
    '#viewCcdc .cc-o{display:flex;height:38px;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--surface)}',
    '#viewCcdc .cc-o input{flex:1;min-width:0;border:0;padding:0 10px;font-size:16px;background:transparent;color:var(--ink);outline:0}',
    '#viewCcdc .cc-o button{width:38px;flex:none;border:0;border-left:1px solid var(--line);background:var(--surface);color:var(--ink2);cursor:pointer;display:grid;place-items:center}',
    '#viewCcdc .cc-o button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round}',
    /* trang chi tiết (quét QR trên tem) — Mẫu 2 «Dải trạng thái» */
    '#ccCt{max-width:820px}',
    '#ccCt .ct-dau{display:flex;align-items:center;gap:8px;margin-bottom:10px}',
    '#ccCt .ct-dau .lui{border:0;background:none;color:#1677ff;cursor:pointer;font-size:14px;padding:0;display:inline-flex;align-items:center;gap:4px}',
    '#ccCt .ct-dau .cc-nut{height:32px;font-size:13px;padding:0 12px} #ccCt .ct-dau .gian{flex:1}',
    '#ccCt .panel{padding:0;overflow:hidden}',
    '#ccCt .dai{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid}',
    '#ccCt .dai .vach{width:6px;align-self:stretch;border-radius:2px}',
    '#ccCt .dai .nh{font-size:12px;font-weight:600;letter-spacing:.4px} #ccCt .dai .lon{font-size:24px;font-weight:600}',
    '#ccCt .dai .sp{margin-left:auto;text-align:right;min-width:0} #ccCt .dai .sp b{font-size:17px;font-weight:600;display:block} #ccCt .dai .sp span{font-size:13px;color:var(--ink2)}',
    '#ccCt .dai.tl{background:#fff1f0;border-color:#ffa39e} #ccCt .dai.tl .vach{background:#cf1322} #ccCt .dai.tl .nh{color:#cf1322} #ccCt .dai.tl .lon{color:#a8071a}',
    '#ccCt .dai.sc{background:#fffbe6;border-color:#ffe58f} #ccCt .dai.sc .vach{background:#d48806} #ccCt .dai.sc .nh{color:#d48806} #ccCt .dai.sc .lon{color:#ad6800}',
    '#ccCt .dai.tsd{background:#f6ffed;border-color:#b7eb8f} #ccCt .dai.tsd .vach{background:#389e0d} #ccCt .dai.tsd .nh{color:#389e0d} #ccCt .dai.tsd .lon{color:#237804}',
    '#ccCt .dai.trong{background:var(--hover,#fafafa);border-color:var(--line)} #ccCt .dai.trong .vach{background:#bfbfbf} #ccCt .dai.trong .nh,#ccCt .dai.trong .lon{color:var(--ink2)}',
    '#ccCt .than{padding:16px 20px}',
    '#ccCt .muc{display:grid;grid-template-columns:150px minmax(0,1fr);gap:14px;padding:14px 0;border-top:1px solid var(--line)}',
    '#ccCt .muc:first-child{border-top:0;padding-top:0} #ccCt .muc>h4{margin:0;font-size:13px;font-weight:600;color:var(--ink2)}',
    '#ccCt .gc{font-size:15px;line-height:1.55;white-space:pre-wrap}',
    '#ccCt .anhs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
    '#ccCt .anhs .cc-anh{width:auto;height:auto;aspect-ratio:1/1}',
    '#ccCt .vg{display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--ink2);padding:3px 0}',
    '#ccCt .vg i{font-style:normal;width:20px;height:20px;border-radius:50%;background:#ef4444;color:#fff;font-size:11px;font-weight:600;display:grid;place-items:center;flex:none}',
    '#ccCt .kv{display:grid;gap:6px} #ccCt .kv>div{display:flex;gap:12px;font-size:14px} #ccCt .kv span{width:90px;color:var(--ink3);flex:none} #ccCt .kv b{font-weight:600;font-family:ui-monospace,Consolas,monospace;word-break:break-all}',
    '#ccCt .ng{display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--ink3);flex-wrap:wrap} #ccCt .ng b{color:var(--ink);font-weight:600}',
    '#ccCt .ls{font-size:13px;color:var(--ink2);white-space:pre-line;margin-top:8px;line-height:1.6}',
    '#ccCt .trong{padding:28px 20px;text-align:center;color:var(--ink3);font-size:14px} #ccCt .trong .cc-nut{margin-top:12px}',
    '@media(max-width:640px){#ccCt .muc{grid-template-columns:minmax(0,1fr);gap:8px} #ccCt .dai{flex-wrap:wrap} #ccCt .dai .sp{margin-left:20px;text-align:left;flex-basis:100%}}',
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
    '#ccInModal .day{display:flex;gap:8px;margin-top:16px} #ccInModal .day .cc-nut{flex:1}',
    '#ccTsModal .ts-ds{display:flex;flex-direction:column;gap:8px}',
    /* pop-up xem ảnh/clip (11/11) — rộng gần hết màn, ảnh giữ tỉ lệ */
    '#ccAnhModal .modalbox{width:min(960px,96vw);max-width:96vw}',
    '#ccAnhModal .xa-khung{display:flex;align-items:center;justify-content:center;background:#111;border-radius:8px;min-height:240px;height:min(72vh,720px);overflow:hidden}',
    '#ccAnhModal .xa-khung img,#ccAnhModal .xa-khung video{max-width:100%;max-height:100%;object-fit:contain;display:block}',
    '#ccAnhModal .xa-khung iframe{width:100%;height:100%;border:0}',
    '#ccAnhModal .xa-dieu{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:10px;font-size:14px;color:var(--ink2)}',
    '#ccAnhModal .xa-dieu .cc-nut{min-width:44px;font-size:20px;justify-content:center}',
    '#ccTsModal .ts-ds button{display:block;text-align:left;border:1px solid var(--line);border-radius:8px;background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--ink);font:inherit}',
    '#ccTsModal .ts-ds button:hover{border-color:#1677ff}',
    '#ccTsModal .ts-ds b{font-weight:600} #ccTsModal .ts-ds small{display:block;font-size:12.5px;color:var(--ink3);margin-top:2px}',
    '#viewCcdc button.cc-to{font:inherit;font-weight:600;font-size:14.5px;width:100%}',
    /* 12/11 pop-up Chuyển vị trí. Nút đầu khối KHÔNG dùng lớp .btn-filter: tat-loc.js coi .btn-filter đầu tiên trong tiêu đề là nút
       ngăn kéo lọc và bấm hộ để đóng ⇒ mở nhầm pop-up. Lớp riêng, cùng dáng .btn-filter. */
    '#ccDsKhoi .cc-vtnut{flex:none;display:inline-flex;align-items:center;justify-content:center;padding:0 10px;height:28px;font-size:12px;font-weight:600;line-height:1;border-radius:6px;border:1.5px solid #1677ff;background:#e6f4ff;color:#0958d9;cursor:pointer;white-space:nowrap;font-family:inherit}',   /* 12/11 user: khung nổi bật hơn */
    '#ccDsKhoi .cc-vtnut{gap:5px} #ccDsKhoi .cc-vtnut svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}',
    '@media(max-width:480px){#ccDsKhoi .cc-vtnut .chu{display:none} #ccDsKhoi .cc-vtnut{width:30px;padding:0}}',
    '#ccDsKhoi .btn-filter.cc-locnut{width:30px;padding:0;gap:0} #ccDsKhoi .btn-filter.cc-locnut::after{display:none}',
    '#ccDsKhoi .cc-locnut svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}',
    '#ccDsKhoi .cc-vtnut:hover{background:#1677ff;color:#fff}',
    '#ccDsKhoi .cc-vtnut svg{stroke-width:2}',
    '#ccVtModal .modalbox{width:min(520px,96vw)} #ccVtModal .cc-than{padding:16px 18px 18px;overflow:auto}',
    '#ccVtModal .vt-muc+.vt-muc{margin-top:16px}',
    '#ccVtModal .vt-nhan{font-size:14px;font-weight:600;margin-bottom:8px} #ccVtModal .vt-nhan small{font-weight:400;font-size:12px;color:var(--ink3);margin-left:4px}',
    '#ccVtModal .vt-hang{display:flex;gap:8px} #ccVtModal .vt-hang input{flex:1;min-width:0;height:38px;border:1px solid var(--line);border-radius:8px;padding:0 12px;font-size:16px;background:var(--surface);color:var(--ink)}',
    '#ccVtModal .vt-hang .cc-nut{flex:none}',
    '#ccVtModal .vt-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
    '#ccVtModal .vt-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:6px;padding:3px 4px 3px 9px;font-size:13px;background:var(--surface)}',
    '#ccVtModal .vt-chip b{font-weight:600;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px} #ccVtModal .vt-chip small{color:var(--ink3);font-size:12px;white-space:nowrap}',
    '#ccVtModal .vt-chip.den{border-color:#91caff;background:#e6f4ff;color:#0958d9}',
    '#ccVtModal .vt-chip button{border:0;background:none;color:var(--ink3);cursor:pointer;font-size:13px;padding:2px 5px;line-height:1}',
    '#ccVtModal .vt-trong{font-size:12.5px;color:var(--ink3)}',
    '#ccVtModal .vt-chan{margin-top:18px} #ccVtModal .vt-chan .cc-nut{width:100%}',
    /* pop-up camera trong trang (11/11 tối: ô tệp accept ảnh+clip có capture bị Android mở thư viện) */
    '#ccCamModal .modalbox{width:min(560px,96vw)}',
    '#ccCamModal .cc-than{padding:0;background:#000;display:flex;flex-direction:column;overflow:hidden}',
    '#ccCamV{width:100%;aspect-ratio:3/4;max-height:64vh;max-height:58dvh;object-fit:cover;background:#000;display:block;flex:0 1 auto;min-height:0}',
    '#ccCamModal .modalbox{max-height:94dvh} #ccCamModal .cam-dk{flex:none}',   /* 12/11 iPhone: vh tính cả thanh địa chỉ ⇒ hàng nút rơi khỏi màn */
    '#ccCamModal .cam-dk{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;padding:14px 16px;background:#000;color:#e2e8f0}',
    '#ccCamModal .cam-che{display:flex;gap:6px} #ccCamModal .cam-che button{border:1px solid #475569;background:none;color:#cbd5e1;border-radius:6px;padding:5px 12px;font-size:13px;cursor:pointer}',
    '#ccCamModal .cam-che button.on{background:#fff;color:#111;border-color:#fff;font-weight:600}',
    '#ccCamModal .cam-chup{width:66px;height:66px;border-radius:50%;border:4px solid #fff;background:none;padding:5px;cursor:pointer;display:grid;place-items:center}',
    '#ccCamModal .cam-chup i{display:block;width:100%;height:100%;border-radius:50%;background:#fff;transition:all .15s}',
    '#ccCamModal.clip .cam-chup i{background:#ef4444} #ccCamModal.dang .cam-chup i{width:26px;height:26px;border-radius:4px}',
    '#ccCamModal .cam-phai{display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-size:12.5px;color:#cbd5e1}',
    '#ccCamModal .cam-phai .cc-nut{height:32px;padding:0 14px;font-size:13px}',
    '#ccCamModal .cam-gio{color:#fca5a5;font-variant-numeric:tabular-nums}',
    '#ccCamModal .cam-may{border:0;background:#000;color:#93c5fd;font-size:13px;padding:0 16px 14px;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 12px);cursor:pointer;text-align:center;width:100%}',
    '#ccCamModal .cam-may[hidden]{display:none}',
    '@media(max-width:640px){#ccCamV{flex:1;min-height:0;max-height:none;aspect-ratio:auto}}',
    /* 11/11 user duyệt «Mẫu 1 · Thẻ Nhận diện SKU» (ưu tiên đủ tên): thẻ = cụm ACTIVE/Normal của Nhận diện SKU + SKU + TÊN ĐỦ
       (xuống dòng, không cắt) + dòng QR tài sản · S/N; khung/nút gọn; «Đã ghi nhận» xổ xuống, Bộ lọc chỉ Người ghi nhận */
    '#viewCcdc .cc-the{margin-top:8px;border:1px solid #b7eb8f;background:#f6ffed;border-radius:8px;overflow:hidden}',
    '#viewCcdc .cc-the.trong{border-color:var(--line);background:var(--surface)}',
    '#viewCcdc .cc-the-dau{display:flex;align-items:flex-start;gap:10px;padding:7px 6px 7px 10px}',
    '#viewCcdc .cc-the-dau .nds-tags-col{margin-top:3px}',
    '#viewCcdc .cc-the-sp{flex:1;min-width:0;display:flex;flex-direction:column}',
    '#viewCcdc .cc-the-sp b{font-size:15px;font-weight:600;line-height:1.3}',
    '#viewCcdc .cc-the-sp span{font-size:13px;color:var(--ink2);line-height:1.4;overflow-wrap:anywhere}',
    '#viewCcdc .cc-the-dd{display:flex;flex-wrap:wrap;gap:2px 14px;padding:5px 6px 5px 10px;border-top:1px solid #d9f7be;font-size:12px;color:var(--ink3)}',
    '#viewCcdc .cc-the.trong .cc-the-dd{border-top:0}',
    '#viewCcdc .cc-the-dd>span{display:inline-flex;align-items:center;gap:4px;min-width:0;max-width:100%}',
    '#viewCcdc .cc-the-dd b{font-family:ui-monospace,Consolas,monospace;color:var(--ink);font-weight:600;overflow-wrap:anywhere}',
    '#viewCcdc .cc-the .x{border:0;background:none;color:#8c8c8c;font-size:13px;cursor:pointer;line-height:1;padding:2px 4px;flex:none}',
    '#viewCcdc .panel h2{font-size:15px;margin-bottom:8px}',
    '#viewCcdc .cc-h3{margin:12px 0 6px;font-size:13px}',
    '#viewCcdc .cc-sku input{height:34px;font-size:15px} #viewCcdc .cc-sku .cc-nut{height:34px;font-size:13px;padding:0 10px}',
    '#viewCcdc .cc-hai{gap:6px}',
    '#viewCcdc .cc-to{display:flex;align-items:center;justify-content:center;gap:6px;padding:0 4px;height:36px;font-size:13.5px;border-width:1px}',
    '#viewCcdc .cc-to small{display:none}',
    '#viewCcdc .cc-to svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round;flex:none}',
    '#viewCcdc textarea{min-height:58px;font-size:15px;padding:7px 10px}',
    '#viewCcdc .cc-pl button{padding:4px 0;font-size:13px} #viewCcdc .cc-pl .pl-qr{margin:-4px 0}',
    '#viewCcdc .cc-gui{margin-top:12px;padding-top:10px} #viewCcdc .cc-gui .cc-nut.xanh{height:34px}',
    '#ccDsKhoi{position:relative}',
    '#ccDsKhoi .panel-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
    '#ccDsKhoi .ds-mo{display:inline-flex;align-items:center;gap:6px;border:0;background:none;padding:0;font:inherit;font-size:15px;font-weight:600;color:var(--ink);cursor:pointer;min-width:0}',
    '#ccDsKhoi .ds-mo small{font-weight:400;color:var(--ink3);font-size:13px}',
    '#ccDsKhoi .ds-mo small.loi{color:var(--bad,#cf1322)} #ccDsKhoi .ds-mo small.cho{color:#1677ff}',
    '#ccDsKhoi .ds-mo svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;transition:transform .15s;flex:none}',
    '#ccDsKhoi.mo .ds-mo svg{transform:rotate(90deg)} #ccDsKhoi .panel-head .gian{flex:1}',
    '#ccDsKhoi .cc-sheet{margin-left:0;white-space:nowrap;flex:none}',
    /* 11/11 tối (ảnh user, điện thoại): «Đã ghi nhận» + «Mở Sheet ↗» bị bẻ 2 dòng ⇒ tiêu đề không co, không xuống dòng; hẹp quá thì số đếm co lại */
    '#ccDsKhoi .ds-mo{flex:0 1 auto;white-space:nowrap;overflow:hidden;box-shadow:none!important;background:none!important} #ccDsKhoi .ds-mo small{flex:none}',
    '@media(max-width:480px){#ccDsKhoi .cc-sheet .mo-chu{display:none} #ccDsKhoi .panel-head{gap:6px}}',
    '@media(max-width:359px){#ccDsKhoi .cc-sheet{display:none}}',
    '#ccDsKhoi .panel-head .btn-filter{flex:none}',
    '#ccDsKhoi.mo .cc-loc{margin-bottom:6px}',
    '#ccDsKhoi > .filters{display:block;padding:12px}',
    '#ccDsKhoi > .filters .lbl{display:block;font-size:12px;color:var(--ink3);margin-bottom:6px}',
    '#ccDsKhoi > .filters input{width:100%;height:32px;border:1px solid var(--line);border-radius:6px;padding:0 10px;font-size:14px;margin-bottom:8px;background:var(--surface);color:var(--ink)}',
    '#ccDsKhoi .cc-locng{display:flex;gap:6px;flex-wrap:wrap;max-height:180px;overflow:auto}',
    '#ccDsKhoi .cc-locng button{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:6px;padding:3px 10px 3px 4px;font:inherit;font-size:13px;cursor:pointer;background:var(--surface);color:var(--ink)}',
    '#ccDsKhoi .cc-locng button.tat{padding-left:10px}',
    '#ccDsKhoi .cc-locng button.on{border-color:#1677ff;background:#e6f4ff;color:#1677ff;font-weight:600}',
    '#ccDsKhoi .cc-locng small{color:var(--ink3);font-weight:400}',
    '#ccInModal .tt{height:38px;display:flex;align-items:center;border:1px solid var(--line);border-radius:8px;padding:0 10px;font-size:14px;font-weight:600}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'ccdcCss'; st.textContent = css; document.head.appendChild(st);

  var IC = {
    quet: '<svg viewBox="0 0 20 20"><path d="M3 6V3h3M14 3h3v3M17 14v3h-3M6 17H3v-3M6 7v6M9 7v6M11 7v6M14 7v6"/></svg>',
    cam: '<svg viewBox="0 0 20 20"><path d="M2.5 6.5h3l1.5-2h6l1.5 2h3v9h-15z"/><circle cx="10" cy="11" r="3"/></svg>',
    tep: '<svg viewBox="0 0 20 20"><path d="M3 5h5l2 2h7v9H3z"/></svg>',
    mui: '<svg viewBox="0 0 20 20"><path d="M7 4l6 6-6 6"/></svg>',
    ai: '<svg viewBox="0 0 20 20"><path d="M10 2l1.6 4.4L16 8l-4.4 1.6L10 14l-1.6-4.4L4 8l4.4-1.6zM15.5 13l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>',
    inn: '<svg viewBox="0 0 20 20"><path d="M6 8V3h8v5M6 14H3V8h14v6h-3M6 11h8v6H6z"/></svg>',
    qr: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="6" height="6" rx="1"/><rect x="14.5" y="3.5" width="6" height="6" rx="1"/><rect x="3.5" y="14.5" width="6" height="6" rx="1"/><path d="M14.5 14.5h2.5v2.5M18 18h2.5v2.5h-2.5M20.5 14.5v.01M14.5 20.5v.01"/></svg>'
  };
  /* QR trên tem: link CHÍNH (kể cả khi in từ bản xem trước) — ngắn để mã QR nhỏ (≤ 29×29 ô) */
  var LINK_CT = 'https://audit-dc.pages.dev/factory/?cc=';
  var QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js', QRN = null;
  function napQr() { if (window.qrcode) return Promise.resolve(); if (QRN) return QRN;
    QRN = new Promise(function (ok, loi) { var sc = document.createElement('script'); sc.src = QR_LIB; sc.onload = ok; sc.onerror = function () { QRN = null; loi(new Error('Không tải được bộ tạo QR')); }; document.head.appendChild(sc); });
    return QRN; }
  function qrHex(txt) {   // → "N:hex" (bit đen theo hàng) cho PR_TEM loai 'cc' — agent in không cần thư viện QR
    var q = window.qrcode(0, 'L'); q.addData(txt); q.make();
    var n = q.getModuleCount(), b = '', h = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) b += q.isDark(r, c) ? '1' : '0';
    while (b.length % 4) b += '0';
    for (var i = 0; i < b.length; i += 4) h += parseInt(b.substr(i, 4), 2).toString(16);
    return (n < 10 ? '0' : '') + n + ':' + h;
  }

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
    if ((!n || !body.phien) && body.action !== 'ccdc_xem') { var e0 = new Error('Cần đăng nhập'); e0.code = 401; throw e0; }   // 11/11: xem phiếu qua QR mở cho tất cả
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
      /* 11/11 user: «Đã ghi nhận» dạng mũi tên xổ xuống (mặc định ĐÓNG, bấm mới hiện lịch sử); tab phân loại vẫn ở ngoài;
         Bộ lọc = nút chữ chuẩn + ngăn kéo nổi (.panel > .filters) chỉ lọc NGƯỜI GHI NHẬN */
      '<section class="panel" id="ccDsKhoi"><div class="panel-head"><button type="button" class="ds-mo" data-lam="dsMo" aria-expanded="false">' + IC.mui + 'Đã ghi nhận <small id="ccDem"></small></button>' +
        '<span class="gian"></span><button type="button" class="cc-vtnut" data-lam="vtMo" title="Chuyển vị trí" aria-label="Chuyển vị trí"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7h12M12 4l3 3-3 3M17 13H5M8 10l-3 3 3 3"/></svg><span class="chu">Chuyển vị trí</span></button><button type="button" class="btn-filter cc-locnut" id="ccBtnLoc" data-lam="loc" title="Tìm / lọc người ghi nhận" aria-label="Tìm / lọc người ghi nhận"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M12.6 12.6 17 17"/></svg></button></div>' +   /* 12/11 user: bỏ «Sheet», Bộ lọc → biểu tượng tìm kiếm */
        '<div class="filters collapsed" id="ccLocBody"><span class="lbl">Người ghi nhận</span><input id="ccLocTim" type="text" autocomplete="off" placeholder="Tìm tên / mã NV"><div class="cc-locng" id="ccLocNg"></div></div>' +
        '<div class="cc-loc" id="ccLoc"></div><div id="ccDs" hidden></div></section>' +
      '</div>';
    var pop = function (id, tieuDe, than) { var m = document.createElement('div'); m.id = id; m.className = 'modal cc-pop';
      m.innerHTML = '<div class="modalbox"><div class="modalhd"><div><div class="mt">' + tieuDe + '</div></div><button class="mclose" type="button">&times;</button></div><div class="cc-than">' + than + '</div></div>';
      document.body.appendChild(m); return m; };
    var mN = pop('ccNdsModal', 'Nhận diện SKU', '<div id="ccNdsCho"></div>');
    mN.addEventListener('click', function (ev) { if (ev.target === mN || ev.target.closest('.mclose')) ndsDong(); });
    /* 12/11 user «iOS bấm chụp/quay: camera toàn màn hình, không có nút chụp/quay/khoanh»: Safari / trình duyệt trong app
       (Zalo…) đẩy <video> ra trình phát gốc nếu thiếu webkit-playsinline ⇒ mất pop-up + nút. Đủ thuộc tính + gán thuộc tính
       JS trước khi gắn luồng (camMo); lỡ vẫn bung (webkitbeginfullscreen) ⇒ tự thoát và hiện nút «Camera máy» (camera gốc
       của iPhone có sẵn nút chụp/quay). Nút «Camera máy» luôn có trên iPhone/iPad làm lối dự phòng. */
    var IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var mC = pop('ccCamModal', 'Chụp / quay', '<video id="ccCamV" autoplay playsinline webkit-playsinline muted disablepictureinpicture disableremoteplayback></video>' +
      '<div class="cam-dk"><div class="cam-che"><button type="button" data-cam="anh" class="on">Ảnh</button><button type="button" data-cam="clip">Clip</button></div>' +
      '<button type="button" class="cam-chup" aria-label="Chụp"><i></i></button>' +
      '<div class="cam-phai"><span id="ccCamSo"></span><button type="button" class="cc-nut xanh" data-cam="xong">Xong</button></div></div>' +
      '<button type="button" class="cam-may" data-cam="may"' + (IOS ? '' : ' hidden') + '>Dùng camera máy</button>');
    var vC = mC.querySelector('#ccCamV');
    vC.addEventListener('webkitbeginfullscreen', function () { try { vC.webkitExitFullscreen(); } catch (e) { } var b = mC.querySelector('.cam-may'); if (b) b.hidden = false; });
    mC.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-cam="may"]')) { camDong(); camDuPhong(); return; }
      if (ev.target === mC || ev.target.closest('.mclose') || ev.target.closest('[data-cam="xong"]')) { camDong(); return; }
      var b = ev.target.closest('button'); if (!b) return;
      if (b.classList.contains('cam-chup')) { camChup(); return; }
      if (b.dataset.cam === 'anh' || b.dataset.cam === 'clip') { if (CAM.rec) return; CAM.che = b.dataset.cam; camVeChe(); }
    });
    var mT = pop('ccTsModal', 'Chọn SKU của tài sản', '<div id="ccTsThan"></div>');
    mT.addEventListener('click', function (ev) {
      if (ev.target === mT || ev.target.closest('.mclose')) { plgDongModal('ccTsModal'); return; }
      var b = ev.target.closest('[data-tsi]'); if (b && TS_CHON) { var d = TS_CHON; TS_CHON = null; plgDongModal('ccTsModal'); tsGan(d.code, d.ds[+b.dataset.tsi], d.laS); }
    });
    /* 11/11 user: ảnh/clip ở trang chi tiết xem NGAY trong pop-up (không trỏ sang Drive). Ảnh = thumbnail Drive cỡ lớn
       (tệp chia sẻ «ai có link», xem được không cần đăng nhập Google); clip = khung preview của Drive nhúng trong pop-up. */
    var mA = pop('ccAnhModal', 'Ảnh / clip hiện trạng', '<div class="xa-khung" id="ccAnhKhung"></div>' +
      '<div class="xa-dieu"><button type="button" class="cc-nut" data-xa="-1" aria-label="Trước">‹</button><span id="ccAnhSo"></span><button type="button" class="cc-nut" data-xa="1" aria-label="Sau">›</button></div>');
    mA.addEventListener('click', function (ev) {
      if (ev.target === mA || ev.target.closest('.mclose')) { dongXemAnh(); return; }
      var b = ev.target.closest('[data-xa]'); if (b && XA) veXemAnh(XA.i + (+b.dataset.xa));
    });
    var x0 = null;
    mA.addEventListener('touchstart', function (ev) { x0 = ev.touches.length === 1 ? ev.touches[0].clientX : null; }, { passive: true });
    mA.addEventListener('touchend', function (ev) { if (x0 == null || !XA) return; var dx = ev.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) veXemAnh(XA.i + (dx < 0 ? 1 : -1)); }, { passive: true });
    document.addEventListener('keydown', function (ev) { if (!XA || !mA.classList.contains('show') && getComputedStyle(mA).display === 'none') return;
      if (ev.key === 'ArrowRight') veXemAnh(XA.i + 1); else if (ev.key === 'ArrowLeft') veXemAnh(XA.i - 1); });
    /* 12/11 «Chuyển vị trí»: quét NHIỀU mã vị trí nguồn → 1 mã vị trí đích ⇒ mọi phiếu đang ở nguồn đổi sang đích (ccdc_vitri) */
    var mV = pop('ccVtModal', 'Chuyển vị trí', '<div id="ccVtThan"></div>');
    mV.addEventListener('click', function (ev) {
      if (ev.target === mV || ev.target.closest('.mclose')) { plgDongModal('ccVtModal'); return; }
      var b = ev.target.closest('[data-vt]'); if (!b) return;
      var k = b.dataset.vt;
      if (k === 'quetTu') vtQuet('tu'); else if (k === 'quetDen') vtQuet('den');
      else if (k === 'bo') { VT.tu.splice(+b.dataset.i, 1); vtVe(); }
      else if (k === 'boDen') { VT.den = ''; vtVe(); }
      else if (k === 'lam') vtLam();
    });
    mV.addEventListener('keydown', function (ev) { var t = ev.target; if (ev.key !== 'Enter' || !t.dataset || !t.dataset.vtgo) return; ev.preventDefault(); vtThem(t.dataset.vtgo, t.value); });
    var mI = pop('ccInModal', 'In tem hiện trạng', '<div id="ccInThan"></div>');
    mI.addEventListener('click', function (ev) { if (ev.target === mI || ev.target.closest('.mclose')) plgDongModal('ccInModal'); });
    var ve = document.createElement('div'); ve.id = 'ccVe';
    ve.innerHTML = '<div class="vd"><button class="huy" type="button" aria-label="Huỷ">✕</button><b id="ccVeTd">Khoanh vùng hư</b><button class="xong" type="button">Xong</button></div>' +
      '<div class="khung"><canvas id="ccVeCv"></canvas></div>' +
      '<div class="cong"><button type="button" data-cu="o" class="on"><i>◯</i>Khoanh</button><button type="button" data-cu="p"><i>✎</i>Bút</button><button type="button" data-cu="u"><i>↶</i>Hoàn tác</button></div>' +
      '<div class="vung" id="ccVeVung"></div>';
    document.body.appendChild(ve);
    veGanSuKien();
    window.addEventListener('beforeunload', function (ev) { if (CC.ds.some(function (x) { return x._dang; })) { ev.preventDefault(); ev.returnValue = ''; } });
    document.addEventListener('tk-doi', function () { veForm(); if (CT.ma) veCt(); });
  }

  /* ---------------- 4. Form ---------------- */
  function formMoi() { CC.f = { ma: '', sua: false, sku: '', maGo: '', cach: '', ten: '', loai: '', dv: '', status: '', tep: [], ghiChu: '', phanLoai: '', viTri: '', qrTs: '', sn: '', loi: '' }; }
  function veForm() {
    var el = $('ccForm'); if (!el) return; var f = CC.f, n = nguoi();
    /* Mẫu 1 (user duyệt 11/11): cụm trạng thái y Nhận diện SKU (ACTIVE / Normal xếp dọc) + SKU + tên ĐỦ (xuống dòng);
       QR tài sản · S/N là dòng nhỏ cuối thẻ. Chỉ có QR/S/N (chưa ra SKU) ⇒ thẻ viền thường chỉ có dòng đó. */
    var dd = (f.qrTs || f.sn) ? '<div class="cc-the-dd">' +
      (f.qrTs ? '<span>QR tài sản <b>' + e_(f.qrTs) + '</b><button type="button" class="x" data-lam="boTs" aria-label="Bỏ QR tài sản">✕</button></span>' : '') +
      (f.sn ? '<span>S/N <b>' + e_(f.sn) + '</b><button type="button" class="x" data-lam="boSn" aria-label="Bỏ S/N">✕</button></span>' : '') + '</div>' : '';
    var loaiSp = String(f.loai || '').trim(); loaiSp = loaiSp ? loaiSp.charAt(0).toUpperCase() + loaiSp.slice(1).toLowerCase() : '';
    var kq = f.sku ? '<div class="cc-the"><div class="cc-the-dau">' +
        ((f.status || loaiSp) ? '<div class="nds-tags-col">' + (f.status ? '<span class="badge ' + (f.status === 'INACTIVE' ? 'b-pend' : 'b-ok') + '">' + e_(f.status) + '</span>' : '') +
          (loaiSp ? '<span class="nds-rank' + (/combo/i.test(loaiSp) ? ' cb' : '') + '">' + e_(loaiSp) + '</span>' : '') + '</div>' : '') +
        '<div class="cc-the-sp"><b>' + e_(f.sku) + '</b><span>' + e_(f.ten || 'Chưa có tên trong danh mục') + '</span></div>' +
        /* 11/11 user: chỉ cho in sau khi Gửi ⇒ form không còn nút In tem (in ở dòng «Đã ghi nhận» / trang chi tiết) */
        '<button type="button" class="x" data-lam="boSku" aria-label="Bỏ SKU">✕</button></div>' + dd + '</div>'
      : (dd ? '<div class="cc-the trong">' + dd + '</div>' : '');
    var tsDong = '';
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
      /* 11/11 tối user duyệt mẫu: BỎ ô «Gõ SKU / mã tài sản…» — nhập tay đã có trong pop-up «Quét mã / QR», gõ S/N · QR · phiếu IT · tên ở «Nhận diện SKU» */
      '<div class="cc-sku cc-sku2">' +
      '<button type="button" class="cc-nut" data-lam="quet">' + IC.quet + 'Quét mã / QR</button>' +
      '<button type="button" class="cc-nut vien" data-lam="nds">' + IC.ai + 'Nhận diện SKU</button></div>' + kq + tsDong +
      '<div class="cc-h3">2 · Ảnh / clip hiện trạng <i>*</i></div>' +
      '<div class="cc-hai"><button type="button" class="cc-to" data-lam="cam">' + IC.cam + 'Chụp / quay</button>' +
      '<input type="file" hidden id="ccCamTep" accept="image/*" capture="environment" data-tep="cam">' +
      '<label class="cc-to nhat" id="ccKeo" title="Hoặc kéo thả ảnh / clip vào đây">' + IC.tep + 'Chọn từ máy<input type="file" accept="image/*,video/*" multiple data-tep="tv"></label></div>' +
      (anh ? '<div class="cc-anhs">' + anh + '</div>' : '') +
      '<div class="cc-h3">3 · Ghi chú <i>*</i></div>' +
      '<textarea id="ccGhiChu" placeholder="Hiện trạng, chỗ hư…">' + e_(f.ghiChu) + '</textarea>' +
      '<div class="cc-h3">Phân loại <i>*</i></div>' +
      '<div class="cc-pl' + (/vị trí/i.test(f.loi || '') && !f.viTri ? ' thieu-vt' : '') + '">' + PL.map(function (p) { var on = f.phanLoai === p;
        return '<button type="button" data-pl="' + e_(p) + '" class="' + PL_LOP[p] + (on ? ' on' : '') + (on && f.viTri ? ' co-vt' : '') + '"><span class="pl-t">' + e_(nhanPL(p)) + '</span>' +
          '<span class="pl-qr" data-plqr="' + e_(p) + '" title="Quét mã vị trí">' + IC.qr + '</span></button>'; }).join('') + '</div>' +
      (f.viTri ? '<div class="cc-vt">Vị trí đặt <b>' + e_(f.viTri) + '</b><button type="button" class="x" data-lam="boVt" aria-label="Bỏ vị trí">✕</button></div>' : '') +
      (f.loi ? '<div class="cc-loi">' + e_(f.loi) + '</div>' : '') +
      '<div class="cc-gui">' + (n ? av(n.ten) + '<div class="ng">Người gửi <b>' + e_(n.ten) + '</b> · ' + e_(n.id) + '</div>' : '<div class="ng">Chưa đăng nhập</div>') +
      '<button type="button" class="cc-nut xanh" data-lam="gui">' + (n ? (f.sua ? 'Lưu' : (f.sku ? 'In, gửi' : 'Gửi')) : 'Đăng nhập để gửi') + '</button></div>';
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
      if (t.id === 'ccSku' && maTs(t.value)) { var v0 = t.value; t.value = ''; CC.f.maGo = ''; quetTs(v0); return; }
      if (t.id === 'ccSku') { var r = traSku(t.value), coTruoc = !!CC.f.sku; ganSku(r, 'Gõ tay', t.value.trim());
        if (!!r !== coTruoc || r) { var vt = t.selectionStart; veForm(); var o = $('ccSku'); if (o) { o.focus(); try { o.setSelectionRange(vt, vt); } catch (e) {} } }
        /* 11/11 tối: gõ mã KHÔNG phải SKU (QR tài sản số / S/N, vd 491012026353) ⇒ ngừng gõ 0,8 s thì tra tài sản WMS */
        clearTimeout(CC._tsT); var g0 = t.value.trim();
        if (!r && g0.length >= 6) CC._tsT = setTimeout(function () { var o2 = $('ccSku'); if (!o2 || o2.value.trim() !== g0 || CC.f.sku) return;
          traTs(g0, false).then(function (k) { var o3 = $('ccSku'); if (!k.ds.length || !o3 || o3.value.trim() !== g0) return; o3.value = ''; CC.f.maGo = ''; tsChon(g0, k.ds, k.laS); }); }, 800); }
      if (t.id === 'ccLocTim') { veLocNg(); return; }
      if (t.id === 'ccGhiChu') { CC.f.ghiChu = t.value; if (CC.f.loi) { CC.f.loi = ''; var l = v.querySelector('.cc-loi'); if (l) l.remove(); } }
    });
    v.addEventListener('change', function (ev) { var t = ev.target; if (t.dataset && t.dataset.tep) { themTep(t.files); t.value = ''; } });
    v.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-plqr],[data-quet],[data-lam],[data-pl],[data-bo],[data-anh],[data-locpl],[data-dong],[data-thu],[data-inma],[data-ct],[data-locng]');
      if (!b || !v.contains(b)) return;
      if (b.dataset.bo != null) { ev.stopPropagation(); ev.preventDefault(); var t = CC.f.tep.splice(+b.dataset.bo, 1)[0]; if (t && t.url) URL.revokeObjectURL(t.url); veForm(); return; }
      if (b.dataset.inma) { ev.stopPropagation(); var x = timMa(b.dataset.inma); if (x) moIn({ sku: x.sku, ten: x.ten, dv: x.dv, ma: x.ma, tt: x.phanLoai, viTri: x.viTri }); return; }
      if (b.dataset.thu) { ev.stopPropagation(); var y = timMa(b.dataset.thu); if (y) { y._loi = ''; dayLen(y); } return; }
      if (b.dataset.anh != null) { var tp = CC.f.tep[+b.dataset.anh]; if (!tp) return;
        if (tp.loai === 'video') { if (tp.url) window.open(tp.url, '_blank'); else if (tp.id) window.open('https://drive.google.com/file/d/' + tp.id + '/view', '_blank'); return; }
        if (!tp.blob) { window.open('https://drive.google.com/file/d/' + (tp.ve || tp.id) + '/view', '_blank'); return; }
        veMo(+b.dataset.anh); return; }
      if (b.dataset.locng != null) { CC.locNg = b.dataset.locng; CC.soHien = TRANG; if (!CC.dsMo) CC.dsMo = true; veDs(); veLocNg(); return; }
      if (b.dataset.plqr) { ev.stopPropagation(); CC.f.phanLoai = b.dataset.plqr; if (/phân loại/i.test(CC.f.loi || '')) CC.f.loi = ''; veForm(); moQuet('viTri'); return; }
      if (b.dataset.quet) { moQuet(b.dataset.quet); return; }
      if (b.dataset.ct) { if (b.tagName === 'A') ev.preventDefault(); ctLam(b.dataset.ct); return; }
      if (b.dataset.pl) { CC.f.phanLoai = CC.f.phanLoai === b.dataset.pl ? '' : b.dataset.pl; if (CC.f.phanLoai && /phân loại/i.test(CC.f.loi || '')) CC.f.loi = '';   /* chọn rồi thì bỏ lỗi «Cần chọn phân loại» */ veForm(); return; }
      if (b.dataset.locpl != null) { CC.loc = b.dataset.locpl; CC.soHien = TRANG; if (!CC.dsMo) dsMo(true); else veDs(); return; }
      if (b.dataset.dong) { moSua(b.dataset.dong); return; }
      var lam = b.dataset.lam;
      if (lam === 'boSku') { ganSku(null, '', ''); CC.f.cach = ''; veForm(); }
      else if (lam === 'boVt') { CC.f.viTri = ''; veForm(); }
      else if (lam === 'cam') camMo();
      else if (lam === 'dsMo') dsMo(!CC.dsMo);
      else if (lam === 'loc') { var lb = $('ccLocBody'), mo = lb.classList.contains('collapsed'); lb.classList.toggle('collapsed', !mo); b.classList.toggle('mo', mo); if (mo) { veLocNg(); var ti = $('ccLocTim'); if (ti && window.innerWidth > 640) ti.focus(); } }
      else if (lam === 'boTs') { CC.f.qrTs = ''; veForm(); }
      else if (lam === 'boSn') { CC.f.sn = ''; veForm(); }
      else if (lam === 'quet') moQuet();
      else if (lam === 'nds') ndsMo();
      else if (lam === 'gui') gui();
      else if (lam === 'huySua') { formMoi(); veForm(); veDs(); }
      else if (lam === 'xemThem') { CC.soHien += TRANG; veDs(); }
      else if (lam === 'vtMo') vtMo();
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

  /* ---------------- 4b. Pop-up camera trong trang ----------------
     11/11 tối user: «Chụp / quay» mở THƯ VIỆN chứ không mở camera — ô tệp accept="image/*,video/*" + capture
     thì nhiều máy Android hiện bảng chọn / thư viện. Nay mở camera bằng getUserMedia trong pop-up: chế độ Ảnh
     (chụp nhiều tấm liền) · Clip (MediaRecorder, tự dừng 60 s). Ảnh/clip đi thẳng vào themTep như chọn tệp.
     Không mở được camera (trình duyệt cũ / từ chối quyền) ⇒ dự phòng ô tệp accept MỘT loại + capture. */
  var CAM = { st: null, rec: null, che: 'anh', so: 0, t0: 0, dem: 0, manh: [] };
  function camVeChe() { var m = $('ccCamModal'); if (!m) return; m.classList.toggle('clip', CAM.che === 'clip'); m.classList.toggle('dang', !!CAM.rec);
    m.querySelectorAll('[data-cam="anh"],[data-cam="clip"]').forEach(function (b) { b.classList.toggle('on', b.dataset.cam === CAM.che); });
    var so = $('ccCamSo'); if (so) so.innerHTML = CAM.rec ? '<span class="cam-gio" id="ccCamGio">● 0:00</span>' : (CAM.so ? 'Đã chụp ' + CAM.so : ''); }
  function camDuPhong() { var i = $('ccCamTep'); if (!i) return; i.accept = CAM.che === 'clip' ? 'video/*' : 'image/*'; i.click(); }
  async function camMo() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.isSecureContext) { camDuPhong(); return; }
    CAM.so = 0; camVeChe(); plgMoModal('ccCamModal');
    try {
      CAM.st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      if (getComputedStyle($('ccCamModal')).display === 'none') { camTat(); return; }   // đóng trước khi camera kịp mở
      var v = $('ccCamV'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');   // 12/11 iPhone: thuộc tính JS trước srcObject
      v.srcObject = CAM.st; try { await v.play(); } catch (e) { }
    } catch (e) { camTat(); plgDongModal('ccCamModal'); bao('Không mở được camera trong trang — dùng camera của máy', 'warn'); camDuPhong(); }
  }
  function camTat() { if (CAM.st) CAM.st.getTracks().forEach(function (t) { t.stop(); }); CAM.st = null; var v = $('ccCamV'); if (v) v.srcObject = null; }
  function camDong() { if (CAM.rec) { CAM.dongSau = true; CAM.rec.stop(); return; } camTat(); plgDongModal('ccCamModal'); }
  function camChup() {
    var v = $('ccCamV'); if (!CAM.st || !v || !v.videoWidth) return;
    if (CAM.che === 'anh') {
      var c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
      c.toBlob(function (b) { if (!b) return; themTep([new File([b], 'chup-' + Date.now() + '.jpg', { type: 'image/jpeg' })]); CAM.so++; camVeChe(); }, 'image/jpeg', 0.9);
      v.style.opacity = '.3'; setTimeout(function () { v.style.opacity = ''; }, 120); return;
    }
    if (CAM.rec) { CAM.rec.stop(); return; }
    if (typeof MediaRecorder === 'undefined') { bao('Máy không hỗ trợ quay trong trang — dùng camera của máy', 'warn'); camDong(); camDuPhong(); return; }
    var kieu = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].filter(function (k) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(k); })[0] || '';
    var bat = function (st) {
      CAM.manh = []; CAM.rec = new MediaRecorder(st, kieu ? { mimeType: kieu, videoBitsPerSecond: 2500000 } : { videoBitsPerSecond: 2500000 });
      CAM.rec.ondataavailable = function (e) { if (e.data && e.data.size) CAM.manh.push(e.data); };
      CAM.rec.onstop = function () {
        clearInterval(CAM.dem); var t = (CAM.rec && CAM.rec.mimeType) || kieu || 'video/webm'; CAM.rec = null;
        if (CAM.amThanh) { CAM.amThanh.getTracks().forEach(function (x) { x.stop(); }); CAM.amThanh = null; }
        var b = new Blob(CAM.manh, { type: t.split(';')[0] }); CAM.manh = [];
        if (b.size) { themTep([new File([b], 'clip-' + Date.now() + (/mp4/.test(t) ? '.mp4' : '.webm'), { type: b.type })]); CAM.so++; }
        camVeChe(); if (CAM.dongSau) { CAM.dongSau = false; camDong(); }
      };
      CAM.rec.start(1000); CAM.t0 = Date.now(); camVeChe();
      CAM.dem = setInterval(function () { var g = Math.floor((Date.now() - CAM.t0) / 1000), el = $('ccCamGio'); if (el) el.textContent = '● ' + Math.floor(g / 60) + ':' + String(g % 60).padStart(2, '0'); if (g >= 60 && CAM.rec) CAM.rec.stop(); }, 500);
    };
    /* tiếng: xin mic lúc bấm quay (không xin ngay khi mở — chụp ảnh không cần); từ chối thì quay không tiếng */
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (a) { CAM.amThanh = a; bat(new MediaStream(CAM.st.getVideoTracks().concat(a.getAudioTracks()))); })
      .catch(function () { bat(CAM.st); });
  }

  /* ---------------- 5. Quét mã + Nhận diện SKU (dùng lại bộ sẵn có) ---------------- */
  var QUET_TEN = { viTri: 'Quét mã vị trí', qrTs: 'Quét QR tài sản', sn: 'Quét S/N' };
  /* QR TÀI SẢN → SKU (user 11/11 chiều: «quét mã qr tài sản để truy ra được sku — tương tự quét mã sku»).
     Sổ khai tài sản kho 170 (Sheet công khai, tab gid 602603419): D Mã vị trí · E Mã SKU · G Mã tài sản (nội dung
     QR = {"key":"qr_mapping","code":"0-811d76"}, có dòng mất ngoặc ⇒ bóc code bằng regex) · H Serial · M Tên thiết bị.
     Tải /export CSV (gviz chỉ trả 2 dòng) MỘT lần, đệm localStorage 6 giờ. Một mã trỏ nhiều SKU (≈39 mã) ⇒ cho chọn. */
  var TS_URL = 'https://docs.google.com/spreadsheets/d/1dUFvmLMkhSt_jRCBdxsEU0NCeCLWbca-zrm60l7I3cY/export?format=csv&gid=602603419';
  var K_TS = 'ccdc-so-ts-v1', TS = null, TSN = null, TS_CHON = null;
  function maTs(v) { v = String(v || ''); var m = /"code"\s*:\s*"([^"]+)"/.exec(v); if (m) return m[1].trim();
    /* 11/11: mã tài sản THÔ (gõ tay / tem in chữ) «0-8148a2» — phiên 67 bắt: trước chỉ nhận JSON qr_mapping */
    m = /^\s*(0-[0-9a-f]{5,8})\s*$/i.exec(v); return m ? m[1].toLowerCase() : ''; }
  function docCsv(t) {
    var R = [], r = [], c = '', q = false;
    for (var i = 0; i < t.length; i++) { var ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { r.push(c); c = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; r.push(c); R.push(r); r = []; c = ''; }
      else c += ch; }
    if (c || r.length) { r.push(c); R.push(r); }
    return R;
  }
  function napSoTs(ep) {
    if (TS && !ep) return Promise.resolve(TS);
    if (!ep && !TS) { try { var c = JSON.parse(localStorage.getItem(K_TS) || 'null'); if (c && c.m && Date.now() - c.at < 6 * 3600e3) { TS = c.m; return Promise.resolve(TS); } } catch (e) { } }
    if (TSN) return TSN;
    TSN = fetch(TS_URL).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(function (t) {
      var m = {}; docCsv(t).slice(1).forEach(function (r) { var k = maTs(r[6]); if (!k) return;
        var d = { sku: String(r[4] || '').trim(), vt: String(r[3] || '').trim(), sn: String(r[7] || '').trim(), ten: String(r[12] || '').trim() };
        var ds = m[k] = m[k] || []; if (!ds.some(function (x) { return x.sku === d.sku && x.sn === d.sn && x.vt === d.vt; })) ds.push(d); });
      TS = m; try { localStorage.setItem(K_TS, JSON.stringify({ at: Date.now(), m: m })); } catch (e) { }
      return m;
    }).finally(function () { TSN = null; });
    return TSN;
  }
  /* TÀI SẢN WMS (11/11 user: «0-8148a2 ở WMS có mà audit-dc báo không có»): tab TAI-SAN-WMS của sheet factory (công khai đọc),
     sync-tai-san-wms.mjs kéo WMS › Asset management (kho 170 QL1A + 130 Ấp Chánh, ~4,9k dòng, 3 giờ/lượt). Hỏi gviz ĐÚNG mã
     (1 dòng, ~0,5 s) thay vì tải cả tab 700 KB. So cả cột QR lẫn S/N: WMS có dòng nhập QR vào ô Serial (cột QR = «.»). */
  var TSW_URL = 'https://docs.google.com/spreadsheets/d/1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs/gviz/tq?tqx=out:csv&sheet=TAI-SAN-WMS&tq=';
  function traWms(kw) {
    kw = String(kw || '').replace(/'/g, '').trim(); if (!kw || kw.length > 80) return Promise.resolve([]);
    var q = "select A,B,C,D,E where A = '" + kw + "' or D = '" + kw + "'";
    return fetch(TSW_URL + encodeURIComponent(q) + '&t=' + Date.now()).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (t) { return docCsv(t).slice(1).filter(function (r) { return r[1]; })
        .map(function (r) { return { qr: r[0] === '.' ? '' : r[0], sku: String(r[1]).trim(), ten: r[2] || '', sn: r[3] || '', vt: r[4] || '' }; }); });
  }
  /* d = 1 dòng tài sản; laQr = mã quét là QR tài sản (JSON qr_mapping / cột QR), ngược lại khớp theo S/N */
  function tsGan(code, d, laS) {   // điền như quét mã SKU + QR tài sản + S/N
    var f = CC.f;
    if (laS) { f.sn = code; if (d && d.qr) f.qrTs = d.qr; } else { f.qrTs = code; if (d && d.sn && d.sn !== code && !f.sn) f.sn = d.sn; }
    if (d) { var r = d.sku ? (traSku(d.sku) || { sku: d.sku, pn: d.ten }) : null;
      if (r && !r.pn && d.ten) r = Object.assign({}, r, { pn: d.ten });   // luôn có tên hiện sau khi truy ra SKU
      if (r) ganSku(r, 'Quét mã', d.sku); }
    veForm();
    var nhan = laS ? 'S/N ' : 'QR tài sản ';
    bao(d && d.sku ? nhan + code + ' → SKU ' + d.sku + (d.ten ? ' · ' + d.ten : '') : nhan + code + ' chưa có trong WMS / sổ khai tài sản', d && d.sku ? 'ok' : 'warn');
  }
  function tsChon(code, ds, laS) {
    var gom = []; ds.forEach(function (x) { if (!gom.some(function (y) { return y.sku === x.sku && y.sn === x.sn; })) gom.push(x); });
    if (gom.length <= 1) { tsGan(code, gom[0] || null, laS); return; }
    TS_CHON = { code: code, ds: gom, laS: laS };
    $('ccTsThan').innerHTML = '<div class="ts-ds">' + gom.map(function (x, i) { var r = traSku(x.sku);
      return '<button type="button" data-tsi="' + i + '"><b>' + e_(x.sku) + '</b> · ' + e_((r && r.pn) || x.ten || '') +
        '<small>' + [x.vt, x.sn && 'S/N ' + x.sn].filter(Boolean).map(e_).join(' · ') + '</small></button>'; }).join('') + '</div>';
    plgMoModal('ccTsModal');
  }
  /* Tra 1 mã: WMS trước (nguồn thật, mới nhất), không có thì sổ khai kho 170 (chỉ khi là QR qr_mapping). */
  function traTs(code, laQr) {
    return Promise.all([traWms(code).catch(function () { return null; }), laQr ? napSoTs().catch(function () { return null; }) : null]).then(function (k) {
      var w = k[0] || [], so = laQr && k[1] ? (k[1][code] || []).filter(function (x) { return x.sku; }) : [];
      var laS = !laQr && w.length && w.every(function (x) { return x.qr !== code; });
      return { ds: w.length ? w : so, laS: !!laS, loi: k[0] == null };
    });
  }
  /* trả true = đã xử lý như QR tài sản (chuỗi JSON qr_mapping) */
  function quetTs(chuoi) {
    var code = maTs(chuoi); if (!code) return false;
    bao('Đang tra QR tài sản ' + code + '…', 'info');
    traTs(code, true).then(function (k) { tsChon(code, k.ds, false); })
      .catch(function (e) { CC.f.qrTs = code; veForm(); bao('Chưa tra được QR tài sản: ' + e.message, 'warn'); });
    return true;
  }
  function moQuet(truong) {
    if (typeof qtcQuetMo !== 'function' || typeof QTC === 'undefined') { bao('Chưa có bộ quét mã', 'err'); return; }
    var td = document.querySelector('#qtcqrmodal .mt'), tdCu = td ? td.textContent : '';
    var tra = function () { if (td) td.textContent = tdCu; };
    if (truong && QUET_TEN[truong]) {
      if (td) td.textContent = QUET_TEN[truong];
      QTC.dich = function (ma) { tra(); if (truong !== 'viTri' && quetTs(ma)) return;
        CC.f[truong] = String(ma || '').trim().slice(0, 120); if (truong === 'viTri' && /vị trí/i.test(CC.f.loi || '')) CC.f.loi = ''; veForm(); bao(QUET_TEN[truong].replace('Quét ', 'Đã quét ') + ': ' + CC.f[truong], 'ok'); };
    } else QTC.dich = function (ma) { tra(); if (quetTs(ma)) return;   // ① QR tài sản → SKU + QR tài sản + S/N
      /* bộ quét trả (nguyên chuỗi, mã đã bóc cụm số) — SKU: thử nguyên chuỗi trước, không ra thì thử mã đã bóc (QR kèm chữ/URL) */
      var tach = arguments[1], r = traSku(ma) || (tach && tach !== ma ? traSku(tach) : null);
      if (r) { ganSku(r, 'Quét mã', r.sku); veForm(); bao('Đã quét: ' + r.sku + (r.pn ? ' · ' + r.pn : ''), 'ok'); return; }   // ② mã SKU
      /* ③ không phải JSON QR, không phải SKU ⇒ tra WMS theo QR (mã trơn «0-8148a2») hoặc S/N; không thấy ⇒ ghi là S/N */
      var m0 = String(ma || '').trim().slice(0, 120);
      traTs(m0, false).then(function (k) {
        if (k.ds.length) { tsChon(m0, k.ds, k.laS); return; }
        CC.f.sn = m0; veForm(); bao('Đã quét S/N: ' + m0 + ' (chưa có trong tài sản WMS)', 'ok');
      }); };
    qtcQuetMo();
    /* đóng bộ quét không quét gì ⇒ trả lại tiêu đề cũ */
    var m = $('qtcqrmodal'); if (m && td) { var canh = setInterval(function () { if (!QTC.dich) { tra(); clearInterval(canh); } }, 500); setTimeout(function () { clearInterval(canh); }, 600000); }
  }
  /* ---------------- 5b. Chuyển vị trí hàng loạt (12/11) ---------------- */
  var VT = { tu: [], den: '', dang: false };
  function vtChuan(v) { return String(v || '').trim().slice(0, 60); }
  function vtDem(ma) { var k = ma.toUpperCase(); return CC.ds.filter(function (x) { return String(x.viTri || '').trim().toUpperCase() === k; }).length; }
  function vtMo() { VT = { tu: [], den: '', dang: false }; vtVe(); plgMoModal('ccVtModal'); }
  function vtThem(o, v) {
    v = vtChuan(v); if (!v) return;
    if (o === 'den') VT.den = v;
    else if (!VT.tu.some(function (x) { return x.toUpperCase() === v.toUpperCase(); })) VT.tu.push(v);
    vtVe(); var i = document.querySelector('#ccVtThan [data-vtgo="' + o + '"]'); if (i) i.focus();
  }
  function vtQuet(o) {
    if (typeof qtcQuetMo !== 'function' || typeof QTC === 'undefined') { bao('Chưa có bộ quét mã', 'err'); return; }
    var td = document.querySelector('#qtcqrmodal .mt'), tdCu = td ? td.textContent : '';
    if (td) td.textContent = o === 'den' ? 'Quét mã vị trí đích' : 'Quét mã vị trí nguồn' + (VT.tu.length ? ' (đã có ' + VT.tu.length + ')' : '');
    QTC.dich = function (ma) { if (td) td.textContent = tdCu; vtThem(o, ma); bao((o === 'den' ? 'Vị trí đích: ' : 'Đã thêm nguồn: ') + vtChuan(ma), 'ok');
      if (o === 'tu') setTimeout(function () { if (getComputedStyle($('ccVtModal')).display !== 'none') vtQuet('tu'); }, 700); };   // nguồn: quét liên tục tới khi đóng ✕
    qtcQuetMo();
    var canh = setInterval(function () { if (!QTC.dich) { if (td) td.textContent = tdCu; clearInterval(canh); } }, 500); setTimeout(function () { clearInterval(canh); }, 600000);
  }
  function vtVe() {
    var el = $('ccVtThan'); if (!el) return;
    var tong = 0, chip = VT.tu.map(function (m, i) { var n = vtDem(m); tong += n;
      return '<span class="vt-chip"><b>' + e_(m) + '</b><small>' + n + ' phiếu</small><button type="button" data-vt="bo" data-i="' + i + '" aria-label="Bỏ">✕</button></span>'; }).join('');
    var trungDen = VT.den && VT.tu.some(function (m) { return m.toUpperCase() === VT.den.toUpperCase(); });
    el.innerHTML =
      '<div class="vt-muc"><div class="vt-nhan">Từ mã vị trí / mã giỏ <small>quét liên tục nhiều mã, ✕ để dừng</small></div>' +
        '<div class="vt-hang"><input data-vtgo="tu" type="text" autocomplete="off" enterkeyhint="done" placeholder="Gõ mã rồi Enter"><button type="button" class="cc-nut" data-vt="quetTu">' + IC.qr + 'Quét</button></div>' +
        '<div class="vt-chips">' + (chip || '<span class="vt-trong">Chưa có mã nguồn</span>') + '</div></div>' +
      '<div class="vt-muc"><div class="vt-nhan">Về mã vị trí</div>' +
        (VT.den ? '<div class="vt-chips"><span class="vt-chip den"><b>' + e_(VT.den) + '</b><button type="button" data-vt="boDen" aria-label="Bỏ">✕</button></span></div>'
          : '<div class="vt-hang"><input data-vtgo="den" type="text" autocomplete="off" enterkeyhint="done" placeholder="Gõ mã rồi Enter"><button type="button" class="cc-nut" data-vt="quetDen">' + IC.qr + 'Quét</button></div>') + '</div>' +
      '<div class="vt-chan"><button type="button" class="cc-nut xanh" data-vt="lam"' + (!VT.tu.length || !VT.den || !tong || trungDen || VT.dang ? ' disabled' : '') + '>' +
        (VT.dang ? 'Đang chuyển…' : 'Chuyển ' + tong + ' phiếu' + (VT.den ? ' → ' + e_(VT.den) : '')) + '</button></div>';
  }
  function vtLam() {
    if (VT.dang || !VT.tu.length || !VT.den) return;
    VT.dang = true; vtVe();
    goiGas({ action: 'ccdc_vitri', tu: VT.tu, den: VT.den }, 60000).then(function (j) {
      (j.doi || []).forEach(function (d) { var x = timMa(d.ma); if (x) { x.viTri = j.den; x.lichSu = d.lichSu; x.capNhat = j.capNhat; } });
      luuDs(); veDs(); plgDongModal('ccVtModal');
      bao('Đã chuyển ' + (j.doi || []).length + ' phiếu về ' + j.den, 'ok');
    }).catch(function (e) { bao('Chưa chuyển được: ' + e.message, 'err'); }).finally(function () { VT.dang = false; vtVe(); });
  }
  var NDS_CHO = null;
  function ndsMo() {
    var v = $('viewNds'), cho = $('ccNdsCho'); if (!v || !cho) return;
    if (!NDS_CHO) { NDS_CHO = { cha: v.parentNode, sau: v.nextSibling, an: v.hidden }; cho.appendChild(v); }   // mở lần 2 khi đang mở: không ghi đè chỗ cũ
    v.hidden = false;
    if (typeof NDS !== 'undefined' && !NDS.loadedOnce && typeof ndsLoad === 'function') { NDS.loadedOnce = true; ndsLoad(); }
    plgMoModal('ccNdsModal');
  }
  /* 11/11 user: chọn SKU gợi ý trong pop-up ⇒ hiện ở mục 1 dưới hàng «Gõ SKU / mã tài sản…». Móc CỐ ĐỊNH (không gán/gỡ
     theo lượt mở) — chỉ nhận khi pop-up đang chứa #viewNds; ở tab Nhận diện SKU thường thì trả false (copy mã như cũ). */
  window.ccdcNhanSku = function (sku, r) {
    if (!NDS_CHO) return false;
    var dm = traSku(sku); r = dm || r || { sku: sku, pn: '' };
    if (!r.pn && dm && dm.pn) r = Object.assign({}, r, { pn: dm.pn });
    ganSku(r, 'Nhận diện SKU', String(sku)); ndsDong(); veForm(); bao('Đã chọn SKU ' + sku + (r.pn ? ' · ' + r.pn : ''), 'ok');
    var k = document.querySelector('#viewCcdc .cc-kq'); if (k && k.scrollIntoView) k.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  };
  function ndsDong() {
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
    if (!f.phanLoai) { f.loi = 'Cần chọn phân loại.'; veForm(); return; }   // 11/11 user: Phân loại bắt buộc
    if (!String(f.viTri || '').trim()) { f.loi = 'Cần mã vị trí — bấm biểu tượng QR trên nút phân loại để quét / nhập.'; veForm(); return; }   // 11/11 tối user: bắt buộc mã vị trí mới cho gửi/in
    var inLuon = !f.sua && !!f.sku;                                          // 11/11 user: nút «In, gửi» = gửi + in 1 tem
    var cu = f.sua ? timMa(f.ma) : null, now = Date.now();
    var it = { ma: f.ma || maMoi(), luc: cu ? cu.luc : now, capNhat: now, nguoi: cu ? cu.nguoi : n.ten, tk: cu ? cu.tk : n.id,
      sku: f.sku, maGo: f.maGo, cach: f.sku || f.maGo ? (f.cach || 'Gõ tay') : '', ten: f.ten, loai: f.loai, dv: f.dv, phanLoai: f.phanLoai,
      ghiChu: String(f.ghiChu).trim(), tep: f.tep, vung: vungCua(f.tep), viTri: f.viTri || '', qrTs: f.qrTs || '', sn: f.sn || '', soTem: cu ? cu.soTem : 0, lichSu: cu ? cu.lichSu : '', _cho: true, _dang: false, _loi: '', _vua: true };
    CC.ds = CC.ds.filter(function (x) { x._vua = false; return x.ma !== it.ma; }); CC.ds.unshift(it);
    bao((f.sua ? 'Đã lưu · ' : (inLuon ? 'Đã gửi + in 1 tem · ' : 'Đã gửi · ')) + (it.sku || it.maGo || it.ma), 'ok');
    formMoi(); veForm(); veDs(); luuDs();
    dayLen(it);
    if (inLuon) napQr().then(function () { return qrHex(LINK_CT + it.ma); }, function () { return ''; }).then(function (qr) {
      return goiGas({ action: 'ccdc_in', sku: it.sku, ten: it.ten, sl: '', dv: it.dv, ngay: PR_TEM.ngayTem(new Date()), soTem: 1, ma: it.ma, tt: it.phanLoai, qr: qr, qrTs: it.qrTs || '', sn: it.sn || '', viTri: it.viTri || '' }, 45000);   // 11/11: Sheet IN-TEM ghi QR tài sản / S/N (phiếu có thể chưa lưu xong)
    }).catch(function (e) { bao('Chưa gửi được lệnh in ' + it.sku + ': ' + e.message + ' — bấm In ở dòng Đã ghi nhận', 'err'); });
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
      var kq = await goiGas({ action: 'ccdc_ghi', ghi: { ma: it.ma, sku: it.sku, maGo: it.maGo, cach: it.cach, ten: it.ten, loai: it.loai, dv: it.dv, phanLoai: it.phanLoai, ghiChu: it.ghiChu, vung: it.vung, tep: tep, viTri: it.viTri || '', qrTs: it.qrTs || '', sn: it.sn || '' } }, 60000);
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
  function dsMo(mo) { CC.dsMo = mo; try { localStorage.setItem('ccdc-ds-mo', mo ? '1' : '0'); } catch (e) { } veDs(); }
  function veLocNg() {   // chip người ghi nhận (đếm theo danh sách đang có) — lọc ngay khi gõ
    var el = $('ccLocNg'); if (!el) return; var tim = String(($('ccLocTim') || {}).value || '').trim().toLowerCase(), dem = {};
    CC.ds.forEach(function (x) { if (x.nguoi) dem[x.nguoi] = (dem[x.nguoi] || 0) + 1; });
    var ds = Object.keys(dem).sort(function (a, b) { return dem[b] - dem[a]; })
      .filter(function (n) { return !tim || n.toLowerCase().indexOf(tim) >= 0 || CC.ds.some(function (x) { return x.nguoi === n && String(x.tk || '').toLowerCase().indexOf(tim) >= 0; }); });
    el.innerHTML = '<button type="button" class="tat' + (!CC.locNg ? ' on' : '') + '" data-locng="">Tất cả</button>' +
      ds.map(function (n) { return '<button type="button" data-locng="' + e_(n) + '" class="' + (CC.locNg === n ? 'on' : '') + '">' + av(n, true) + e_(haiChuCuoi(n)) + ' <small>' + dem[n] + '</small></button>'; }).join('');
  }
  function veDs() {
    var el = $('ccDs'); if (!el) return;
    var k = $('ccDsKhoi'); if (k) { k.classList.toggle('mo', CC.dsMo); var mb = k.querySelector('.ds-mo'); if (mb) mb.setAttribute('aria-expanded', CC.dsMo ? 'true' : 'false'); }
    el.hidden = !CC.dsMo;
    var bl = $('ccBtnLoc'); if (bl) bl.classList.toggle('dang-loc', !!CC.locNg);
    var ds = CC.ds.filter(function (x) { return (!CC.loc || (CC.loc === '_' ? !x.phanLoai : x.phanLoai === CC.loc)) && (!CC.locNg || x.nguoi === CC.locNg); });
    /* đóng mà còn lượt đang lưu / lỗi ⇒ báo ngay cạnh tiêu đề (không bắt mở mới biết) */
    var soCho = CC.ds.filter(function (x) { return x._cho && !x._loi; }).length, soLoi = CC.ds.filter(function (x) { return x._loi; }).length;
    $('ccDem').className = soLoi ? 'loi' : (soCho ? 'cho' : '');
    $('ccDem').textContent = (CC.ds.length ? '(' + (typeof nf === 'function' ? nf(CC.ds.length) : CC.ds.length) + ')' : '') +
      (soLoi ? ' · ' + soLoi + ' chưa lưu' : (soCho ? ' · đang lưu ' + soCho : ''));
    $('ccLoc').innerHTML = [['', 'Tất cả']].concat(PL.map(function (p) { return [p, nhanPL(p)]; })).concat([['_', 'Chưa phân loại']]).map(function (c) {
      return '<button type="button" class="kktab' + (CC.loc === c[0] ? ' active' : '') + '" data-locpl="' + e_(c[0]) + '">' + e_(c[1]) + '</button>'; }).join('');
    if ($('ccLocBody') && !$('ccLocBody').classList.contains('collapsed')) veLocNg();
    if (!CC.dsMo) { el.innerHTML = ''; return; }
    if (!ds.length) { el.innerHTML = '<div class="cc-trong">' + (CC.dangNap && !CC.ds.length ? 'Đang tải…' : (CC.ds.length ? 'Không có mục nào ở bộ lọc này.' : 'Chưa có ghi nhận nào.')) + '</div>'; return; }
    el.innerHTML = ds.slice(0, CC.soHien).map(function (x) {
      var t0 = x.tep[0] || {}, na = x.tep.filter(function (t) { return t.loai !== 'video'; }).length, nc = x.tep.length - na, nv = (x.vung || []).length;
      var tt = x._loi ? '<div class="cc-tt loi">' + e_(x._loi) + ' · <button type="button" data-thu="' + e_(x.ma) + '">thử lại</button></div>'
        : (x._cho ? '<div class="cc-tt"><span class="cc-vong"></span>Đang lưu' + (x._tien ? ' ' + e_(x._tien) : '') + '…</div>' : '');
      return '<div class="cc-dong' + (x._vua ? ' vua' : '') + '" data-dong="' + e_(x.ma) + '"><div class="cc-tb">' + (thumb(t0) ? '<img loading="lazy" src="' + e_(thumb(t0)) + '" alt="">' : '') + '</div><div class="cc-nd">' +
        '<div class="cc-t1"><span>' + e_([x.sku, x.ten || (!x.sku ? x.maGo : '')].filter(Boolean).join(' · ') || 'Không có SKU') + '</span>' + (x.phanLoai ? '<span class="cc-kqc ' + PL_LOP[x.phanLoai] + '">' + e_(x.phanLoai) + '</span>' : '') + '</div>' +
        '<div class="cc-t2">' + e_(x.ghiChu) + '</div>' +
        '<div class="cc-t3">' + av(x.nguoi, true) + '<span>' + e_(haiChuCuoi(x.nguoi)) + ' · ' + gio(x.luc) + ' · ' + [na && na + ' ảnh', nc && nc + ' clip', nv && nv + ' vùng hư'].filter(Boolean).join(' · ') + '</span>' +
        (x.sku && !x._cho && !x._loi ? '<button type="button" class="in" data-inma="' + e_(x.ma) + '">' + IC.inn.replace('<svg', '<svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.7"') + 'In tem</button>' : '') + '</div>' + tt + '</div></div>';
    }).join('') + (ds.length > CC.soHien ? '<button type="button" class="kktab cc-them" data-lam="xemThem">Xem thêm</button>' : '');
  }
  function moSua(ma) {
    var x = timMa(ma); if (!x) return;
    if (x._dang) { bao('Mục này đang lưu — chờ xong rồi sửa', 'warn'); return; }
    CC.f = { ma: x.ma, sua: true, sku: x.sku, maGo: x.maGo || x.sku, cach: x.cach, ten: x.ten, loai: x.loai, dv: x.dv, status: '', ghiChu: x.ghiChu, phanLoai: x.phanLoai, viTri: x.viTri || '', qrTs: x.qrTs || '', sn: x.sn || '', loi: '',
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

  /* ---------------- 9. In tem — TEM HIỆN TRẠNG 40×60 (PR_TEM loai 'cc', Mẫu 2 user chốt 11/11) ---------------- */
  var IN = null;
  function moIn(o) {
    if (!o.sku) return;
    var homNay = new Date(), n = nguoi();
    IN = { sku: o.sku, ten: o.ten || '', dv: o.dv || '', ma: o.ma || '', tt: o.tt || '', viTri: o.viTri || '', ngay: homNay, soTem: 1, qr: '' };
    $('ccInThan').innerHTML = '<div class="tem" id="ccInTem"></div><div class="luoi">' +
      '<div><label class="n">Hiện trạng</label><div class="tt">' + (IN.tt ? '<span class="cc-kqc ' + PL_LOP[IN.tt] + '">' + e_(IN.tt) + '</span>' : '<span style="color:var(--ink3);font-weight:400">Chưa phân loại</span>') + '</div></div>' +
      '<div><label class="n">Ngày in</label><div id="ccInNgay"></div></div>' +
      '<div><label class="n">Người in</label><div class="ng">' + (n ? av(n.ten, true) + e_(haiChuCuoi(n.ten)) : 'Chưa đăng nhập') + '</div></div>' +
      '<div><label class="n">Số tem</label><div class="bac"><button type="button" class="cc-nut" data-st="-1">−</button><input class="o" id="ccInSo" inputmode="numeric" value="1"><button type="button" class="cc-nut" data-st="1">+</button></div></div></div>' +
      '<label class="n" style="margin-top:12px">Máy in</label><div class="may">' + IC.inn.replace('<svg', '<svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7"') + 'Máy in tem laptop</div>' +
      '<div class="day"><button type="button" class="cc-nut xanh" id="ccInGo">In tem</button></div>';
    var nr = $('ccInNgay');
    if (typeof taoBoLocNgay === 'function') {
      var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      var bl = taoBoLocNgay({ root: nr, motNgay: true, khongRong: true, presets: [{ k: 'today', lb: 'Hôm nay' }], macDinh: function () { var x = iso(new Date()); return [x, x]; },
        onApply: function (tu) { if (tu) { var p = tu.split('-'); IN.ngay = new Date(+p[0], +p[1] - 1, +p[2]); veTem(); } } });
      bl.dat(iso(homNay), iso(homNay));
    } else nr.innerHTML = '<div class="ng">' + homNay.toLocaleDateString('vi-VN') + '</div>';
    veTem(); plgMoModal('ccInModal');
    if (IN.ma) { var ma = IN.ma; napQr().then(function () { if (IN && IN.ma === ma) { IN.qr = qrHex(LINK_CT + ma); veTem(); } }).catch(function (e) { bao(e.message, 'warn'); }); }
  }
  function temD() { var n = nguoi();
    return { loai: 'cc', sku: IN.sku, pn: IN.ten, tt: IN.tt, qr: IN.qr, ngay: PR_TEM.ngayTem(IN.ngay), nguoi: n ? haiChuCuoi(n.ten) : '', sl: '', uid: '', vitri: IN.viTri || '', dv: '' }; }   // Mẫu 5: dải vị trí
  function veTem() {
    var el = $('ccInTem'); if (!el || !IN) return;
    try { el.innerHTML = PR_TEM.mau(PR_TEM.MAU_MAC_DINH).ve(temD()); }
    catch (e) { el.textContent = IN.sku; }
  }
  document.addEventListener('input', function (ev) {
    if (!IN) return; var t = ev.target;
    if (t.id === 'ccInSo') { IN.soTem = Math.max(1, Math.min(50, parseInt(t.value, 10) || 1)); }
  });
  document.addEventListener('click', function (ev) {
    var m = $('ccInModal'); if (!m || !m.contains(ev.target) || !IN) return;
    var b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.st) { IN.soTem = Math.max(1, Math.min(50, IN.soTem + (+b.dataset.st))); $('ccInSo').value = IN.soTem; return; }
    if (b.id === 'ccInGo') {
      if (!nguoi()) { if (typeof tkMoDangNhap === 'function') tkMoDangNhap(); return; }
      if (IN.ma && !IN.qr) { bao('Đang dựng mã QR — bấm lại sau giây lát', 'warn'); return; }
      var lenh = { action: 'ccdc_in', sku: IN.sku, ten: IN.ten, sl: '', dv: IN.dv, ngay: PR_TEM.ngayTem(IN.ngay), soTem: IN.soTem, ma: IN.ma, tt: IN.tt, qr: IN.qr, viTri: IN.viTri };
      plgDongModal('ccInModal'); bao('Đã gửi ' + IN.soTem + ' tem ' + IN.sku + ' tới máy in', 'ok');
      goiGas(lenh, 45000).then(function (j) { if (j.inLoi) bao('Máy in chưa nhận lệnh ' + lenh.sku + ': ' + j.inLoi, 'err'); })
        .catch(function (e) { bao('Chưa gửi được lệnh in ' + lenh.sku + ': ' + e.message, 'err'); });
    }
  });

  /* ---------------- 9b. Trang chi tiết — mở khi quét QR trên tem (?cc=<mã>), Mẫu 2 «Dải trạng thái» ---------------- */
  var CT = { ma: '' };
  function ctMo(ma) { CT.ma = String(ma || ''); veCt(); }
  function ctDong(imLang) {
    CT.ma = ''; window.CCDC_XEM = '';
    try { var u = new URL(location.href); if (u.searchParams.has('cc')) { u.searchParams.delete('cc'); history.replaceState(history.state, '', u); } } catch (e) { }
    if (!imLang) veCt();
  }
  function ctLam(k) {
    if (k === 'lui') { ctDong(); window.scrollTo(0, 0); return; }
    if (/^anh:\d+$/.test(k)) { var xa = timMa(CT.ma) || CT.x; if (xa) xemAnh(xa, +k.slice(4)); return; }
    if (k === 'dn') { var ma = CT.ma; if (typeof tkMoDangNhap === 'function') tkMoDangNhap(function () { window.CCDC_XEM = ma;
      setTimeout(function () { var it = document.querySelector('#sideNav .s-item[data-tab="ccdc"]'); if (it) it.click(); else if (typeof showTab === 'function') showTab('ccdc'); }, 60); }); return; }
    var x = timMa(CT.ma) || CT.x; if (!x) return;
    if (k === 'sua') { CC.ds.indexOf(x) < 0 && CC.ds.unshift(x); ctDong(); moSua(x.ma); return; }
    if (k === 'in') moIn({ sku: x.sku, ten: x.ten, dv: x.dv, ma: x.ma, tt: x.phanLoai, viTri: x.viTri });
  }
  var XA = null;
  function xemAnh(x, i) { XA = { tep: x.tep || [], i: 0 }; veXemAnh(i); plgMoModal('ccAnhModal'); }
  function dongXemAnh() { var k = $('ccAnhKhung'); if (k) k.innerHTML = ''; XA = null; plgDongModal('ccAnhModal'); }   // gỡ iframe/video ⇒ clip dừng phát
  function veXemAnh(i) {
    if (!XA || !XA.tep.length) return; var n = XA.tep.length; XA.i = (i % n + n) % n;
    var t = XA.tep[XA.i], id = t.veId || t.id, vid = t.loai === 'video', k = $('ccAnhKhung'); if (!k) return;
    k.innerHTML = vid ? (t.url ? '<video src="' + e_(t.url) + '" controls autoplay playsinline></video>'
        : '<iframe src="https://drive.google.com/file/d/' + encodeURIComponent(id) + '/preview" allow="autoplay; fullscreen" allowfullscreen></iframe>')
      : '<img src="' + e_(t.url || 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w1600') + '" alt="">';
    var so = $('ccAnhSo'); if (so) so.textContent = (XA.i + 1) + ' / ' + n;
    var d = document.querySelector('#ccAnhModal .xa-dieu'); if (d) d.style.display = n > 1 ? '' : 'none';
  }
  function ctAnh(t) { var id = t.veId || t.id; return t.url || (id ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w600' : ''); }
  function htmlCt(x) {
    var lop = PL_LOP[x.phanLoai] || 'trong', na = 0, nc = 0;
    var anh = (x.tep || []).map(function (t, i) {
      var vid = t.loai === 'video', nhan = vid ? 'Clip ' + (++nc) : 'Ảnh ' + (++na), id = t.veId || t.id;
      var nv = vid ? 0 : (x.vung || []).filter(function (v) { return v.anh === na; }).length;
      var mo = t.url || (id ? 'https://drive.google.com/file/d/' + id + '/view' : '');
      /* 11/11 user: bấm ảnh/clip ⇒ pop-up xem ngay trong trang (data-ct="anh:i"), KHÔNG trỏ sang Drive (href chỉ là dự phòng) */
      return '<a class="cc-anh" href="' + e_(mo) + '" data-ct="anh:' + i + '" rel="noopener"><img loading="lazy" src="' + e_(ctAnh(t)) + '" alt="">' +
        (vid ? '<span class="play"><i><svg viewBox="0 0 10 10" width="10" height="10"><path d="M2.5 1.5v7l6-3.5z" fill="#fff"/></svg></i></span>' : '') +
        '<span class="so">' + nhan + (nv ? ' · ' + nv + ' vùng' : '') + '</span></a>';
    }).join('');
    var nhieuAnh = (x.tep || []).filter(function (t) { return t.loai !== 'video'; }).length > 1;
    var vung = (x.vung || []).map(function (v) { return '<div class="vg"><i>' + v.so + '</i>' + (nhieuAnh ? 'Ảnh ' + v.anh + ' · ' : '') + e_(v.nd || '') + '</div>'; }).join('');
    var kv = [['Mã vị trí', x.viTri], ['QR tài sản', x.qrTs], ['S/N', x.sn]].filter(function (k) { return k[1]; })
      .map(function (k) { return '<div><span>' + k[0] + '</span><b>' + e_(k[1]) + '</b></div>'; }).join('');
    var dang = x._loi ? '<div class="cc-tt loi">' + e_(x._loi) + '</div>' : (x._cho ? '<div class="cc-tt"><span class="cc-vong"></span>Đang lưu…</div>' : '');
    var dn = !!nguoi();   // người lạ (quét QR, chưa đăng nhập): chỉ xem — không Quay lại / In / Sửa
    return '<div class="ct-dau">' + (dn ? '<button type="button" class="lui" data-ct="lui">← Đã ghi nhận</button>' : '') + '<span class="gian"></span>' +
      (dn && x.sku ? '<button type="button" class="cc-nut vien" data-ct="in">' + IC.inn + 'In tem</button>' : '') +
      (dn && !x._dang ? '<button type="button" class="cc-nut" data-ct="sua">Sửa</button>' : '') + '</div>' +
      '<div class="panel"><div class="dai ' + lop + '"><span class="vach"></span><div><div class="nh">PHÂN LOẠI</div><div class="lon">' + e_(x.phanLoai || 'Chưa phân loại') + '</div></div>' +
      '<div class="sp"><b>' + e_(x.sku || x.maGo || 'Không có SKU') + '</b><span>' + e_(x.ten || '') + '</span></div></div>' +
      '<div class="than">' +
      '<div class="muc"><h4>3 · Ghi chú</h4><div class="gc">' + e_(x.ghiChu || '') + '</div></div>' +
      '<div class="muc"><h4>2 · Ảnh / clip</h4><div><div class="anhs">' + anh + '</div>' + (vung ? '<div style="margin-top:8px">' + vung + '</div>' : '') + '</div></div>' +
      (kv ? '<div class="muc"><h4>Định danh</h4><div class="kv">' + kv + '</div></div>' : '') +
      '<div class="muc"><h4>Ghi nhận</h4><div><div class="ng">' + av(x.nguoi || '') + '<span><b>' + e_(x.nguoi || '') + '</b> · ' + gio(x.luc) + ' · <span class="cc-mono" style="font-weight:400">' + e_(x.ma) + '</span></span></div>' +
        dang + (x.lichSu ? '<div class="ls">' + e_(x.lichSu) + '</div>' : '') + '</div></div>' +
      '</div></div>';
  }
  async function veCt() {
    var v = $('viewCcdc'); if (!v) return; var g = v.querySelector('.cc-grid'), el = $('ccCt');
    if (!CT.ma) { if (el) el.hidden = true; if (g) g.hidden = false; return; }
    if (!el) { el = document.createElement('div'); el.id = 'ccCt'; v.appendChild(el); }
    if (g) g.hidden = true; el.hidden = false; window.scrollTo(0, 0);
    var ma = CT.ma, x = timMa(ma), dau = nguoi() ? '<div class="ct-dau"><button type="button" class="lui" data-ct="lui">← Đã ghi nhận</button></div>' : '';
    /* 11/11 user: xem qua QR KHÔNG cần đăng nhập (máy chủ chỉ mở ccdc_xem đúng mã, bỏ tk/lịch sử sửa) */
    el.innerHTML = x ? htmlCt(x) : dau + '<div class="panel"><div class="trong">Đang tải phiếu <b class="cc-mono">' + e_(ma) + '</b>…</div></div>';
    if (x && x._cho) return;
    try {
      var j = await goiGas({ action: 'ccdc_xem', ma: ma }, 45000); if (CT.ma !== ma) return;
      var cu = timMa(ma); if (cu && !cu._cho) Object.assign(cu, j.x); CT.x = cu || j.x;
      var moi = htmlCt(CT.x); if (el.innerHTML !== moi) el.innerHTML = moi;
    } catch (e) { if (CT.ma !== ma || x) return;
      el.innerHTML = (nguoi() ? '<div class="ct-dau"><button type="button" class="lui" data-ct="lui">← Đã ghi nhận</button></div>' : '') + '<div class="panel"><div class="trong">' +
        (e.code === 404 ? 'Không thấy phiếu <b class="cc-mono">' + e_(ma) + '</b>' : 'Chưa tải được phiếu — ' + e_(e.message)) + '</div></div>'; }
  }

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
    if (window.CCDC_XEM) ctMo(window.CCDC_XEM); else if (CT.ma) veCt();
    if (!TS && !CC._tsNap) { CC._tsNap = 1; setTimeout(function () { napSoTs().catch(function () { CC._tsNap = 0; }); }, 1500); }
  };
  window.ccdcSo = function () { return CC.ds.length ? CC.ds.length : null; };
  window.ccdcRoiTab = function () { if (NDS_CHO) ndsDong(); if (CT.ma) ctDong(true); };
})();
