/**
 * ============================================================================
 *  PhysicalCountImport.gs — Tạo lệnh kiểm kê WMS từ dashboard (template
 *  WMS_INVENTORY_KEY_TEMPLATE_CP_CHECKLIST_SKU).
 *
 *  LUỒNG: dashboard POST {action:'pc_import', rows:[{code,type,sku,plan,by}]}
 *    -> script dựng file .xlsx đúng cấu trúc template (mỗi SKU 1 dòng:
 *       Warehouse Code | Type | Sku | Plan Date | Executed By)
 *    -> upload multipart lên endpoint import của WMS (Bearer token như
 *       StockAbnormalSync.gs) -> trả kết quả cho dashboard hiển thị.
 *
 *  PHÂN LOẠI LỖI trả về (frontend dựa vào `stage` để báo đúng nguồn lỗi):
 *    stage 'config' | 'build' | 'auth' | 'upload'  -> lỗi phía trung gian (script)
 *    stage 'wms'                                    -> WMS từ chối, message lấy từ body WMS
 *
 *  DRY-RUN / CHƯA CÓ ENDPOINT: nếu payload.dryRun=true hoặc chưa cấu hình
 *  PC_IMPORT_URL, trả {status:'file', fileB64} để frontend tải file .xlsx về
 *  import tay — luồng vẫn dùng được ngay khi chưa bắt được endpoint.
 *
 *  GẮN VÀO WEB APP: project bộ 5S đã có doPost (force_sync_wms) — KHÔNG định
 *  nghĩa doPost ở file này (đè nhau). Thêm 1 dòng vào doPost hiện có:
 *      if (data.action === 'pc_import') return pcJson_(pcImport_(data));
 *  Nếu deploy project RIÊNG: bỏ comment hàm doPost mẫu ở cuối file.
 *
 *  CÀI ĐẶT: xem backend/README.md (mục PhysicalCountImport).
 * ============================================================================
 */

/* ------------------------------- CẤU HÌNH ------------------------------- */
// Tên hàm/props đều prefix PC_ để không đụng StockAbnormalSync.gs khi nằm chung project.
function pcCFG_() {
  var P = PropertiesService.getScriptProperties();
  return {
    AUTH_BASE:   P.getProperty('WMS_AUTH_BASE') || 'https://wms-gw.inshasaki.com/api/v1',
    // Endpoint API thật đứng sau trang https://wms.inshasaki.com/physical-count/request/import/sku
    // — bắt 1 lần bằng DevTools khi import tay (xem README) rồi dán vào Script Property.
    IMPORT_URL:  P.getProperty('PC_IMPORT_URL') || '',
    FILE_FIELD:  P.getProperty('PC_FILE_FIELD') || 'file',   // tên field multipart chứa file (xem request thật)
    // ID Google Sheet bản CHUYỂN ĐỔI của template gốc (upload .xlsx lên Drive -> mở bằng Google Sheets).
    // Có thì copy template mà điền (giữ nguyên tên sheet + 2 sheet tham chiếu); không có thì dựng file trơn.
    TEMPLATE_ID: P.getProperty('PC_TEMPLATE_SHEET_ID') || '',
    FILE_NAME:   P.getProperty('PC_FILE_NAME') || 'WMS_INVENTORY_KEY_TEMPLATE_CP_CHECKLIST_SKU.xlsx',
    MAX_ROWS:    Number(P.getProperty('PC_MAX_ROWS') || 5000),
    TZ:          P.getProperty('TZ') || 'Asia/Ho_Chi_Minh'
  };
}

var PC_HEADERS = ['Warehouse Code', 'Type', 'Sku', 'Plan Date', 'Executed By'];

/* --------------------------- TOKEN (như StockAbnormalSync) --------------------------- */
// Bản pc_ riêng để file tự chạy được cả khi deploy project độc lập; cùng đọc/ghi
// WMS_REFRESH_TOKEN (xoay vòng) nên dùng chung project với StockAbnormalSync vẫn an toàn.
function pcGetToken_() {
  var P = PropertiesService.getScriptProperties();
  var rt = P.getProperty('WMS_REFRESH_TOKEN');
  if (rt) {
    var cfg = pcCFG_();
    var res = UrlFetchApp.fetch(cfg.AUTH_BASE + '/auth/user/refresh-token', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ refresh_token: rt }), muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code < 200 || code >= 300) {
      throw new Error('Refresh token thất bại (HTTP ' + code + '): ' + res.getContentText().slice(0, 300) +
        ' — cần đăng nhập lại WMS trên trình duyệt và cập nhật WMS_REFRESH_TOKEN.');
    }
    var body = JSON.parse(res.getContentText() || '{}');
    var data = body.data || body;
    if (!data.access_token) throw new Error('Phản hồi refresh-token không có access_token.');
    if (data.refresh_token) P.setProperty('WMS_REFRESH_TOKEN', data.refresh_token);   // xoay vòng -> lưu đè
    P.setProperty('WMS_ACCESS_TOKEN', data.access_token);
    return data.access_token;
  }
  var at = P.getProperty('WMS_ACCESS_TOKEN');
  if (at) return at;
  throw new Error('Chưa cấu hình WMS_REFRESH_TOKEN trong Script Properties.');
}

/* ------------------------------ XỬ LÝ CHÍNH ------------------------------ */
/**
 * payload = { action:'pc_import', dryRun?:bool,
 *             rows:[{ code:'1436', type:'1'|'2', sku:'422330403', plan:'2026-07-20', by:'mail@…'|'' }] }
 * Trả về object thuần (chưa bọc ContentService) — doPost bọc bằng pcJson_().
 */
function pcImport_(payload) {
  var cfg = pcCFG_(), stage = 'config';
  try {
    var rows = (payload && payload.rows) || [];
    if (!rows.length) return pcErr_(stage, 'Không có dòng SKU nào trong yêu cầu.');
    if (rows.length > cfg.MAX_ROWS) return pcErr_(stage, 'Quá ' + cfg.MAX_ROWS + ' dòng (' + rows.length + ') — tách nhỏ lệnh.');
    var values = [], bad = [];
    rows.forEach(function (r, i) {
      var code = String(r.code == null ? '' : r.code).trim();
      var type = String(r.type == null ? '' : r.type).trim();
      var sku  = String(r.sku  == null ? '' : r.sku).trim();
      var plan = String(r.plan == null ? '' : r.plan).trim();
      var by   = String(r.by   == null ? '' : r.by).trim();
      if (!code || !sku || !plan || (type !== '1' && type !== '2')) { bad.push('dòng ' + (i + 1) + ' (sku ' + (sku || '?') + ')'); return; }
      values.push([code, type, sku, plan, by]);
    });
    if (bad.length) return pcErr_(stage, 'Dòng thiếu/sai dữ liệu (cần code + type 1|2 + sku + plan): ' + bad.slice(0, 5).join(', ') + (bad.length > 5 ? '…' : ''));

    stage = 'build';
    var blob = pcBuildXlsx_(cfg, values);

    if (payload.dryRun || !cfg.IMPORT_URL) {
      return { status: 'file', fileName: cfg.FILE_NAME, rows: values.length,
        fileB64: Utilities.base64Encode(blob.getBytes()),
        note: cfg.IMPORT_URL ? '' : 'PC_IMPORT_URL chưa cấu hình — tải file về và import tay tại wms.inshasaki.com/physical-count/request/import/sku.' };
    }

    stage = 'auth';
    var token = pcGetToken_();

    stage = 'upload';
    var res = pcUpload_(cfg, token, blob);
    if (res.getResponseCode() === 401) {   // token vừa xoay -> làm mới 1 lần rồi thử lại
      token = pcGetToken_();
      res = pcUpload_(cfg, token, blob);
    }

    stage = 'wms';
    var code2 = res.getResponseCode(), text = res.getContentText() || '';
    var parsed = null; try { parsed = JSON.parse(text); } catch (e) {}
    if (code2 < 200 || code2 >= 300) {
      return pcErr_('wms', pcWmsMsg_(parsed, text) || ('WMS trả HTTP ' + code2), { code: code2, wms: text.slice(0, 1500), errors: pcWmsErrors_(parsed) });
    }
    // 2xx nhưng body có cờ lỗi (một số API trả 200 kèm success:false / danh sách dòng lỗi)
    if (parsed && (parsed.success === false || parsed.status === 'error' || (parsed.data && parsed.data.success === false))) {
      return pcErr_('wms', pcWmsMsg_(parsed, text) || 'WMS từ chối file import.', { code: code2, wms: text.slice(0, 1500), errors: pcWmsErrors_(parsed) });
    }
    return { status: 'success', rows: values.length, code: code2,
      message: pcWmsMsg_(parsed, '') || ('WMS đã nhận lệnh kiểm kê (' + values.length + ' dòng).'),
      wms: text.slice(0, 1500) };
  } catch (err) {
    return pcErr_(stage, String(err && err.message || err));
  }
}

function pcErr_(stage, message, extra) {
  var o = { status: 'error', stage: stage, message: message };
  if (extra) for (var k in extra) o[k] = extra[k];
  return o;
}

/** Upload multipart — UrlFetchApp tự dựng multipart/form-data khi payload chứa blob. */
function pcUpload_(cfg, token, blob) {
  var payload = {}; payload[cfg.FILE_FIELD] = blob;
  return UrlFetchApp.fetch(cfg.IMPORT_URL, {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    payload: payload,
    muteHttpExceptions: true
  });
}

/** Lấy message người-đọc-được từ body WMS (thử các khóa hay gặp). */
function pcWmsMsg_(parsed, fallbackText) {
  if (parsed) {
    var d = parsed.data || {};
    var m = parsed.message || parsed.error || parsed.error_message || d.message || d.error;
    if (m) return String(m);
  }
  return fallbackText ? String(fallbackText).slice(0, 300) : '';
}
/** Gom ghi chú lỗi theo dòng nếu WMS trả mảng errors (nhiều dạng khác nhau -> chuỗi hoá). */
function pcWmsErrors_(parsed) {
  if (!parsed) return [];
  var d = parsed.data || {};
  var arr = parsed.errors || d.errors || d.error_rows || [];
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 50).map(function (e) { return (typeof e === 'string') ? e : JSON.stringify(e); });
}

/* ------------------------------ DỰNG FILE .XLSX ------------------------------ */
/**
 * Ưu tiên COPY template gốc (PC_TEMPLATE_SHEET_ID — giữ nguyên tên sheet + sheet tham
 * chiếu Warehouse code / SKU type); không có thì tạo spreadsheet trơn đúng 5 cột header.
 * Ghi giá trị dạng TEXT ('@') để SKU không mất số 0 đầu và Plan Date giữ nguyên chuỗi yyyy-MM-dd.
 */
function pcBuildXlsx_(cfg, values) {
  var tempId, ss;
  if (cfg.TEMPLATE_ID) {
    tempId = DriveApp.getFileById(cfg.TEMPLATE_ID).makeCopy('pc-import-temp-' + Date.now()).getId();
    ss = SpreadsheetApp.openById(tempId);
    var sh = ss.getSheets()[0];   // sheet dữ liệu chính là sheet ĐẦU của template
    var last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), PC_HEADERS.length)).clearContent();
    sh.getRange(2, 1, values.length, PC_HEADERS.length).setNumberFormat('@').setValues(values);
  } else {
    ss = SpreadsheetApp.create('pc-import-temp-' + Date.now());
    tempId = ss.getId();
    var sh2 = ss.getSheets()[0];
    sh2.getRange(1, 1, 1, PC_HEADERS.length).setValues([PC_HEADERS]);
    sh2.getRange(2, 1, values.length, PC_HEADERS.length).setNumberFormat('@').setValues(values);
  }
  SpreadsheetApp.flush();
  var res = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + tempId + '/export?format=xlsx', {
    headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  try { DriveApp.getFileById(tempId).setTrashed(true); } catch (e) {}   // dọn file tạm kể cả khi export lỗi
  if (res.getResponseCode() !== 200) throw new Error('Xuất .xlsx thất bại (HTTP ' + res.getResponseCode() + ').');
  return res.getBlob().setName(cfg.FILE_NAME);
}

/* ------------------------------ WEB APP GLUE ------------------------------ */
/** Bọc object thành JSON response cho web app. */
function pcJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* Deploy project RIÊNG (không chung bộ 5S) thì bỏ comment: web app cần doPost.
function doPost(e) {
  var data = {}; try { data = JSON.parse(e.postData.contents || '{}'); } catch (err) {}
  if (data.action === 'pc_import') return pcJson_(pcImport_(data));
  return pcJson_({ status: 'error', stage: 'config', message: 'action không hỗ trợ: ' + data.action });
}
*/

/* ------------------------------- TEST TAY ------------------------------- */
/** Run tay trong editor: dựng file mẫu 2 dòng (dryRun) để kiểm tra cấu trúc trước khi nối endpoint. */
function pcSelfTest() {
  var out = pcImport_({ dryRun: true, rows: [
    { code: '1436', type: '1', sku: '422330403', plan: '2026-07-20', by: '' },
    { code: '1436', type: '1', sku: '422488814', plan: '2026-07-20', by: 'test@hasaki.vn' }
  ] });
  Logger.log(out.status + ' — ' + (out.fileName || out.message) + ' (' + (out.rows || 0) + ' dòng)');
  return out;
}
