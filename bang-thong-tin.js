/* bang-thong-tin.js — TAB «BẢNG THÔNG TIN» (Công cụ kho · 24/10/2026)
 * User: «muốn tự chỉnh sửa chữ bên trong / kích thước tổng (A3/A4 hoặc D100cm×R56cm) nhưng vẫn giữ form, làm cách nào để chủ động».
 * 8 bản PDF gốc (thư mục Drive biển báo kho) đều xuất từ Illustrator, chữ đã thành nét vẽ, không còn lớp ⇒ không sửa thẳng được.
 * Ở đây dựng lại thành MẪU để người dùng tự gõ chữ, chọn khổ, xuất PDF:
 *  · biển vẽ bằng HTML, mọi kích thước tính theo --u = cạnh ngắn ÷ 100 ⇒ đổi khổ thì cả biển co giãn cùng tỉ lệ; khổ khác tỉ lệ
 *    (100×56 so với A3) thì nền + khung trắng giãn theo khổ, chữ + biểu tượng giữ tỉ lệ — giữ form, không kéo méo;
 *  · chữ tự thu cho vừa khung (--co, tìm nhị phân) khi gõ dài; nút − / + chỉnh TRẦN cỡ chữ;
 *  · xuất PDF qua hộp in của trình duyệt, @page đúng khổ ⇒ chữ là chữ thật, in khổ lớn không vỡ nét;
 *  · logo / biểu tượng TÁCH TỪ PDF GỐC (bang-thong-tin-hinh.js), phông Be Vietnam Pro (Google Fonts) gần chữ gốc.
 * Không chạm WMS / work / GAS: 0 lượt gọi upstream. Bản nháp nhớ trên máy (localStorage btt-v1); ảnh quá hạn mức thì bỏ khỏi bản nhớ.
 * Cú pháp ô nội dung (mục nội quy): «# tiêu đề nhỏ» · «- gạch đầu dòng» · «> ô ghi chú» · «! cảnh báo» · «[chip] [chip]» · dòng trống = cách đoạn. */
(function () {
  'use strict';
  if (window.BTT) return;
  var H = window.BTT_HINH || {};
  var XANH = '#306F51', CAM = '#F2663A';
  var THIET_KE = 1000;   // cạnh ngắn của bản dựng để đo (px) — xem trước thu nhỏ bằng transform nên cỡ chữ đo được không bị làm tròn
  var KHOA = 'btt-v1';

  /* Khổ: mm. «tu» = tự nhập (cm trên giao diện, lưu mm) */
  var KHO = [
    { k: 'a4d', ten: 'A4 dọc', w: 210, h: 297 }, { k: 'a4n', ten: 'A4 ngang', w: 297, h: 210 },
    { k: 'a3d', ten: 'A3 dọc', w: 297, h: 420 }, { k: 'a3n', ten: 'A3 ngang', w: 420, h: 297 },
    { k: 'a2d', ten: 'A2 dọc', w: 420, h: 594 }, { k: 'a2n', ten: 'A2 ngang', w: 594, h: 420 },
    { k: '60x60', ten: '60 × 60 cm', w: 600, h: 600 }, { k: '75x30', ten: '75 × 30 cm', w: 750, h: 300 },
    { k: '100x56', ten: '100 × 56 cm', w: 1000, h: 560 }, { k: 'tu', ten: 'Tự nhập kích thước' }
  ];

  /* MẪU GỐC — chữ chép đúng từ 8 bản PDF (7 mẫu: «nội quy xe nâng» A4 và 60×60 là cùng một nội dung, chỉ khác khổ).
     kieu: bien (logo + khung trắng) · ten (biển tên phòng) · noiquy (tiêu đề + các mục) · anh (nội quy có cột ảnh).
     coTd / coDong = cỡ chữ gốc theo đơn vị --u (đo trên PDF); chữ chỉ thu nhỏ hơn khi không vừa. */
  var MAU = [
    { id: 'cam-hut', ten: 'Cấm hút thuốc', kieu: 'bien', kho: 'a3n', coGoc: 0.97, logo: 1, hinh: 'camHut', td: 'CẤM HÚT THUỐC', mauTd: 'xanh', coTd: 12,
      gach: 0, dong: '', mauDong: 'cam', coDong: 8, vien: 'NGỪNG HỢP TÁC NẾU PHÁT HIỆN' },
    { id: 'chu-y', ten: 'Chú ý quan sát', kieu: 'bien', kho: 'a3n', logo: 1, hinh: '', td: 'CHÚ Ý QUAN SÁT', mauTd: 'cam', coTd: 11,
      gach: 1, dong: 'KHU VỰC XE NÂNG\nDI CHUYỂN, NÂNG HẠ\nHÀNG HÓA', mauDong: 'cam', coDong: 8, vien: '' },
    { id: 'tat-dien', ten: 'Tắt thiết bị điện', kieu: 'bien', kho: 'a3n', logo: 1, hinh: '', td: 'TẮT', mauTd: 'cam', coTd: 16,
      gach: 0, dong: 'CÁC THIẾT BỊ ĐIỆN\nKHI KHÔNG SỬ DỤNG', mauDong: 'cam', coDong: 9, vien: '' },
    { id: 'phong-an', ten: 'Biển tên phòng', kieu: 'ten', kho: '75x30', td: 'PHÒNG ĂN', coTd: 30 },
    { id: 'noi-quy-pa', ten: 'Nội quy phòng ăn', kieu: 'noiquy', kho: '60x60', td: 'NỘI QUY PHÒNG ĂN', dauLogo: 0, kieuMuc: 'trai', chan: 1,
      muc: [
        { ten: 'I. QUY ĐỊNH CHUNG', nd: '- Giữ vệ sinh, không xả rác bừa bãi\n- Sử dụng đèn chiếu sáng và quạt khi cần thiết\n- Tắt các thiết bị điện sau khi dùng.\n- Lau khô bàn và ghế ăn sau khi sử dụng.\n- Rác sinh hoạt phải được đem bỏ ngay vào thùng rác ở Cổng nhập hàng' },
        { ten: 'II. HÀNH VI BỊ CẤM', nd: '- Cấm hút thuốc hoặc sử dụng các chất kích thích.\n- Cấm để thức ăn và đồ uống còn thừa, ly nhựa, hộp cơm,... ở phòng ăn.\n- Cấm gây ồn ào, la hét hoặc nói chuyện lớn tiếng.\n- Cấm ngồi lên bàn ăn hoặc đặt chân lên ghế.\n- Không tự ý di chuyển bàn ghế hoặc dụng cụ trong phòng ăn.' },
        { ten: 'III. HẬU QUẢ VI PHẠM', nd: '- Ghi nhận trừ KPI đối với mỗi lượt vi phạm' }
      ] },
    { id: 'xe-nang', ten: 'Nội quy xe nâng', kieu: 'anh', kho: 'a4d', td: 'NỘI QUY', chan: 1,
      dan: 'Khi dùng xe nâng người lên,\nthao tác ở kệ cao tầng hoặc các vị trí cao\nở phạm vi kho.',
      cot: [{ nhan: 'BẮT BUỘC\nMANG DÂY ĐAI', anh: '' }, { nhan: 'BẮT BUỘC\nĐỘI TRƯỚC\nMŨ BẢO HIỂM', anh: '' }] },
    /* coGoc: biển này dày chữ — bản gốc in chữ thân bằng ~0,66 cỡ của nội quy phòng ăn ⇒ mốc 100 % của nó là 0,66 (không thì mở ra đã báo «tự thu 66 %») */
    { id: 'ra-vao', ten: 'Kiểm soát ra vào kho', kieu: 'noiquy', kho: 'a3d', coGoc: 0.66, td: 'KIỂM SOÁT RA VÀO KHO TỔNG', dauLogo: 1, kieuMuc: 'giua', chan: 0,
      muc: [
        { ten: 'NHÂN VIÊN HASAKI', nd: '# 1. VÀO KHO ĐẦU CA\n- Nhân viên đọc mã số nhân viên cho Bảo vệ và chụp lại ảnh toàn thân.\n- Ba-lô, túi, áo khoác bắt buộc gửi vào tủ khóa.\n> Không được mang vào kho trừ khi có xác nhận từ Quản lý kho\n\n# 2. RA VỀ CUỐI CA\n- Bảo vệ xét người và chụp ảnh toàn thân trước khi cho ra.\n- Nếu mang theo vật dụng cá nhân, cần kiểm tra kỹ và đối chiếu danh mục đã gửi.\n\n# 3. QUY ĐỊNH NGHỈ VÀ RA NGOÀI TRONG CA\nNgoại trừ:\n- Nghỉ trưa: 12h00 – 13h00\n- Nghỉ chiều: 16h00 – 17h00 hoặc 17h00 – 18h00 (tùy ca)\nNhân viên chỉ được phép ra ngoài tại 3 mốc thời gian nghỉ bổ sung (mỗi lượt 10 phút):\n[Mốc 1: 09h00 – 09h10] [Mốc 2: 15h00 – 15h10] [Mốc 3: 20h00 – 20h10]\n! Ngoài các khung giờ trên, nhân viên không được phép ra khỏi kho nếu không có xác nhận từ Quản lý kho.\n> Bảo vệ phải xác minh với Quản lý, tuyệt đối không tự ý cho nhân viên ra ngoài.' },
        { ten: 'CÁ NHÂN KHÔNG PHẢI NHÂN VIÊN HASAKI', nd: '# 1. KHI VÀO KHO\n- Xác minh mục đích vào kho hoặc người liên hệ công việc.\n- Chụp ảnh căn cước công dân (CCCD).\n- Ghi chú thông tin, nhập đầy đủ vào phần mềm HASAKI WORK:\n[Họ và tên] [Thông tin công ty (nếu có)] [Người liên hệ Hasaki] [Mục đích làm việc]\n\n- Bắt buộc\n[Gửi ba-lô, túi, áo khoác vào tủ khóa] [Mặc áo phản quang khi vào kho] [Nếu mang theo vật tư, thiết bị, công cụ, Bảo vệ phải liên hệ Quản lý để xác minh trước khi cho vào] [Chỉ được đi đúng cổng vào/ra đã quy định để đảm bảo kiểm soát]\n- Chỉ được đi đúng cổng vào/ra đã quy định để đảm bảo kiểm soát.\n\n# 2. KHI RA VỀ\n- Trả lại áo phản quang.\n- Kiểm tra kỹ vật tư, công cụ mang ra (nếu có).\n> Nếu có dấu hiệu bất thường, Bảo vệ lập tức báo cáo Quản lý kho để xử lý' },
        { ten: 'LƯU Ý CHUNG', nd: '- Không phận sự – không vào kho.\n- Tuyệt đối không hướng dẫn hoặc cho phép cá nhân không phải nhân viên Hasaki sử dụng khu vực nhà vệ sinh nội bộ bên trong kho.\n- Tất cả cá nhân ra/vào kho tổng đều phải tuân thủ đúng quy trình.\n> Không có trường hợp ngoại lệ\n- Nếu phát hiện cá nhân không tuân thủ, Bảo vệ phải báo ngay cho Quản lý kho để xử lý kịp thời.' }
      ] },
    /* 25/10 user «thêm form bảng tam giác 3 góc và bảng tam giác 2 mặt (tên là khu vực khai báo — đã có sẵn ở Drive)» — 2 PDF thư mục
       «2025-05-14» / «Bảng thông báo»: (1) bảng treo tam giác 3 mặt 75 × 30 cm, 8 trang = 8 khu (nền xanh, chữ trắng đậm, có khi kèm nhãn cam);
       (2) «khu vực khai báo» gấp đôi đứng (A2/A3 dọc): nửa trên in NGƯỢC 180° để gấp thành bảng 2 mặt, giữa 2 logo. */
    { id: 'tam-giac', ten: 'Bảng treo tam giác 3 mặt', kieu: 'tamgiac', kho: '75x30', coTd: 22, giong: 1, xemMat: 0,
      mat: [{ td: 'KHU VỰC BÀN GIAO\nĐƠN VỊ VẬN CHUYỂN', nhan: '' }, { td: 'KHU VỰC BÀN GIAO\nĐƠN VỊ VẬN CHUYỂN', nhan: '' }, { td: 'KHU VỰC BÀN GIAO\nĐƠN VỊ VẬN CHUYỂN', nhan: '' }] },
    { id: 'khai-bao', ten: 'Khu vực khai báo (gấp 2 mặt)', kieu: 'gap2', kho: 'a3d', logo: 1, dong1: 'KHU VỰC', dong2: 'KHAI BÁO', mauChu: 'cam', co1: 12, co2: 17 }
  ];
  /* chữ 8 khu của bảng tam giác gốc — «Điền nhanh» */
  var GOI_Y_TG = [['KHU VỰC BÀN GIAO\nĐƠN VỊ VẬN CHUYỂN', ''], ['KHU VỰC\nHÀNG HOÀN', ''], ['KHU VỰC\nĐÓNG HÀNG', ''], ['KHU VỰC\nĐƠN HÀNG CHỜ CHIA', 'PO API'],
    ['KHU VỰC KIỂM, NHẬP\nHÀNG LUÂN CHUYỂN NỘI BỘ', 'RE IT'], ['KHU VỰC\nCHỜ ĐỔI TRẢ\nNGÀNH HÀNG', ''], ['KHU VỰC ĐỒNG KIỂM', 'PO'], ['KHU TRỮ\nGIẤY CARTON\nĐÃ RỌC', '']];
  var CHAN_GOC = { hotline: '1800.6324', web: 'hasaki.vn' };

  /* ---------- trạng thái + bản nhớ ---------- */
  var S = { chon: MAU[0].id, ban: {}, co: 1, dangVe: false };
  window.BTT = S;
  var chep = function (o) { return JSON.parse(JSON.stringify(o)); };
  var mauGoc = function (id) { return MAU.filter(function (m) { return m.id === id; })[0] || MAU[0]; };
  function banCua(id) {
    if (!S.ban[id]) { var g = chep(mauGoc(id)); g.tran = 1; g.hotline = CHAN_GOC.hotline; g.web = CHAN_GOC.web; S.ban[id] = g; }
    return S.ban[id];
  }
  try { var c0 = JSON.parse(localStorage.getItem(KHOA) || 'null'); if (c0 && c0.ban) { S.ban = c0.ban; if (c0.chon && mauGoc(c0.chon).id === c0.chon) S.chon = c0.chon; } } catch (e) { }
  var _hLuu = 0;
  function luuHen() {
    clearTimeout(_hLuu);
    _hLuu = setTimeout(function () {
      var goi = { chon: S.chon, ban: S.ban };
      try { localStorage.setItem(KHOA, JSON.stringify(goi)); }
      catch (e) {   // quá hạn mức (ảnh) → nhớ phần chữ, bỏ ảnh
        try { var g2 = chep(goi); Object.keys(g2.ban).forEach(function (k) { (g2.ban[k].cot || []).forEach(function (c) { c.anh = ''; }); });
          localStorage.setItem(KHOA, JSON.stringify(g2)); bao('Ảnh không lưu được trên máy (quá dung lượng) — chữ vẫn được nhớ.'); } catch (e2) { }
      }
    }, 400);
  }

  /* ---------- tiện ích ---------- */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var $ = function (id) { return document.getElementById(id); };
  function bao(m) { var o = $('bttTT'); if (o) o.textContent = m || ''; }
  function khoCua(d) {
    if (d.kho === 'tu') return { k: 'tu', ten: 'Tự nhập', w: Math.max(50, Math.min(5000, +d.w || 420)), h: Math.max(50, Math.min(5000, +d.h || 297)) };
    return KHO.filter(function (k) { return k.k === d.kho; })[0] || KHO[3];
  }
  var cm = function (mm) { return String(Math.round(mm) / 10).replace('.', ','); };
  var mauMa = function (m) { return m === 'xanh' ? XANH : CAM; };
  /* 24/10 user «logo có thể thu nhỏ lại kích thước được»: cỡ logo riêng từng mẫu, 40–150 % cỡ gốc (cả logo đầu biển lẫn chân trang) */
  var coLogo = function (d) { return Math.max(0.4, Math.min(1.5, +d.lg || 1)); };
  var coLogoHtml = function (d) {
    return o('Cỡ logo', '<div class="btt-co" role="group" aria-label="Cỡ logo">' +
      '<button type="button" class="kktab btt-nho" data-act="logo" data-i="-1" title="Thu nhỏ logo">−</button>' +
      '<span class="btt-coso" id="bttLgSo">' + Math.round(coLogo(d) * 100) + '%</span>' +
      '<button type="button" class="kktab btt-nho" data-act="logo" data-i="1" title="Phóng to logo">+</button></div>', 'gon');
  };
  function svgCua(k, cls) {
    var h = H[k]; if (!h) return '';
    return '<svg class="' + (cls || '') + '" viewBox="0 0 ' + h.w + ' ' + h.h + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + h.svg + '</svg>';
  }

  /* ---------- CSS của BIỂN (dùng chung cho xem trước và bản in) — màu cố định theo biển gốc, không theo theme ---------- */
  var CSS_BIEN = [
    '.bttb{position:relative;overflow:hidden;background:' + XANH + ';color:#fff;font-family:"Be Vietnam Pro",system-ui,sans-serif;line-height:1.2;display:flex;flex-direction:column;',
    '  --t:calc(var(--u) * var(--co,1));-webkit-print-color-adjust:exact;print-color-adjust:exact;text-align:left;letter-spacing:0;font-style:normal}',
    '.bttb *{box-sizing:border-box;margin:0;padding:0}',
    '.bttb svg{display:block}',
    '.bttb .nl{white-space:pre-line}',
    '.bttb-fit{overflow:hidden;min-height:0;display:flex;flex-direction:column}',
    '.bttb-trong{margin:auto 0;display:flex;flex-direction:column;align-items:center;width:100%}',
    /* biển: logo trên + khung trắng */
    '.bttb-bien{padding:calc(var(--u)*7.4) calc(var(--u)*5.7) calc(var(--u)*7.8)}',
    '.bttb-bien.khong-logo{padding-top:calc(var(--u)*5.7)}',
    '.bttb-bien>.bttb-logo{flex:none;height:calc(var(--u)*15*var(--lg,1));margin-bottom:calc(var(--u)*7.4*var(--lg,1));color:#fff}',
    '.bttb-bien>.bttb-logo svg{height:100%;width:auto;margin:0 auto}',
    '.bttb-pn{flex:1;background:#fff;border-radius:calc(var(--u)*2.6);padding:calc(var(--u)*3) calc(var(--u)*4);text-align:center}',
    '.bttb-pn .bttb-trong{gap:calc(var(--t)*3.4)}',
    '.bttb-hinh svg{height:calc(var(--t)*25.7);width:auto;margin-bottom:calc(var(--t)*1.6)}',
    '.bttb-td{font-weight:800;line-height:1.12}',
    '.bttb-gach{width:46%;height:max(1px,calc(var(--u)*.22));background:' + CAM + ';margin:calc(var(--t)*.4) 0}',
    '.bttb-dong{font-weight:800;line-height:1.3}',
    '.bttb-vien{background:' + XANH + ';color:#fff;font-weight:700;font-size:calc(var(--t)*5.6);line-height:1.2;border-radius:999px;padding:calc(var(--t)*1.9) calc(var(--t)*5)}',
    /* biển tên phòng: viền trắng trong + chữ lớn */
    '.bttb-ten{padding:calc(var(--u)*11)}',
    '.bttb-ten::before{content:"";position:absolute;inset:calc(var(--u)*8);border:calc(var(--u)*1) solid #fff;pointer-events:none}',
    '.bttb-ten>.bttb-fit{flex:1;width:100%}',
    '.bttb-ten .bttb-td{color:#fff;text-align:center;letter-spacing:.03em}',
    /* nội quy: tiêu đề + các mục + chân trang */
    '.bttb-nq,.bttb-anh{padding:calc(var(--u)*4.2) calc(var(--u)*4.4) calc(var(--u)*3.2)}',
    '.bttb-dau{flex:none;display:flex;align-items:center;justify-content:center;gap:calc(var(--t)*3);margin-bottom:calc(var(--t)*2.6);text-align:center}',
    '.bttb-dau .bttb-td{color:#fff;font-size:calc(var(--t)*5.4)}',
    '.bttb-dau .bttb-logo{flex:none;color:#fff}',
    '.bttb-dau .bttb-logo svg{height:calc(var(--t)*6*var(--lg,1));width:auto}',
    '.bttb-dau .gach,.bttb-chan .gach{flex:none;width:max(1px,calc(var(--u)*.15));align-self:stretch;background:#fff;opacity:.85}',
    '.bttb-than{flex:1}',
    '.bttb-than>.bttb-trong{align-items:stretch;gap:calc(var(--t)*2.6)}',
    '.bttb-muc{display:flex;flex-direction:column}',
    '.bttb-mt{position:relative;z-index:1;align-self:flex-start;background:' + CAM + ';color:#fff;font-weight:800;font-size:calc(var(--t)*2.6);line-height:1.2;',
    '  padding:calc(var(--t)*.85) calc(var(--t)*3) calc(var(--t)*.85) calc(var(--t)*1.8);border-radius:calc(var(--t)*.6) calc(var(--t)*3) calc(var(--t)*3) calc(var(--t)*.6);margin-bottom:calc(var(--t)*-1.7)}',
    '.bttb-nq.giua .bttb-mt{align-self:center;text-align:center;border-radius:999px;padding:calc(var(--t)*.7) calc(var(--t)*4);font-size:calc(var(--t)*2.9)}',
    '.bttb-the{background:#fff;color:' + XANH + ';border-radius:calc(var(--t)*1.8);padding:calc(var(--t)*3.3) calc(var(--t)*2.8) calc(var(--t)*2.4);font-weight:600;font-size:calc(var(--t)*2.15);line-height:1.4;display:flex;flex-direction:column}',
    '.bttb-the>*+*{margin-top:.5em}',
    '.bttb-the>.h{color:' + CAM + ';font-weight:800;font-size:1.15em}',
    '.bttb-the>*+.h{margin-top:1em}',
    '.bttb-the>.li{display:flex;gap:.45em}',
    '.bttb-the>.li::before{content:"\\2022";flex:none}',
    '.bttb-the>.gc{align-self:flex-start;background:#B7DEC3;border-radius:.45em;padding:.3em .8em}',
    '.bttb-the>.cb{display:flex;gap:.4em}',
    '.bttb-the>.cb::before{content:"\\26A0";color:#E0362B;flex:none}',
    '.bttb-the>.chips{display:flex;flex-wrap:wrap;gap:.45em}',
    '.bttb-the>.chips span{background:' + XANH + ';color:#fff;border-radius:.35em;padding:.2em .65em;font-weight:500}',
    '.bttb-the>.trong{height:0}',
    '.bttb-chan{flex:none;display:flex;align-items:center;justify-content:center;gap:calc(var(--t)*2.2);margin-top:calc(var(--t)*2.6);font-weight:800;font-size:calc(var(--t)*2.5);color:#fff;white-space:nowrap}',
    '.bttb-chan .lg{color:#fff}',
    '.bttb-chan .lg svg{height:calc(var(--t)*4.4*var(--lg,1));width:auto}',
    '.bttb-chan .gach{align-self:auto;height:calc(var(--t)*4.4)}',
    '.bttb-chan .mt{display:flex;align-items:center;gap:.35em;color:#fff}',
    '.bttb-chan .mt svg{height:1.3em;width:1.3em}',
    /* nội quy có cột ảnh */
    '.bttb-anh .bttb-than>.bttb-the{flex:1;min-height:0;overflow:hidden}',
    '.bttb-dan{text-align:center;font-weight:700;font-size:calc(var(--t)*2.6);line-height:1.35;margin-bottom:calc(var(--t)*2.6)}',
    '.bttb-cots{flex:1;min-height:0;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:calc(var(--t)*2.6)}',
    '.bttb-cot{display:flex;flex-direction:column;background:' + CAM + ';border-radius:calc(var(--t)*1.6);overflow:hidden;min-height:0}',
    '.bttb-cot .nhan{flex:none;color:#fff;font-weight:800;text-align:center;font-size:calc(var(--t)*2.7);line-height:1.25;padding:calc(var(--t)*2.2) calc(var(--t)*1.4);min-height:calc(var(--nd,2) * 1.25em + var(--t)*4.4);display:flex;align-items:center;justify-content:center;white-space:pre-line}',
    '.bttb-cot .khung{flex:1;min-height:calc(var(--u)*14);background:' + XANH + ';position:relative}',
    '.bttb-cot .khung img,.bttb-cot .khung .rong{position:absolute;left:0;right:0;top:calc(var(--t)*1.3);bottom:calc(var(--t)*1.3);width:100%;height:calc(100% - var(--t)*2.6);object-fit:cover}',
    '.bttb-cot .khung .rong{background:#DCEFE3;color:' + XANH + ';display:flex;align-items:center;justify-content:center;font-weight:600;font-size:calc(var(--t)*2)}',
    '.bttb-cot .day{flex:none;height:calc(var(--t)*1.6)}',
    /* bảng treo tam giác 3 mặt: 1 mặt = 1 trang; chữ trắng đậm giữa, nhãn cam bo tròn (PO API · RE IT · PO) */
    '.bttb-tg{padding:calc(var(--u)*6) calc(var(--u)*5);align-items:center}',
    '.bttb-tg>.bttb-fit{flex:1;width:100%}',
    '.bttb-tg .bttb-trong{gap:calc(var(--t)*1.6)}',
    '.bttb-tg .bttb-td{color:#fff;text-align:center;line-height:1.18;letter-spacing:.01em;white-space:pre;max-width:100%}',
    '.bttb-nhan{background:' + CAM + ';color:#fff;font-weight:800;line-height:1.15;border-radius:999px;font-size:calc(var(--t)*11);padding:.12em 1.5em;text-align:center;white-space:nowrap;max-width:100%}',
    /* khu vực khai báo gấp 2 mặt: 2 khung trắng (khung trên lật 180°) + 2 logo giữa */
    '.bttb-g2{padding:calc(var(--u)*3.7) calc(var(--u)*3)}',
    '.bttb-g2>.bttb-pn{padding:calc(var(--u)*3) calc(var(--u)*4)}',
    '.bttb-g2 .bttb-trong{gap:calc(var(--t)*2.4)}',
    '.bttb-g2 .lat{transform:rotate(180deg)}',
    '.bttb-g2 .d1{font-weight:500;line-height:1.1;text-align:center}',
    '.bttb-g2 .d2{font-weight:800;line-height:1.1;text-align:center}',
    '.g2-giua{flex:none;height:calc(var(--u)*41);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(var(--u)*10);color:#fff}',
    '.g2-giua .lg{display:block;color:#fff;height:calc(var(--u)*10.6*var(--lg,1))}',
    '.g2-giua .lg svg{height:100%;width:auto}'
  ].join('\n');

  /* ---------- dựng HTML biển ---------- */
  function noiDung(nd) {   // cú pháp ô nội dung → khối HTML
    return String(nd || '').split('\n').map(function (dong) {
      var s = dong.replace(/\s+$/, '');
      if (!s.trim()) return '<div class="trong"></div>';
      var m = s.match(/^\s*([#\-•>!])\s?(.*)$/);
      if (/^\s*\[[^\]]+\]/.test(s)) {
        var cs = []; s.replace(/\[([^\]]+)\]/g, function (_, x) { cs.push('<span>' + esc(x.trim()) + '</span>'); return ''; });
        return '<div class="chips">' + cs.join('') + '</div>';
      }
      if (!m) return '<div class="p">' + esc(s.trim()) + '</div>';
      var cls = { '#': 'h', '-': 'li', '•': 'li', '>': 'gc', '!': 'cb' }[m[1]];
      return '<div class="' + cls + '">' + esc(m[2].trim()) + '</div>';
    }).join('');
  }
  function chanHtml(d) {
    return '<div class="bttb-chan"><span class="lg">' + svgCua('logo') + '</span><span class="gach"></span>' +
      (d.hotline ? '<span class="mt">' + svgCua('dienThoai') + esc(d.hotline) + '</span>' : '') +
      (d.web ? '<span class="mt">' + svgCua('web') + esc(d.web) + '</span>' : '') + '</div>';
  }
  /* bảng tam giác: «giong» = 3 mặt cùng chữ (sửa 1 lần) — mọi mặt lấy mặt 1 */
  function matCua(d, i) { var ds = d.mat || []; return (d.giong ? ds[0] : ds[Math.max(0, Math.min(ds.length - 1, +i || 0))]) || { td: '', nhan: '' }; }
  function bienHtml(d, mat) {
    var r = '', lop = 'bttb bttb-' + ({ bien: 'bien', ten: 'ten', noiquy: 'nq', anh: 'anh', tamgiac: 'tg', gap2: 'g2' }[d.kieu] || 'bien');
    if (d.kieu === 'tamgiac') {
      var m0 = matCua(d, mat == null ? d.xemMat : mat);
      r = '<div class="bttb-fit"><div class="bttb-trong"><div class="bttb-td nl" style="font-size:calc(var(--t)*' + d.coTd + ')">' + esc(m0.td) + '</div>' +
        (String(m0.nhan || '').trim() ? '<div class="bttb-nhan">' + esc(m0.nhan) + '</div>' : '') + '</div></div>';
    } else if (d.kieu === 'gap2') {
      var mau = mauMa(d.mauChu), pn = function (lat) {
        return '<div class="bttb-pn bttb-fit' + (lat ? ' lat' : '') + '"><div class="bttb-trong">' +
          (d.dong1 ? '<div class="d1 nl" style="color:' + mau + ';font-size:calc(var(--t)*' + d.co1 + ')">' + esc(d.dong1) + '</div>' : '') +
          (d.dong2 ? '<div class="d2 nl" style="color:' + mau + ';font-size:calc(var(--t)*' + d.co2 + ')">' + esc(d.dong2) + '</div>' : '') + '</div></div>';
      };
      r = pn(1) + '<div class="g2-giua">' + (d.logo ? '<span class="lg lat">' + svgCua('logo') + '</span><span class="lg">' + svgCua('logo') + '</span>' : '') + '</div>' + pn(0);
    } else if (d.kieu === 'bien') {
      if (!d.logo) lop += ' khong-logo';
      r = (d.logo ? '<div class="bttb-logo">' + svgCua('logo') + '</div>' : '') +
        '<div class="bttb-pn bttb-fit"><div class="bttb-trong">' +
        (d.hinh && H[d.hinh] ? '<div class="bttb-hinh">' + svgCua(d.hinh) + '</div>' : '') +
        (d.td ? '<div class="bttb-td nl" style="color:' + mauMa(d.mauTd) + ';font-size:calc(var(--t)*' + d.coTd + ')">' + esc(d.td) + '</div>' : '') +
        (d.gach ? '<div class="bttb-gach"></div>' : '') +
        (d.dong ? '<div class="bttb-dong nl" style="color:' + mauMa(d.mauDong) + ';font-size:calc(var(--t)*' + d.coDong + ')">' + esc(d.dong) + '</div>' : '') +
        (d.vien ? '<div class="bttb-vien nl">' + esc(d.vien) + '</div>' : '') + '</div></div>';
    } else if (d.kieu === 'ten') {
      r = '<div class="bttb-fit"><div class="bttb-trong"><div class="bttb-td nl" style="font-size:calc(var(--t)*' + d.coTd + ')">' + esc(d.td) + '</div></div></div>';
    } else {
      if (d.kieuMuc === 'giua') lop += ' giua';
      var dau = '<div class="bttb-dau">' + (d.dauLogo ? '<span class="bttb-logo">' + svgCua('logo') + '</span><span class="gach"></span>' : '') +
        '<div class="bttb-td nl">' + esc(d.td) + '</div></div>';
      var than;
      if (d.kieu === 'anh') {
        than = '<div class="bttb-than bttb-fit"><div class="bttb-the">' + (d.dan ? '<div class="bttb-dan nl">' + esc(d.dan) + '</div>' : '') +
          /* --nd = số dòng nhãn nhiều nhất: mọi ô nhãn cao bằng nhau ⇒ khung ảnh các cột thẳng hàng như bản gốc (nhãn 2 dòng cạnh nhãn 3 dòng) */
          '<div class="bttb-cots" style="--nd:' + Math.max.apply(null, (d.cot || []).map(function (c) { return String(c.nhan || '').split('\n').length; }).concat(1)) + '">' + (d.cot || []).map(function (c) {
            return '<div class="bttb-cot"><div class="nhan">' + esc(c.nhan) + '</div><div class="khung">' +
              (c.anh ? '<img src="' + c.anh + '" alt="">' : '<div class="rong">Chưa có ảnh</div>') + '</div><div class="day"></div></div>';
          }).join('') + '</div></div></div>';
      } else {
        than = '<div class="bttb-than bttb-fit"><div class="bttb-trong">' + (d.muc || []).map(function (m) {
          return '<div class="bttb-muc">' + (m.ten ? '<div class="bttb-mt">' + esc(m.ten) + '</div>' : '') + '<div class="bttb-the">' + noiDung(m.nd) + '</div></div>';
        }).join('') + '</div></div>';
      }
      r = dau + than + (d.chan ? chanHtml(d) : '');
    }
    return '<div class="' + lop + '" style="--lg:' + coLogo(d) + '">' + r + '</div>';   // --lg = cỡ logo (nút − / + ở «Cỡ logo»)
  }

  /* ---------- tự thu chữ cho vừa khung ---------- */
  /* Đo bằng HỘP khối (offsetHeight) chứ không bằng scrollHeight của khung: dấu chồng tiếng Việt (Ộ, Ấ, Ổ) nhô khỏi dòng làm
     scrollHeight lớn hơn vài px ⇒ bản đầu thu chữ oan còn 59 % dù khung còn trống nửa (bộ đo bắt 24/10). */
  function tran(goc) {
    if (goc.scrollWidth > goc.clientWidth + 1) return true;
    var fit = goc.querySelectorAll('.bttb-fit');
    for (var i = 0; i < fit.length; i++) {
      var f = fit[i], cs = getComputedStyle(f), con = f.firstElementChild; if (!con) continue;
      var cho = f.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (con.offsetHeight > cho + 1) return true;
    }
    /* thẻ ảnh giãn trọn khung (offsetHeight luôn vừa) — phần thiếu chỗ dồn vào cột ảnh: nhãn + khung ảnh tối thiểu không lọt cột */
    var cot = goc.querySelectorAll('.bttb-cot');
    for (var j = 0; j < cot.length; j++) if (cot[j].scrollHeight > cot[j].clientHeight + 1) return true;
    /* bề ngang: chữ một từ quá dài, chân trang không xuống dòng */
    var ngang = goc.querySelectorAll('.bttb-td,.bttb-dong,.bttb-vien,.bttb-mt,.bttb-the>*,.bttb-chan,.bttb-dau,.bttb-cot .nhan,.bttb-nhan,.bttb-g2 .d1,.bttb-g2 .d2');
    for (var k = 0; k < ngang.length; k++) { var o = ngang[k]; if (o.scrollWidth > o.clientWidth + 1) return true; }
    return false;
  }
  function vuaKhung(goc, tren) {
    var dat = function (c) { goc.style.setProperty('--co', c); return tran(goc); };
    if (!dat(tren)) return tren;
    var lo = 0.15, hi = tren, tot = lo;
    for (var i = 0; i < 14; i++) { var m = (lo + hi) / 2; if (dat(m)) hi = m; else { lo = m; tot = m; } }
    dat(tot); return tot;
  }

  /* ---------- phông chữ ---------- */
  var _phong = null;
  function napPhong() {
    if (_phong) return _phong;
    /* 02/11: phải CHỜ tệp css phông về rồi mới hỏi document.fonts.load — hỏi sớm (css chưa về) thì trình duyệt chưa biết
       mặt phông 500/600 nào, trả [] ⇒ báo nhầm «Chưa tải được phông chữ (mất mạng?)» dù mạng vẫn tốt (gặp trên live) */
    var l = document.getElementById('bttFont');
    if (!l) {
      l = document.createElement('link'); l.id = 'bttFont'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@500;600;700;800&display=swap';
      l.addEventListener('load', function () { l.__xong = 1; }); l.addEventListener('error', function () { l.__xong = 1; });
      document.head.appendChild(l);
    }
    var choCss = new Promise(function (ok) {
      if (l.__xong || l.sheet) return ok();
      l.addEventListener('load', function () { ok(); }); l.addEventListener('error', function () { ok(); });
    });
    var cho = function () {
      if (!document.fonts || !document.fonts.load) return Promise.resolve(false);
      return Promise.all(['500', '600', '700', '800'].map(function (w) { return document.fonts.load(w + ' 40px "Be Vietnam Pro"', 'Ấ'); }))
        .then(function (r) { return r.every(function (x) { return x && x.length; }); });
    };
    var hen = new Promise(function (ok) { setTimeout(function () { ok(false); }, 8000); });
    _phong = Promise.race([choCss.then(function () { return cho().then(null, function () { return false; }); }), hen])
      .then(function (co) { if (!co) _phong = null; return co; });   // chưa tải được (mất mạng) → lần vẽ sau thử lại
    return _phong;
  }
  function napCss() {
    if (document.getElementById('bttCss')) return;
    var st = document.createElement('style'); st.id = 'bttCss'; st.textContent = CSS_BIEN; document.head.appendChild(st);
  }

  /* ---------- xem trước ---------- */
  function veXem() {
    var host = $('bttXem'), v = $('viewBtt'); if (!host || !v || v.hidden) return;
    var d = banCua(S.chon), k = khoCua(d), ngan = Math.min(k.w, k.h);
    var W = Math.round(THIET_KE * k.w / ngan), Hh = Math.round(THIET_KE * k.h / ngan);
    host.innerHTML = '<div class="btt-san" id="bttSan">' + bienHtml(d) + '</div>';
    var san = host.firstChild, goc = san.firstChild;
    goc.style.cssText += ';width:' + W + 'px;height:' + Hh + 'px;--u:' + (THIET_KE / 100) + 'px;position:absolute;left:0;top:0;transform-origin:0 0';
    var goc0 = +mauGoc(S.chon).coGoc || 1;   // mốc 100 % riêng của mẫu (xem coGoc ở MAU)
    S.co = vuaKhung(goc, goc0 * Math.max(0.5, Math.min(1.5, +d.tran || 1)));
    coGian();
    var tu = Math.round(S.co / goc0 * 100), tranPt = Math.round((+d.tran || 1) * 100);
    $('bttCoSo') && ($('bttCoSo').textContent = tranPt + '%');
    var info = $('bttKhoInfo');
    /* ô Khổ đã nói tên khổ ⇒ ở đây chỉ thêm số cm khi tên khổ chưa có (A4/A3/A2), không nhắc lại (luật không lặp thông tin) */
    var phan = [];
    if (k.k !== 'tu' && !/cm/.test(k.ten)) phan.push(esc(cm(k.w) + ' × ' + cm(k.h) + ' cm'));
    if (tu < tranPt) phan.push('<span class="btt-thu" title="Chữ dài hơn khung nên máy tự thu nhỏ cho vừa; bớt chữ hoặc chọn khổ lớn hơn để chữ to lại">chữ tự thu còn ' + tu + '%</span>');
    if (info) info.innerHTML = phan.join(' · ');
  }
  function coGian() {   // thu bản dựng vào khung xem trước (chỉ transform, không dựng lại)
    var host = $('bttXem'), san = $('bttSan'); if (!host || !san) return;
    var goc = san.firstChild, W = goc.offsetWidth, Hh = goc.offsetHeight; if (!W) return;
    var rong = host.clientWidth || 300, dt = window.matchMedia('(max-width:900px)').matches;
    var cao = Math.max(220, Math.min(dt ? window.innerHeight * 0.46 : window.innerHeight * 0.68, 720));
    var tl = Math.min(rong / W, cao / Hh);
    goc.style.transform = 'scale(' + tl + ')';
    san.style.width = Math.floor(W * tl) + 'px'; san.style.height = Math.floor(Hh * tl) + 'px';
  }
  var _hVe = 0;
  function veHen() { clearTimeout(_hVe); _hVe = setTimeout(veXem, 120); }

  /* ---------- biểu mẫu nhập ---------- */
  function o(lb, html, cls) { return '<div class="cd-f' + (cls ? ' ' + cls : '') + '"><label>' + lb + '</label>' + html + '</div>'; }
  function oChu(p, v, ph) { return '<div class="cd-in"><input type="text" data-p="' + p + '" value="' + esc(v) + '" autocomplete="off" spellcheck="false"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '></div>'; }
  /* 27/10 «làm gọn»: ô chữ cao đúng số dòng đang có (tối thiểu «dong»), gõ thêm dòng thì tự giãn — không chừa sẵn dòng trống */
  var soDong = function (v) { return String(v || '').split('\n').length; };
  function oVung(p, v, dong, ph) { var mn = dong || 1; return '<textarea class="nds-raw btt-vung" data-p="' + p + '" data-min="' + mn + '" rows="' + Math.max(mn, Math.min(12, soDong(v))) + '" spellcheck="false"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' + esc(v) + '</textarea>'; }
  function chip(p, v, ds) {   // nhóm nút chọn 1 (khuôn .kktab/.active như Loại hàng ở Chuyển đổi cân)
    return '<div class="cd-qc" role="group">' + ds.map(function (x) {
      return '<button type="button" class="kktab' + (String(v) === String(x[0]) ? ' active' : '') + '" data-p="' + p + '" data-v="' + esc(x[0]) + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
  }
  function combo(id, lb, giaTri, ds) {
    return '<div class="combo bttcb" id="' + id + '"><input readonly aria-label="' + esc(lb) + '" value="' + esc(giaTri) + '">' +
      '<div class="combo-menu">' + ds.map(function (x) {
        return '<div class="combo-item' + (x[2] ? ' active' : '') + '" data-v="' + esc(x[0]) + '"><span class="nm">' + esc(x[1]) + '</span></div>';
      }).join('') + '</div></div>';
  }
  var GOI_Y_ND = '# tiêu đề nhỏ · - gạch đầu dòng · > ô ghi chú · ! cảnh báo · [chip] [chip]';
  function veForm() {
    var f = $('bttForm'); if (!f) return;
    var d = banCua(S.chon), k = khoCua(d);
    var h = '<div class="btt-hang">' +
      o('Mẫu', combo('bttMau', 'Mẫu bảng', mauGoc(S.chon).ten, MAU.map(function (m) { return [m.id, m.ten, m.id === S.chon]; })), 'dau') +
      o('Khổ', combo('bttKho', 'Khổ giấy', k.k === 'tu' ? 'Tự nhập kích thước' : k.ten, KHO.map(function (x) { return [x.k, x.ten, x.k === d.kho]; })), 'dau') + '</div>';
    if (d.kho === 'tu') h += '<div class="btt-hang">' +
      o('Rộng (cm)', '<div class="cd-in"><input type="text" inputmode="decimal" data-p="wcm" value="' + cm(k.w) + '" autocomplete="off"></div>') +
      o('Cao (cm)', '<div class="cd-in"><input type="text" inputmode="decimal" data-p="hcm" value="' + cm(k.h) + '" autocomplete="off"></div>') + '</div>';
    if (d.kieu === 'bien') {
      /* màu đứng ngang hàng ô chữ của nó; 4 lựa chọn ngắn chung 1 hàng (luật ngang hàng khi còn chỗ) */
      h += '<div class="btt-hang">' + o('Tiêu đề', oVung('td', d.td, 1)) + o('Màu', chip('mauTd', d.mauTd, [['xanh', 'Xanh'], ['cam', 'Cam']]), 'gon') + '</div>' +
        '<div class="btt-hang">' + o('Dòng phụ', oVung('dong', d.dong, 1)) + o('Màu', chip('mauDong', d.mauDong, [['xanh', 'Xanh'], ['cam', 'Cam']]), 'gon') + '</div>' +
        o('Ô viền xanh', oChu('vien', d.vien)) +
        '<div class="btt-hang">' + o('Biểu tượng', chip('hinh', d.hinh || '', [['', 'Không'], ['camHut', 'Cấm hút thuốc']]), 'gon') +
        o('Gạch ngang', chip('gach', d.gach ? 1 : 0, [[1, 'Có'], [0, 'Không']]), 'gon') +
        o('Logo', chip('logo', d.logo ? 1 : 0, [[1, 'Có'], [0, 'Không']]), 'gon') + (d.logo ? coLogoHtml(d) : '') + '</div>';
    } else if (d.kieu === 'tamgiac') {
      var soMat = d.giong ? 1 : (d.mat || []).length;
      h += '<div class="btt-hang">' + o('Các mặt', chip('giong', d.giong ? 1 : 0, [[1, '3 mặt giống nhau'], [0, 'Mỗi mặt một chữ']])) +
        o('Điền nhanh', combo('bttGoiY', 'Chữ có sẵn của 8 khu', 'Chọn khu có sẵn', GOI_Y_TG.map(function (g, i) { return [i, g[0].replace(/\n/g, ' ') + (g[1] ? ' · ' + g[1] : ''), false]; }))) + '</div>';
      for (var mi = 0; mi < soMat; mi++) {
        var mm = d.mat[mi], dx = (+d.xemMat || 0) === mi;
        h += '<div class="btt-muc"><div class="btt-muchd"><span class="btt-so">' + (d.giong ? 'Chữ cả 3 mặt' : 'Mặt ' + (mi + 1)) + '</span>' +
          (!d.giong ? '<button type="button" class="kktab btt-nho' + (dx ? ' active' : '') + '" data-act="xemMat" data-i="' + mi + '">' + (dx ? 'Đang xem' : 'Xem') + '</button>' : '') + '</div>' +
          oVung('mat.' + mi + '.td', mm.td, 1) + oChu('mat.' + mi + '.nhan', mm.nhan, 'Nhãn cam, vd PO API') + '</div>';
      }
    } else if (d.kieu === 'gap2') {
      h += o('Dòng trên (chữ mảnh)', oVung('dong1', d.dong1, 1)) + o('Dòng dưới (chữ đậm)', oVung('dong2', d.dong2, 1)) +
        '<div class="btt-hang">' + o('Màu chữ', chip('mauChu', d.mauChu, [['cam', 'Cam'], ['xanh', 'Xanh']]), 'gon') + o('Logo giữa', chip('logo', d.logo ? 1 : 0, [[1, 'Có'], [0, 'Không']]), 'gon') +
        (d.logo ? coLogoHtml(d) : '') + '</div>';
    } else if (d.kieu === 'ten') {
      h += o('Chữ trên biển', oVung('td', d.td, 1));
    } else {
      h += o('Tiêu đề', oVung('td', d.td, 1));
      if (d.kieu === 'noiquy') {
        h += '<div class="btt-hang">' + o('Logo đầu biển', chip('dauLogo', d.dauLogo ? 1 : 0, [[1, 'Có'], [0, 'Không']]), 'gon') +
          o('Nhãn mục', chip('kieuMuc', d.kieuMuc, [['trai', 'Lệch trái'], ['giua', 'Giữa']]), 'gon') + '</div>';
        (d.muc || []).forEach(function (m, i) {
          h += '<div class="btt-muc"><div class="btt-muchd"><span class="btt-so">Mục ' + (i + 1) + '</span>' +
            (i ? '<button type="button" class="kktab btt-nho" data-act="len" data-i="' + i + '" title="Đưa mục này lên trên">↑</button>' : '') +
            '<button type="button" class="kktab btt-nho" data-act="xoaMuc" data-i="' + i + '" title="Xoá mục này">✕</button></div>' +
            oChu('muc.' + i + '.ten', m.ten, 'Tên mục') + oVung('muc.' + i + '.nd', m.nd, 2, GOI_Y_ND) + '</div>';
        });
        h += '<button type="button" class="kktab btt-them" data-act="themMuc">Thêm mục</button>';
      } else {
        h += o('Câu dẫn', oVung('dan', d.dan, 1));
        (d.cot || []).forEach(function (c, i) {
          h += '<div class="btt-muc"><div class="btt-muchd"><span class="btt-so">Cột ảnh ' + (i + 1) + '</span>' +
            '<button type="button" class="kktab btt-nho" data-act="anh" data-i="' + i + '">' + (c.anh ? 'Đổi ảnh' : 'Chọn ảnh') + '</button>' +
            (c.anh ? '<button type="button" class="kktab btt-nho" data-act="boAnh" data-i="' + i + '" title="Bỏ ảnh">Bỏ ảnh</button>' : '') +
            ((d.cot || []).length > 1 ? '<button type="button" class="kktab btt-nho" data-act="xoaCot" data-i="' + i + '" title="Xoá cột này">✕</button>' : '') + '</div>' +
            oVung('cot.' + i + '.nhan', c.nhan, 1) + '</div>';
        });
        if ((d.cot || []).length < 4) h += '<button type="button" class="kktab btt-them" data-act="themCot">Thêm cột ảnh</button>';
      }
      h += '<div class="btt-hang">' + o('Chân trang', chip('chan', d.chan ? 1 : 0, [[1, 'Có'], [0, 'Không']]), 'gon') +
        (d.chan || (d.kieu === 'noiquy' && d.dauLogo) ? coLogoHtml(d) : '') + '</div>';
      if (d.chan) h += '<div class="btt-hang">' + o('Hotline', oChu('hotline', d.hotline)) + o('Trang web', oChu('web', d.web)) + '</div>';
    }
    /* 27/10 bản in: số lượng + vật liệu đi vào tên tệp / thuộc tính PDF / lề nhà in; «Dấu cắt» = lề 15 mm có dấu cắt + thước kiểm (tắt khi tự in máy văn phòng)
        (27/10 «làm gọn»: 3 ô chung 1 hàng, bỏ tiêu đề «Bản in» — nhãn từng ô đã đủ nghĩa) */
    h += '<div class="btt-muc btt-hang">' +
      o('Số lượng', '<div class="cd-in"><input type="text" inputmode="numeric" data-p="sl" value="' + soBan(d) + '" autocomplete="off"></div>', 'so') +
      o('Vật liệu', oChu('vl', d.vl || '', 'bạt, formex, decal…')) +
      o('Dấu cắt nhà in', chip('dc', coDauCat(d), [[1, 'Có'], [0, 'Không']]), 'gon') + '</div>';
    f.innerHTML = h;
  }

  /* ---------- sửa dữ liệu ---------- */
  function datP(d, p, v) {
    if (p === 'wcm' || p === 'hcm') { var so = parseFloat(String(v).replace(',', '.')); if (!(so > 0)) return false; d[p === 'wcm' ? 'w' : 'h'] = Math.round(so * 10); return true; }
    var ks = p.split('.'), o2 = d;
    for (var i = 0; i < ks.length - 1; i++) { o2 = o2[ks[i]]; if (o2 == null) return false; }
    var cu = o2[ks[ks.length - 1]];
    o2[ks[ks.length - 1]] = (typeof cu === 'number') ? (+v || 0) : v;
    return true;
  }
  function suaXong(dungForm) { luuHen(); if (dungForm) veForm(); veHen(); }
  function chonMau(id) { S.chon = mauGoc(id).id; banCua(S.chon); veForm(); luuHen(); veXem(); }
  function datKho(kk) {
    var d = banCua(S.chon);
    if (kk === 'tu' && d.kho !== 'tu') { var k0 = khoCua(d); d.w = k0.w; d.h = k0.h; }
    d.kho = kk; veForm(); luuHen(); veXem();
  }
  function chonAnh(i) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function () {
      var t = inp.files && inp.files[0]; if (!t) return;
      var fr = new FileReader();
      fr.onload = function () {
        var im = new Image();
        im.onload = function () {   // thu ảnh về ≤ 1800 px cạnh dài (đủ in A3 / 60 cm mỗi cột) để bản nhớ + bản in nhẹ
          var tl = Math.min(1, 1800 / Math.max(im.width, im.height)), cv = document.createElement('canvas');
          cv.width = Math.round(im.width * tl); cv.height = Math.round(im.height * tl);
          cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          var d = banCua(S.chon); if (!d.cot || !d.cot[i]) return;
          d.cot[i].anh = cv.toDataURL('image/jpeg', 0.86); suaXong(true);
        };
        im.onerror = function () { bao('Không đọc được ảnh này — thử ảnh JPG hoặc PNG khác.'); };
        im.src = fr.result;
      };
      fr.readAsDataURL(t);
    };
    inp.click();
  }
  function hanhDong(act, i) {
    var d = banCua(S.chon);
    if (act === 'themMuc') { (d.muc = d.muc || []).push({ ten: 'MỤC MỚI', nd: '- ' }); }
    else if (act === 'xoaMuc') { d.muc.splice(i, 1); }
    else if (act === 'len' && i > 0) { var x = d.muc.splice(i, 1)[0]; d.muc.splice(i - 1, 0, x); }
    else if (act === 'themCot') { (d.cot = d.cot || []).push({ nhan: 'NHÃN MỚI', anh: '' }); }
    else if (act === 'xoaCot') { d.cot.splice(i, 1); }
    else if (act === 'boAnh') { d.cot[i].anh = ''; }
    else if (act === 'anh') { chonAnh(i); return; }
    else if (act === 'xemMat') { d.xemMat = i; }
    else if (act === 'logo') { d.lg = Math.round(Math.max(0.4, Math.min(1.5, coLogo(d) + i * 0.1)) * 100) / 100; }
    suaXong(true);
  }
  function dienNhanh(i) {   // điền chữ 1 khu có sẵn vào mặt đang xem (3 mặt giống nhau → cả 3)
    var d = banCua(S.chon), g = GOI_Y_TG[i]; if (!g || d.kieu !== 'tamgiac') return;
    var m = d.mat[d.giong ? 0 : (+d.xemMat || 0)]; m.td = g[0]; m.nhan = g[1]; suaXong(true);
  }
  function datCo(buoc) {
    var d = banCua(S.chon); d.tran = Math.round(Math.max(0.5, Math.min(1.5, (+d.tran || 1) + buoc)) * 100) / 100; luuHen(); veXem();
  }
  function veGoc() {
    var d = banCua(S.chon), kho = d.kho, w = d.w, h = d.h;
    if (!confirm('Trả «' + mauGoc(S.chon).ten + '» về chữ của bản gốc? Chữ bạn đã sửa ở mẫu này sẽ mất (khổ giấy giữ nguyên).')) return;
    delete S.ban[S.chon]; var g = banCua(S.chon); g.kho = kho; if (w) g.w = w; if (h) g.h = h;
    veForm(); luuHen(); veXem(); bao('Đã trả về chữ gốc.');
  }

  /* cỡ chữ vừa khung của 1 mặt bảng tam giác (đo ngoài màn, cùng kích thước bản dựng xem trước) */
  function coMat(d, i) {
    var k = khoCua(d), ngan = Math.min(k.w, k.h), tam = document.createElement('div');
    tam.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden';
    tam.innerHTML = bienHtml(d, i); document.body.appendChild(tam);
    var goc = tam.firstChild;
    goc.style.cssText += ';width:' + Math.round(THIET_KE * k.w / ngan) + 'px;height:' + Math.round(THIET_KE * k.h / ngan) + 'px;--u:' + (THIET_KE / 100) + 'px';
    var co = vuaKhung(goc, (+mauGoc(S.chon).coGoc || 1) * Math.max(0.5, Math.min(1.5, +d.tran || 1)));
    tam.remove(); return co;
  }
  /* ---------- xuất PDF: DỰNG TỆP NGAY TRÊN TRANG, tải thẳng về (27/10) ----------
     User 27/10: «xuất .pdf đang bị lỗi chuyển sang giao diện máy in — làm cửa sổ web bị đứng (not responding)» + «có kích thước và số lượng
     bản in luôn ở tệp, có cách nào để nhà in không in sai». Bản cũ gọi window.print(): hộp in của Windows hỏi trình điều khiển máy in mặc định
     (máy mạng tắt / khổ 100 × 56 cm không máy nào có) ⇒ cả cửa sổ đứng. Nay KHÔNG mở hộp in nữa:
      · tấm biển dựng y hệt bản xem trước (cùng --co) → SVG foreignObject (phông Be Vietnam Pro nhúng base64) → canvas khổ thật → JPEG;
      · tự viết tệp PDF: MediaBox/TrimBox đúng mm (như 8 PDF gốc trên Drive), 1 trang = 1 mẫu/mặt, số lượng KHÔNG nhân trang
        (user 27/10: mỗi đợt in chạy 1 máy khác nhau theo chất liệu/kích thước ⇒ tệp tách theo mẫu + vật liệu + khổ, số bản đặt ở máy in),
        PrintScaling None + NumCopies = số lượng (Acrobat mở hộp in ở «Kích thước thật», điền sẵn số bản);
      · khổ + số lượng ghi ở 3 chỗ: tên tệp (quy ước thư mục Drive «tên_vật liệu_khổ» + «_SL3»), thuộc tính tệp (Tiêu đề / Chủ đề / Từ khoá),
        lề nhà in (bật «Dấu cắt»): dấu cắt 4 góc, tràn lề 3 mm màu nền, dòng «THÀNH PHẨM … · SỐ LƯỢNG … · Bản i/N» và THƯỚC KIỂM 100 mm
        (thước vẽ nét, đo bằng thước thật ra khác 100 mm = nhà in đã co/giãn ⇒ trả hàng). */
  var DPI_MAX = 300, LE = 15, TRAN_LE = 3;   // mm: lề nhà in mỗi cạnh, tràn lề màu nền
  var soBan = function (d) { return Math.max(1, Math.min(50, Math.round(+d.sl || 1))); };
  var coDauCat = function (d) { return d.dc == null ? 1 : +d.dc; };
  var boDau = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D'); };
  function tenTep(d, k) {   // «noi quy phong an_bat oc_600x600mm_SL3.pdf» — cùng kiểu tên các tệp mẫu trên Drive
    var s = function (x) { return boDau(x).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
    return [s(mauGoc(S.chon).ten), s(d.vl), Math.round(k.w) + 'x' + Math.round(k.h) + 'mm', 'SL' + soBan(d)].filter(Boolean).join('_') + '.pdf';
  }
  /* phông nhúng: tải CSS Google Fonts + từng tệp woff2 → data: (ảnh SVG không được tải gì từ ngoài) — nhớ lại cho lần sau */
  var _phongNhung = null;
  function phongNhung() {
    if (_phongNhung) return _phongNhung;
    var docB64 = function (b) { return new Promise(function (ok, hong) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = hong; r.readAsDataURL(b); }); };
    _phongNhung = fetch('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@500;600;700;800&display=block').then(function (r) { return r.text(); })
      .then(function (css) {
        var ds = []; css.replace(/url\((https:[^)]+)\)/g, function (_, u) { ds.push(u); return _; });
        return Promise.all(ds.map(function (u) { return fetch(u).then(function (r) { return r.blob(); }).then(docB64).then(function (b) { css = css.split(u).join(b); }); }))
          .then(function () { return css; });
      }).catch(function () { _phongNhung = null; return ''; });
    return _phongNhung;
  }
  /* 1 mặt biển → canvas đúng khổ: dựng ngoài màn ở THIET_KE px (như xem trước), cùng cỡ chữ đã đo, rồi vẽ phóng lên pxMm */
  function veMat(d, i, co, k, pxMm, cssPhong) {
    var ngan = Math.min(k.w, k.h), W = Math.round(THIET_KE * k.w / ngan), Hh = Math.round(THIET_KE * k.h / ngan);
    var tam = document.createElement('div');
    tam.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden';
    tam.innerHTML = bienHtml(d, i); document.body.appendChild(tam);
    var goc = tam.firstChild;
    goc.style.cssText += ';width:' + W + 'px;height:' + Hh + 'px;--u:' + (THIET_KE / 100) + 'px;--co:' + co;
    var xhtml = new XMLSerializer().serializeToString(goc); tam.remove();
    var cw = Math.round(k.w * pxMm), ch = Math.round(k.h * pxMm);
    var xml = function (t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + cw + '" height="' + ch + '" viewBox="0 0 ' + W + ' ' + Hh + '">' +
      '<foreignObject x="0" y="0" width="' + W + '" height="' + Hh + '"><div xmlns="http://www.w3.org/1999/xhtml" style="width:' + W + 'px;height:' + Hh + 'px">' +
      /* *{box-sizing} = luật toàn trang index.html mà bản xem trước thừa hưởng — thiếu nó .bttb cộng thêm padding, khung trắng tràn mép phải/dưới */
      '<style>*{box-sizing:border-box}' + xml(cssPhong) + '\n' + xml(CSS_BIEN) + '</style>' + xhtml + '</div></foreignObject></svg>';
    return new Promise(function (ok, hong) {
      var im = new Image();
      im.onload = function () {
        /* phông trong ảnh SVG có khi chưa sẵn ở khung đầu ⇒ chờ 2 khung rồi mới vẽ */
        requestAnimationFrame(function () { requestAnimationFrame(function () {
          try {
            var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
            var g = cv.getContext('2d'); g.fillStyle = XANH; g.fillRect(0, 0, cw, ch); g.drawImage(im, 0, 0, cw, ch);
            ok(cv);
          } catch (e) { hong(e); }
        }); });
      };
      im.onerror = function () { hong(new Error('svg')); };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  var thanhJpeg = function (cv, q) {
    return new Promise(function (ok, hong) {
      cv.toBlob(function (b) { if (!b) return hong(new Error('jpeg')); b.arrayBuffer().then(function (a) { ok({ w: cv.width, h: cv.height, du: new Uint8Array(a) }); }, hong); }, 'image/jpeg', q);
    });
  };
  /* dòng thông tin ở lề nhà in (chữ tiếng Việt ⇒ vẽ thành ảnh 300 dpi; 14 phông chuẩn của PDF không có dấu tiếng Việt) */
  function anhDongIn(dong, rongMm, caoMm) {
    var pm = 300 / 25.4, cv = document.createElement('canvas'); cv.width = Math.round(rongMm * pm); cv.height = Math.round(caoMm * pm);
    var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#000'; g.textBaseline = 'middle';
    var co0 = cv.height / dong.length * 0.62;
    dong.forEach(function (t, j) {
      var c = co0, font = function () { g.font = (j ? '600 ' : '800 ') + c + 'px "Be Vietnam Pro",Arial,sans-serif'; };
      font(); while (c > 8 && g.measureText(t).width > cv.width) { c *= 0.94; font(); }
      g.fillText(t, 0, (j + 0.5) * cv.height / dong.length);
    });
    return cv;
  }
  /* ---- trình viết PDF tối giản (1.4): ảnh JPEG (DCTDecode) + nét vẽ; chữ ASCII của thước dùng Helvetica chuẩn ---- */
  function vietPdf(o) {
    var enc = new TextEncoder(), phan = [], dai = 0, viTri = [], so = 0;
    var them = function (x) { var b = typeof x === 'string' ? enc.encode(x) : x; phan.push(b); dai += b.length; };
    var moi = function () { return ++so; };
    var dat = function (n, than, luong) {
      viTri[n] = dai; them(n + ' 0 obj\n' + than);
      if (luong) { them('\nstream\n'); them(luong); them('\nendstream'); }
      them('\nendobj\n');
    };
    var hex16 = function (s) { var h = 'FEFF'; for (var i = 0; i < s.length; i++) h += ('000' + s.charCodeAt(i).toString(16).toUpperCase()).slice(-4); return '<' + h + '>'; };
    var pt = function (mm) { return +(mm * 72 / 25.4).toFixed(3); };
    var hop = function (a, b, c, e) { return '[' + [a, b, c, e].map(pt).join(' ') + ']'; };
    var anhObj = function (a) { return '<</Type/XObject/Subtype/Image/Width ' + a.w + '/Height ' + a.h + '/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ' + a.du.length + '>>'; };
    them('%PDF-1.4\n'); them(new Uint8Array([37, 226, 227, 207, 211, 10]));   // dòng byte cao: báo tệp nhị phân
    var nCat = moi(), nTrang = moi(), nInfo = moi(), nFont = moi();
    var anhSo = o.anh.map(function () { return moi(); });
    var dsTrang = o.trang.map(function (tg) { return { n: moi(), nd: moi(), le: tg.le ? moi() : 0 }; });
    dat(nFont, '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>');
    o.anh.forEach(function (a, i) { dat(anhSo[i], anhObj(a), a.du); });
    var L = o.le, B = o.tranLe, W = o.w, Hh = o.h;
    var rgb = [1, 3, 5].map(function (x) { return (parseInt(o.nen.substr(x, 2), 16) / 255).toFixed(4); }).join(' ');
    o.trang.forEach(function (tg, j) {
      var t = dsTrang[j], c = [];
      if (L) c.push('q ' + rgb + ' rg ' + [L - B, L - B, W + 2 * B, Hh + 2 * B].map(pt).join(' ') + ' re f Q');   // tràn lề màu nền ⇒ cắt lệch không lộ viền trắng
      c.push('q ' + pt(W) + ' 0 0 ' + pt(Hh) + ' ' + pt(L) + ' ' + pt(L) + ' cm /Im' + tg.anh + ' Do Q');
      if (L) {
        c.push('q 0 0 0 RG 0.3 w');
        [[L, L], [L + W, L], [L, L + Hh], [L + W, L + Hh]].forEach(function (g) {   // dấu cắt: cách mép tràn lề 2 mm, dài 7 mm
          var sx = g[0] === L ? -1 : 1, sy = g[1] === L ? -1 : 1, a = B + 2, z = a + 7;
          c.push(pt(g[0] + sx * a) + ' ' + pt(g[1]) + ' m ' + pt(g[0] + sx * z) + ' ' + pt(g[1]) + ' l S');
          c.push(pt(g[0]) + ' ' + pt(g[1] + sy * a) + ' m ' + pt(g[0]) + ' ' + pt(g[1] + sy * z) + ' l S');
        });
        /* thước kiểm ở lề trên: 100 mm (khổ hẹp: 50 / 30 mm), vạch mỗi 10 mm */
        var dT = W >= 130 ? 100 : W >= 70 ? 50 : 30, x0 = L + 12, y0 = L + Hh + B + 4.5;   // bắt đầu cách mép 12 mm: không chạm dấu cắt góc
        c.push(pt(x0) + ' ' + pt(y0) + ' m ' + pt(x0 + dT) + ' ' + pt(y0) + ' l S');
        for (var v = 0; v <= dT; v += 10) { var dv = (v % 50 === 0) ? 3 : 1.8; c.push(pt(x0 + v) + ' ' + pt(y0) + ' m ' + pt(x0 + v) + ' ' + pt(y0 + dv) + ' l S'); }
        c.push('Q');
        c.push('BT /F1 ' + pt(2.4) + ' Tf 0 g ' + pt(x0 + dT + 2) + ' ' + pt(y0 + 0.4) + ' Td (' + dT + ' mm) Tj ET');
        if (tg.le) c.push('q ' + pt(W - 12) + ' 0 0 ' + pt(L - B - 5) + ' ' + pt(L + 12) + ' ' + pt(1.5) + ' cm /Le Do Q');
      }
      var nd = enc.encode(c.join('\n'));
      dat(t.nd, '<</Length ' + nd.length + '>>', nd);
      dat(t.n, '<</Type/Page/Parent ' + nTrang + ' 0 R/MediaBox' + hop(0, 0, W + 2 * L, Hh + 2 * L) + '/TrimBox' + hop(L, L, L + W, L + Hh) +
        '/BleedBox' + (L ? hop(L - B, L - B, L + W + B, L + Hh + B) : hop(0, 0, W, Hh)) +
        '/Resources<</XObject<</Im' + tg.anh + ' ' + anhSo[tg.anh] + ' 0 R' + (t.le ? '/Le ' + t.le + ' 0 R' : '') + '>>/Font<</F1 ' + nFont + ' 0 R>>>>/Contents ' + t.nd + ' 0 R>>');
      if (t.le) dat(t.le, anhObj(tg.le), tg.le.du);
    });
    dat(nTrang, '<</Type/Pages/Count ' + dsTrang.length + '/Kids[' + dsTrang.map(function (t) { return t.n + ' 0 R'; }).join(' ') + ']>>');
    var n0 = new Date(), p2 = function (x) { return ('0' + x).slice(-2); };
    dat(nInfo, '<</Title' + hex16(o.tieuDe) + '/Subject' + hex16(o.chuDe) + '/Keywords' + hex16(o.tuKhoa) + '/Creator' + hex16('audit-dc · Bảng thông tin') +
      '/CreationDate(D:' + n0.getFullYear() + p2(n0.getMonth() + 1) + p2(n0.getDate()) + p2(n0.getHours()) + p2(n0.getMinutes()) + p2(n0.getSeconds()) + ')>>');
    dat(nCat, '<</Type/Catalog/Pages ' + nTrang + ' 0 R/PageLayout/SinglePage/ViewerPreferences<</PrintScaling/None/NumCopies ' + Math.max(1, o.soBan || 1) + '/Duplex/Simplex/PickTrayByPDFSize true/DisplayDocTitle true>>>>');
    var xref = dai, x = 'xref\n0 ' + (so + 1) + '\n0000000000 65535 f \n';
    for (var n = 1; n <= so; n++) x += ('000000000' + viTri[n]).slice(-10) + ' 00000 n \n';
    them(x + 'trailer\n<</Size ' + (so + 1) + '/Root ' + nCat + ' 0 R/Info ' + nInfo + ' 0 R>>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(phan, { type: 'application/pdf' });
  }
  var _dangIn = false;
  function xuatPdf(btn) {
    if (_dangIn) return; _dangIn = true;
    var chu0 = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Đang tạo PDF…'; }
    var xong = function () { _dangIn = false; if (btn) { btn.disabled = false; btn.textContent = chu0; } };
    var d = banCua(S.chon), k = khoCua(d), sl = soBan(d), dc = coDauCat(d), m = mauGoc(S.chon);
    var mat = d.kieu === 'tamgiac' ? [0, 1, 2] : [null];
    /* độ phân giải: 300 dpi; khổ lớn thì hạ cho ảnh ≤ 32 MP (điện thoại 16 MP) — 100 × 56 cm còn ~200 dpi (in bạt/formex chỉ cần 100–150) */
    var tranPx = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 16e6 : 32e6;
    var pxMm = Math.min(DPI_MAX / 25.4, Math.sqrt(tranPx / (k.w * k.h)), 16000 / Math.max(k.w, k.h)), dpi = Math.round(pxMm * 25.4);
    var kichCo = cm(k.w) + ' × ' + cm(k.h) + ' cm (' + Math.round(k.w) + ' × ' + Math.round(k.h) + ' mm)';
    var tong = mat.length, dongVl = d.vl ? ' · Vật liệu: ' + d.vl : '';
    bao('Đang dựng tệp PDF…');
    Promise.all([napPhong(), phongNhung()]).then(function (r) {
      var cssPhong = r[1] || '', anh = [];
      return mat.reduce(function (p, i) {
        return p.then(function () { return veMat(d, i, i == null ? S.co : coMat(d, i), k, pxMm, cssPhong); })
          .then(function (cv) { return thanhJpeg(cv, 0.95); }).then(function (a) { anh.push(a); });
      }, Promise.resolve()).then(function () { return { anh: anh, coPhong: !!cssPhong }; });
    }).then(function (kq) {
      var trang = [];
      for (var j = 0; j < mat.length; j++) trang.push({ anh: j, j: j });
      return trang.reduce(function (p, tg, i) {
        if (!dc) return p;
        return p.then(function () {
          var cv = anhDongIn(['THÀNH PHẨM ' + kichCo + ' · SỐ LƯỢNG ' + sl + (mat.length > 1 ? ' BỘ · IN MỖI TRANG ' + sl + ' BẢN · Mặt ' + (tg.j + 1) + '/' + mat.length : ' TẤM · IN ' + sl + ' BẢN'),
            m.ten + dongVl + ' · In đúng 100 %, không co giãn' + (tong > 1 ? ' · Trang ' + (i + 1) + '/' + tong : '')], k.w - 12, LE - TRAN_LE - 5);
          return thanhJpeg(cv, 0.9).then(function (a) { tg.le = a; });
        });
      }, Promise.resolve()).then(function () {
        var chuDe = 'Thành phẩm ' + Math.round(k.w) + ' × ' + Math.round(k.h) + ' mm · Số lượng ' + sl + (mat.length > 1 ? ' bộ (' + mat.length + ' mặt, in mỗi trang ' + sl + ' bản)' : ' tấm (in ' + sl + ' bản)') +
          ' · In 100 % không co giãn' + dongVl;
        var tep = vietPdf({ soBan: sl, w: k.w, h: k.h, le: dc ? LE : 0, tranLe: TRAN_LE, nen: XANH, anh: kq.anh, trang: trang,
          tieuDe: m.ten + ' — ' + Math.round(k.w) + '×' + Math.round(k.h) + ' mm — SL ' + sl, chuDe: chuDe,
          tuKhoa: 'kho=' + Math.round(k.w) + 'x' + Math.round(k.h) + 'mm; so-luong=' + sl + '; so-trang=' + tong + (d.vl ? '; vat-lieu=' + d.vl : '') + '; dpi=' + dpi });
        var ten = tenTep(d, k), url = URL.createObjectURL(tep), a = document.createElement('a');
        a.href = url; a.download = ten; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        window.__bttPdf = { ten: ten, tep: tep, trang: tong, sl: sl, dpi: dpi };   // bộ đo đọc lại
        bao('Đã tải «' + ten + '» · ' + tong + ' trang × ' + sl + ' bản · ' + dpi + ' dpi' + (kq.coPhong ? '' : ' · chưa tải được phông (mất mạng?) — chữ dùng phông máy'));
        xong();
      });
    }).catch(function () { xong(); bao('Không dựng được tệp PDF — bấm thử lại.'); });
  }

  /* ---------- nối sự kiện (uỷ quyền 1 chỗ) ---------- */
  function dongCombo() { document.querySelectorAll('#viewBtt .bttcb').forEach(function (c) { c.classList.remove('open'); var m = c.querySelector('.combo-menu'); if (m) m.classList.remove('show'); }); }
  function noi() {
    var f = $('bttForm'); if (!f || f.__noi) return; f.__noi = 1;
    f.addEventListener('input', function (e) {
      var p = e.target.getAttribute && e.target.getAttribute('data-p'); if (!p) return;
      if (e.target.tagName === 'TEXTAREA') e.target.rows = Math.max(+e.target.getAttribute('data-min') || 1, Math.min(12, soDong(e.target.value)));   // ô chữ giãn theo số dòng
      if (datP(banCua(S.chon), p, e.target.value)) suaXong(false);
    });
    f.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target : null; if (!t) return;
      var cb = t.closest('.bttcb');
      if (cb) {
        var it = t.closest('.combo-item');
        if (it) { dongCombo(); var v = it.getAttribute('data-v'); if (cb.id === 'bttMau') chonMau(v); else if (cb.id === 'bttGoiY') dienNhanh(+v); else datKho(v); return; }
        if (t.tagName === 'INPUT') { var m = cb.querySelector('.combo-menu'), mo = m.classList.contains('show'); dongCombo(); if (!mo) { m.classList.add('show'); cb.classList.add('open'); } }
        return;
      }
      var b = t.closest('button'); if (!b) return;
      var act = b.getAttribute('data-act');
      if (act) return hanhDong(act, +b.getAttribute('data-i'));
      var p = b.getAttribute('data-p');
      if (p) { var d = banCua(S.chon), v2 = b.getAttribute('data-v'); d[p] = (p === 'gach' || p === 'logo' || p === 'dauLogo' || p === 'chan' || p === 'giong' || p === 'dc') ? +v2 : v2;
        if (p === 'giong') d.xemMat = 0;
        suaXong(true); }
    });
    document.addEventListener('click', function (e) { if (!(e.target.closest && e.target.closest('#viewBtt .bttcb'))) dongCombo(); });
    var _hCo = 0; window.addEventListener('resize', function () { clearTimeout(_hCo); _hCo = setTimeout(coGian, 100); });
  }

  /* ---------- API cho trang + bộ đo ---------- */
  window.bttVe = function () { napCss(); noi(); veForm(); veXem(); napPhong().then(function (co) { if (co) veXem(); else bao('Chưa tải được phông chữ (mất mạng?) — bản in sẽ dùng phông máy.'); }); };
  window.bttChonMau = chonMau;
  window.bttDatKho = datKho;
  window.bttCo = datCo;
  window.bttGoc = veGoc;
  window.bttXuat = xuatPdf;
  window.bttDuLieu = function () { return banCua(S.chon); };
  window.BTT_MAU = MAU; window.BTT_KHO = KHO;
})();
