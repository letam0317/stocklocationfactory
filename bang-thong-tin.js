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
      '<button type="button" class="kktab btt-nho" data-act="logo" data-i="1" title="Phóng to logo">+</button></div>');
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
    if (!document.getElementById('bttFont')) {
      var l = document.createElement('link'); l.id = 'bttFont'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@500;600;700;800&display=swap';
      document.head.appendChild(l);
    }
    var cho = function () {
      if (!document.fonts || !document.fonts.load) return Promise.resolve(false);
      return Promise.all(['500', '600', '700', '800'].map(function (w) { return document.fonts.load(w + ' 40px "Be Vietnam Pro"', 'Ấ'); }))
        .then(function (r) { return r.every(function (x) { return x && x.length; }); });
    };
    var hen = new Promise(function (ok) { setTimeout(function () { ok(false); }, 8000); });
    _phong = Promise.race([new Promise(function (ok) { setTimeout(function () { cho().then(ok, function () { ok(false); }); }, 50); }), hen])
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
  function oVung(p, v, dong, ph) { return '<textarea class="nds-raw btt-vung" data-p="' + p + '" rows="' + (dong || 2) + '" spellcheck="false"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' + esc(v) + '</textarea>'; }
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
      h += o('Tiêu đề', oVung('td', d.td, 1)) +
        '<div class="btt-hang">' + o('Màu tiêu đề', chip('mauTd', d.mauTd, [['xanh', 'Xanh'], ['cam', 'Cam']])) +
        o('Biểu tượng', chip('hinh', d.hinh || '', [['', 'Không'], ['camHut', 'Cấm hút thuốc']])) + '</div>' +
        o('Dòng phụ', oVung('dong', d.dong, 3, 'Mỗi dòng một hàng')) +
        '<div class="btt-hang">' + o('Màu dòng phụ', chip('mauDong', d.mauDong, [['xanh', 'Xanh'], ['cam', 'Cam']])) +
        o('Gạch ngang', chip('gach', d.gach ? 1 : 0, [[1, 'Có'], [0, 'Không']])) + '</div>' +
        o('Ô viền xanh', oChu('vien', d.vien, 'Để trống nếu không cần')) +
        '<div class="btt-hang">' + o('Logo', chip('logo', d.logo ? 1 : 0, [[1, 'Có'], [0, 'Không']])) + (d.logo ? coLogoHtml(d) : '') + '</div>';
    } else if (d.kieu === 'tamgiac') {
      var soMat = d.giong ? 1 : (d.mat || []).length;
      h += '<div class="btt-hang">' + o('Các mặt', chip('giong', d.giong ? 1 : 0, [[1, '3 mặt giống nhau'], [0, 'Mỗi mặt một chữ']])) +
        o('Điền nhanh', combo('bttGoiY', 'Chữ có sẵn của 8 khu', 'Chọn khu có sẵn', GOI_Y_TG.map(function (g, i) { return [i, g[0].replace(/\n/g, ' ') + (g[1] ? ' · ' + g[1] : ''), false]; }))) + '</div>';
      for (var mi = 0; mi < soMat; mi++) {
        var mm = d.mat[mi], dx = (+d.xemMat || 0) === mi;
        h += '<div class="btt-muc"><div class="btt-muchd"><span class="btt-so">' + (d.giong ? 'Chữ cả 3 mặt' : 'Mặt ' + (mi + 1)) + '</span>' +
          (!d.giong ? '<button type="button" class="kktab btt-nho' + (dx ? ' active' : '') + '" data-act="xemMat" data-i="' + mi + '">' + (dx ? 'Đang xem' : 'Xem') + '</button>' : '') + '</div>' +
          oVung('mat.' + mi + '.td', mm.td, 3, 'Mỗi dòng một hàng') + oChu('mat.' + mi + '.nhan', mm.nhan, 'Nhãn cam (vd PO API) — để trống nếu không cần') + '</div>';
      }
    } else if (d.kieu === 'gap2') {
      h += o('Dòng trên (chữ mảnh)', oVung('dong1', d.dong1, 1)) + o('Dòng dưới (chữ đậm)', oVung('dong2', d.dong2, 2)) +
        '<div class="btt-hang">' + o('Màu chữ', chip('mauChu', d.mauChu, [['cam', 'Cam'], ['xanh', 'Xanh']])) + o('Logo giữa', chip('logo', d.logo ? 1 : 0, [[1, 'Có'], [0, 'Không']])) + '</div>' +
        (d.logo ? '<div class="btt-hang">' + coLogoHtml(d) + '</div>' : '');
    } else if (d.kieu === 'ten') {
      h += o('Chữ trên biển', oVung('td', d.td, 2));
    } else {
      h += o('Tiêu đề', oVung('td', d.td, 1));
      if (d.kieu === 'noiquy') {
        h += '<div class="btt-hang">' + o('Logo đầu biển', chip('dauLogo', d.dauLogo ? 1 : 0, [[1, 'Có'], [0, 'Không']])) +
          o('Nhãn mục', chip('kieuMuc', d.kieuMuc, [['trai', 'Lệch trái'], ['giua', 'Giữa']])) + '</div>';
        (d.muc || []).forEach(function (m, i) {
          h += '<div class="btt-muc"><div class="btt-muchd"><span class="btt-so">Mục ' + (i + 1) + '</span>' +
            (i ? '<button type="button" class="kktab btt-nho" data-act="len" data-i="' + i + '" title="Đưa mục này lên trên">↑</button>' : '') +
            '<button type="button" class="kktab btt-nho" data-act="xoaMuc" data-i="' + i + '" title="Xoá mục này">✕</button></div>' +
            oChu('muc.' + i + '.ten', m.ten, 'Tên mục (để trống nếu không cần)') + oVung('muc.' + i + '.nd', m.nd, Math.min(12, Math.max(3, String(m.nd || '').split('\n').length + 1)), GOI_Y_ND) + '</div>';
        });
        h += '<button type="button" class="kktab btt-them" data-act="themMuc">Thêm mục</button>';
      } else {
        h += o('Câu dẫn', oVung('dan', d.dan, 3));
        (d.cot || []).forEach(function (c, i) {
          h += '<div class="btt-muc"><div class="btt-muchd"><span class="btt-so">Cột ảnh ' + (i + 1) + '</span>' +
            '<button type="button" class="kktab btt-nho" data-act="anh" data-i="' + i + '">' + (c.anh ? 'Đổi ảnh' : 'Chọn ảnh') + '</button>' +
            (c.anh ? '<button type="button" class="kktab btt-nho" data-act="boAnh" data-i="' + i + '" title="Bỏ ảnh">Bỏ ảnh</button>' : '') +
            ((d.cot || []).length > 1 ? '<button type="button" class="kktab btt-nho" data-act="xoaCot" data-i="' + i + '" title="Xoá cột này">✕</button>' : '') + '</div>' +
            oVung('cot.' + i + '.nhan', c.nhan, 3) + '</div>';
        });
        if ((d.cot || []).length < 4) h += '<button type="button" class="kktab btt-them" data-act="themCot">Thêm cột ảnh</button>';
      }
      h += '<div class="btt-hang">' + o('Chân trang', chip('chan', d.chan ? 1 : 0, [[1, 'Có'], [0, 'Không']])) +
        (d.chan || (d.kieu === 'noiquy' && d.dauLogo) ? coLogoHtml(d) : '') + '</div>';
      if (d.chan) h += '<div class="btt-hang">' + o('Hotline', oChu('hotline', d.hotline)) + o('Trang web', oChu('web', d.web)) + '</div>';
    }
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
  /* ---------- xuất PDF: in đúng khổ bằng hộp in của trình duyệt ---------- */
  var _dangIn = false;
  function xuatPdf(btn) {
    if (_dangIn) return; _dangIn = true;
    if (btn) btn.disabled = true;
    var xong = function () { _dangIn = false; if (btn) btn.disabled = false; };
    try {
      var d = banCua(S.chon), k = khoCua(d), ngan = Math.min(k.w, k.h);
      var cu = document.getElementById('bttIn'); if (cu) cu.remove();
      var st0 = document.getElementById('bttInCss'); if (st0) st0.remove();
      var host = document.createElement('div'); host.id = 'bttIn';
      /* bảng tam giác: mỗi mặt 1 trang (3 trang), cỡ chữ đo riêng từng mặt; mẫu khác: 1 trang */
      var trang = d.kieu === 'tamgiac' ? [0, 1, 2] : [null];
      host.innerHTML = trang.map(function (i) { return bienHtml(d, i); }).join('');
      [].slice.call(host.children).forEach(function (goc, j) {
        var co = trang[j] == null ? S.co : coMat(d, trang[j]);
        /* trừ 0,3 mm chiều cao: làm tròn của bộ in có thể đẩy 1 dòng điểm ảnh sang trang 2 trắng */
        goc.style.cssText += ';width:' + k.w + 'mm;height:' + (k.h - 0.3) + 'mm;--u:' + (ngan / 100) + 'mm;--co:' + (co * 0.995) + (j < trang.length - 1 ? ';break-after:page;page-break-after:always' : '');
      });
      var st = document.createElement('style'); st.id = 'bttInCss';
      st.textContent = '#bttIn{display:none}@page{size:' + k.w + 'mm ' + k.h + 'mm;margin:0}' +
        '@media print{html,body{margin:0!important;padding:0!important;background:#fff!important;min-height:0!important;height:auto!important;overflow:visible!important}' +
        'body>*:not(#bttIn){display:none!important}#bttIn{display:block!important;position:static!important}#bttIn .bttb{break-inside:avoid;page-break-inside:avoid}}';
      document.head.appendChild(st); document.body.appendChild(host);
      var tieuDe = document.title;
      var don = function () { document.title = tieuDe; host.remove(); st.remove(); xong(); };
      var anh = [].slice.call(host.querySelectorAll('img')).map(function (im) { return im.decode ? im.decode().catch(function () { }) : null; });
      Promise.all([napPhong()].concat(anh)).then(function () {
        document.title = 'Bang thong tin - ' + mauGoc(S.chon).ten + ' - ' + cm(k.w) + 'x' + cm(k.h) + 'cm';
        window.addEventListener('afterprint', don, { once: true });
        setTimeout(function () { try { window.print(); } catch (e) { don(); bao('Trình duyệt không mở được hộp in.'); } }, 30);
      }).catch(function () { don(); bao('Không chuẩn bị được bản in — bấm thử lại.'); });
    } catch (e) { xong(); bao('Không chuẩn bị được bản in — bấm thử lại.'); }
  }

  /* ---------- nối sự kiện (uỷ quyền 1 chỗ) ---------- */
  function dongCombo() { document.querySelectorAll('#viewBtt .bttcb').forEach(function (c) { c.classList.remove('open'); var m = c.querySelector('.combo-menu'); if (m) m.classList.remove('show'); }); }
  function noi() {
    var f = $('bttForm'); if (!f || f.__noi) return; f.__noi = 1;
    f.addEventListener('input', function (e) {
      var p = e.target.getAttribute && e.target.getAttribute('data-p'); if (!p) return;
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
      if (p) { var d = banCua(S.chon), v2 = b.getAttribute('data-v'); d[p] = (p === 'gach' || p === 'logo' || p === 'dauLogo' || p === 'chan' || p === 'giong') ? +v2 : v2;
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
