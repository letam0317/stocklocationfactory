/**
 * ============================================================================
 *  StockAbnormalSync.gs — Đồng bộ "Tồn kho bất thường" (report stock-inventory-beta)
 *  từ WMS Hasaki về Google Sheet để tab "Tồn kho bất thường" của dashboard đọc.
 *
 *  KIẾN TRÚC (khớp với luồng có sẵn của dự án):
 *    Trình duyệt KHÔNG gọi WMS trực tiếp (CORS + cần Bearer token).
 *    Apps Script này chạy nền: đăng nhập-phiên (refresh SSO token) -> gọi API WMS
 *    -> ghi vào tab Sheet `stock-inventory-beta`. Frontend đọc tab đó qua gviz.
 *
 *  ĐĂNG NHẬP SSO (OIDC) — không đăng nhập user/mật khẩu headless được vì SSO liên
 *  kết IdP. Cách bền vững & chuẩn: đăng nhập 1 LẦN trên trình duyệt, lấy refresh_token
 *  (token dài hạn), lưu vào Script Property WMS_REFRESH_TOKEN. Mỗi lần chạy, script gọi
 *  /auth/user/refresh-token để đổi lấy access_token mới (đồng thời NHẬN refresh_token
 *  mới -> tự lưu đè, vì hệ thống xoay vòng refresh_token).
 *
 *  CÀI ĐẶT NHANH: xem backend/README.md
 * ============================================================================
 */

/* ------------------------------- CẤU HÌNH ------------------------------- */
// Đọc từ Script Properties (Project Settings -> Script properties). Có default hợp lý.
function CFG_() {
  var P = PropertiesService.getScriptProperties();
  return {
    AUTH_BASE:  P.getProperty('WMS_AUTH_BASE')  || 'https://wms-gw.inshasaki.com/api/v1',
    API_BASE:   P.getProperty('WMS_API_BASE')   || 'https://wms-gw.inshasaki.com/api/v2',
    COMPANY_IDS:P.getProperty('WMS_COMPANY_IDS')|| '1002',
    SHEET_ID:   P.getProperty('SHEET_ID')       || '1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs',
    ABN_SHEET:  P.getProperty('ABN_SHEET')      || 'stock-inventory-beta',
    PAGE_SIZE:  Number(P.getProperty('WMS_PAGE_SIZE') || 200),
    MAX_PAGES:  Number(P.getProperty('WMS_MAX_PAGES') || 400),   // chặn vòng lặp chạy loạn
    TZ:         P.getProperty('TZ') || 'Asia/Ho_Chi_Minh'
  };
}

// 6 chỉ số bất thường — thứ tự & tên cột ghi ra Sheet (frontend nhận diện theo nhãn).
var ABN_FIELDS = ['conflict','uid_temp','not_found','unsuitable_product','committed','committed_outbound'];
// Toàn bộ cột ghi ra Sheet (snake_case = đúng field API, frontend abnIdx đọc được).
var ABN_OUT_COLS = ['sku','product_name','brand_name','category_name','warehouse_name','product_type',
                    'in_stock','available'].concat(ABN_FIELDS);

/* --------------------------- ĐĂNG NHẬP / TOKEN --------------------------- */
/**
 * Lấy access_token WMS. Ưu tiên refresh_token (bền vững, tự xoay vòng).
 * Nếu chỉ có WMS_ACCESS_TOKEN (dán tay, ngắn hạn) thì dùng tạm.
 */
function getAccessToken_() {
  var P = PropertiesService.getScriptProperties();
  var rt = P.getProperty('WMS_REFRESH_TOKEN');
  if (rt) {
    var cfg = CFG_();
    var res = UrlFetchApp.fetch(cfg.AUTH_BASE + '/auth/user/refresh-token', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ refresh_token: rt }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      throw new Error('Refresh token thất bại (HTTP ' + code + '): ' + res.getContentText().slice(0, 300) +
        ' — refresh_token có thể đã hết hạn, cần đăng nhập lại trên trình duyệt và cập nhật WMS_REFRESH_TOKEN.');
    }
    var body = JSON.parse(res.getContentText() || '{}');
    var data = body.data || body;
    if (!data.access_token) throw new Error('Phản hồi refresh-token không có access_token: ' + res.getContentText().slice(0, 300));
    if (data.refresh_token) P.setProperty('WMS_REFRESH_TOKEN', data.refresh_token);   // xoay vòng -> lưu đè
    P.setProperty('WMS_ACCESS_TOKEN', data.access_token);
    return data.access_token;
  }
  var at = P.getProperty('WMS_ACCESS_TOKEN');
  if (at) return at;
  throw new Error('Chưa cấu hình WMS_REFRESH_TOKEN (hoặc WMS_ACCESS_TOKEN) trong Script Properties.');
}

/* ------------------------------ GỌI API WMS ------------------------------ */
/** Lấy 1 trang báo cáo stock-inventories. */
function fetchStockPage_(token, page) {
  var cfg = CFG_();
  var url = cfg.API_BASE + '/wms/report-management/stock-inventories'
          + '?company_ids=' + encodeURIComponent(cfg.COMPANY_IDS)
          + '&page=' + page + '&size=' + cfg.PAGE_SIZE;
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code === 401) { var e = new Error('401 Unauthorized'); e.code = 401; throw e; }
  if (code < 200 || code >= 300) throw new Error('Lấy dữ liệu thất bại (HTTP ' + code + '): ' + res.getContentText().slice(0, 300));
  var body = JSON.parse(res.getContentText() || '{}');
  var data = body.data || body;
  return { records: data.records || [], total: (data.total != null ? data.total : null) };
}

function num_(v) { if (v == null || v === '') return 0; var n = Number(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; }
function isNormal_(pt) { pt = String(pt == null ? '' : pt).trim().toLowerCase(); return pt === 'normal' || pt === '1'; }

/* ------------------------------ ĐỒNG BỘ CHÍNH ------------------------------ */
/** Hàm được TRIGGER 7h sáng gọi. Cũng chạy tay được để test. */
function syncStockAbnormal() {
  var cfg = CFG_();
  var token = getAccessToken_();

  var out = [], page = 1, got = 0, total = null;
  while (page <= cfg.MAX_PAGES) {
    var res;
    try {
      res = fetchStockPage_(token, page);
    } catch (err) {
      if (err.code === 401 && page === 1) { token = getAccessToken_(); res = fetchStockPage_(token, page); }   // token vừa hết hạn -> làm mới 1 lần
      else throw err;
    }
    var recs = res.records;
    if (!recs.length) break;
    got += recs.length;
    if (res.total != null) total = res.total;

    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      if (!isNormal_(r.product_type)) continue;                 // CHỈ Product Type = Normal
      var s = 0; for (var f = 0; f < ABN_FIELDS.length; f++) s += num_(r[ABN_FIELDS[f]]);
      if (s <= 0) continue;                                     // chỉ giữ dòng THỰC SỰ bất thường
      out.push([
        r.sku, r.product_name, r.brand_name, r.category_name, r.warehouse_name, r.product_type,
        num_(r.in_stock), num_(r.available),
        num_(r.conflict), num_(r.uid_temp), num_(r.not_found), num_(r.unsuitable_product),
        num_(r.committed), num_(r.committed_outbound)
      ]);
    }
    if (total != null && got >= total) break;
    if (recs.length < cfg.PAGE_SIZE) break;
    page++;
  }

  writeSheet_(cfg, out);
  var msg = 'stock-abnormal: ghi ' + out.length + ' dòng (quét ' + got + (total != null ? '/' + total : '') + ' bản ghi).';
  PropertiesService.getScriptProperties().setProperty('WMS_ABN_LAST_SYNC',
    Utilities.formatDate(new Date(), cfg.TZ, 'yyyy-MM-dd HH:mm:ss') + ' — ' + msg);
  Logger.log(msg);
  return msg;
}

/** Ghi ra tab Sheet: xoá sạch rồi ghi header + data trong 1 lần (nhanh, không nhở dữ liệu). */
function writeSheet_(cfg, rows) {
  var ss = SpreadsheetApp.openById(cfg.SHEET_ID);
  var sh = ss.getSheetByName(cfg.ABN_SHEET);
  if (!sh) sh = ss.insertSheet(cfg.ABN_SHEET);
  sh.clearContents();
  var values = [ABN_OUT_COLS].concat(rows);
  sh.getRange(1, 1, values.length, ABN_OUT_COLS.length).setValues(values);
  // Cột số -> canh phải cho dễ đọc (không bắt buộc)
  try { sh.getRange(1, 7, sh.getMaxRows(), ABN_OUT_COLS.length - 6).setNumberFormat('#,##0'); } catch (e) {}
}

/* ------------------------------- TRIGGER 7h ------------------------------- */
/** Chạy 1 lần để cài lịch chạy mỗi ngày lúc 07:00 (giờ VN). */
function installDailyTrigger() {
  removeDailyTrigger();
  var cfg = CFG_();
  ScriptApp.newTrigger('syncStockAbnormal')
    .timeBased().everyDays(1).atHour(7).nearMinute(0).inTimezone(cfg.TZ).create();
  Logger.log('Đã cài trigger syncStockAbnormal lúc ~07:00 ' + cfg.TZ);
}
/** Gỡ mọi trigger của syncStockAbnormal. */
function removeDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncStockAbnormal') ScriptApp.deleteTrigger(t);
  });
}
