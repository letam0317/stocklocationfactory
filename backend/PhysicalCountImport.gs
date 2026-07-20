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
 *  nghĩa doPost ở file này (đè nhau). Thêm vào doPost hiện có 3 dòng:
 *      if (data.action === 'pc_import') return pcJson_(pcKeyOK_(data) ? pcImport_(data) : pcKeyErr_());
 *      if (data.action === 'pc_sync_whcode') return pcJson_(pcKeyOK_(data) ? pcSyncWarehouses() : pcKeyErr_());
 *      if (data.action === 'pc_set_key') return pcJson_(pcSetKey_(data));
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
    // Đồng bộ tab "Warehouse code": Sheet đích + danh sách warehouse_ids (union 2 công ty, lấy từ cấu hình sync 5S)
    SHEET_ID:    P.getProperty('PC_SHEET_ID') || '1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs',
    WHCODE_SHEET:P.getProperty('PC_WHCODE_SHEET') || 'Warehouse code',
    STOCKLOC_API:P.getProperty('PC_STOCKLOC_API') || 'https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-locations/bins/count/v3',
    WH_IDS:      P.getProperty('PC_WAREHOUSE_IDS') || '1458,1441,1307,1250,1179,1178,1177,1151,1516,1341,1340,1339,1266',
    COMPANY_IDS: P.getProperty('PC_COMPANY_IDS') || '1002,1005',
    TZ:          P.getProperty('TZ') || 'Asia/Ho_Chi_Minh'
  };
}

var PC_HEADERS = ['Warehouse Code', 'Type', 'Sku', 'Plan Date', 'Executed By'];

/* ------------------------- KHÓA RIÊNG PC_KEY -------------------------
 * Chính sách project 5S: action khiến GAS gọi WMS bằng token nội bộ PHẢI khóa.
 * Không dùng chung SECRET 5S (tránh lộ khóa chủ cho operator dashboard public).
 * - pcKeyOK_: so key trong body với Script Property PC_KEY.
 * - pcSetKey_ (action pc_set_key): TOFU — CHỈ đặt được khi PC_KEY đang trống;
 *   đổi khóa phải kèm oldKey đúng. Operator nhập khóa 1 lần trên dashboard
 *   (lưu localStorage), khóa KHÔNG nằm trong mã nguồn trang. */
function pcKeyOK_(duLieu) {
  var k = PropertiesService.getScriptProperties().getProperty('PC_KEY') || '';
  if (!k) return false;   // chưa cấu hình -> từ chối (gọi pc_set_key trước)
  return String((duLieu && duLieu.key) || '') === k;
}
function pcKeyErr_() {
  var co = !!(PropertiesService.getScriptProperties().getProperty('PC_KEY') || '');
  return pcErr_('auth', co ? 'Sai khóa PC_KEY.' : 'PC_KEY chưa cấu hình — gọi action pc_set_key để đặt khóa.', { code: 403 });
}
function pcSetKey_(duLieu) {
  var P = PropertiesService.getScriptProperties();
  var cur = P.getProperty('PC_KEY') || '';
  var moi = String((duLieu && duLieu.newKey) || '').trim();
  if (!moi || moi.length < 12) return pcErr_('config', 'newKey phải ≥ 12 ký tự.');
  if (cur && String((duLieu && duLieu.oldKey) || '') !== cur) return pcErr_('auth', 'oldKey không đúng — không đổi được PC_KEY.', { code: 403 });
  P.setProperty('PC_KEY', moi);
  return { status: 'success', message: cur ? 'Đã đổi PC_KEY.' : 'Đã đặt PC_KEY lần đầu.' };
}

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
  // Fallback: token sống do luồng nền của project 5S nuôi (property WMS_TOKEN, có thể kèm tiền tố "Bearer ")
  var at = P.getProperty('WMS_ACCESS_TOKEN') || P.getProperty('WMS_TOKEN');
  if (at) return String(at).replace(/^Bearer /i, '').trim();
  throw new Error('Chưa có token WMS (WMS_REFRESH_TOKEN / WMS_TOKEN) trong Script Properties — chờ luồng nền cập nhật hoặc đăng nhập lại.');
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
  if (data.action === 'pc_import') return pcJson_(pcKeyOK_(data) ? pcImport_(data) : pcKeyErr_());
  if (data.action === 'pc_sync_whcode') return pcJson_(pcKeyOK_(data) ? pcSyncWarehouses() : pcKeyErr_());
  if (data.action === 'pc_set_key') return pcJson_(pcSetKey_(data));
  return pcJson_({ status: 'error', stage: 'config', message: 'action không hỗ trợ: ' + data.action });
}
*/

/* --------------------- CHO TRÌNH DUYỆT MƯỢN TOKEN (pc_token) ---------------------
 * WMS chặn IP ngoài (GAS không gọi WMS được) nhưng gateway mở CORS `*` → TRÌNH DUYỆT
 * operator (IP nội bộ) upload thẳng WMS. GAS chỉ còn 2 vai: dựng file .xlsx + phát token.
 * Phát token = "cho mượn token nội bộ" → BẮT BUỘC PC_KEY; dashboard chỉ giữ trong RAM. */
function pcToken_() {
  try { return { status: 'success', token: pcGetToken_() }; }
  catch (err) { return pcErr_('auth', String(err && err.message || err), { code: 401 }); }
}

/* Ghi tab "Warehouse code" từ dữ liệu TRÌNH DUYỆT gửi lên (rows=[[code,name],...]) —
 * trình duyệt tự hỏi WMS tên kho (GAS bị chặn IP nên không tự hỏi được). */
function pcSaveWhcode_(duLieu) {
  var got = ((duLieu && duLieu.rows) || []).map(function (r) {
    return [String(r[0] == null ? '' : r[0]).trim(), String(r[1] == null ? '' : r[1]).replace(/\s+/g, ' ').trim()];
  }).filter(function (r) { return r[0] && r[1]; });
  if (!got.length) return pcErr_('config', 'Không có dòng [code, name] hợp lệ.');
  try { return pcMergeWhcode_(pcCFG_(), got); }
  catch (err) { return pcErr_('build', String(err && err.message || err)); }
}

/* ------------------- ĐỒNG BỘ TAB "Warehouse code" TỪ WMS -------------------
 * Dashboard tra mã kho theo tên từ tab này. Tự dựng bằng cách hỏi WMS tên kho của
 * từng warehouse_id đã biết (report stock-locations, size=1 -> rất nhẹ).
 * MERGE với dữ liệu sẵn có: dòng dán tay (vd 1436 SHOP...) được GIỮ NGUYÊN,
 * mã trùng thì cập nhật tên, mã mới thì thêm. Chạy lại bất kỳ lúc nào (idempotent). */
function pcSyncWarehouses() {
  var cfg = pcCFG_();
  try {
    var token = pcGetToken_(), got = [];
    var ids = cfg.WH_IDS.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    // fetchAll SONG SONG — báo cáo này chậm, gọi tuần tự 13 kho vượt trần 6 phút/lượt chạy của GAS
    var reqs = ids.map(function (id) {
      return { url: cfg.STOCKLOC_API + '?company_ids=' + encodeURIComponent(cfg.COMPANY_IDS) +
          '&warehouse_ids=' + encodeURIComponent(id) + '&ignore_zero_total=1&page=1&size=1',
        headers: { 'Authorization': 'Bearer ' + token }, muteHttpExceptions: true };
    });
    var resps = [];
    try { resps = UrlFetchApp.fetchAll(reqs); } catch (e) { return pcErr_('wms', 'Gọi WMS thất bại: ' + e.message); }
    resps.forEach(function (res, i) {
      try {
        if (res.getResponseCode() !== 200) return;
        var j = JSON.parse(res.getContentText() || '{}');
        var recs = j.records || (j.data && j.data.records) || [];
        var name = recs.length ? String(recs[0].warehouse_name || '').replace(/\s+/g, ' ').trim() : '';
        if (name) got.push([ids[i], name]);
      } catch (e) {}
    });
    if (!got.length) return pcErr_('wms', 'Không lấy được tên kho nào từ WMS (token hết hạn hoặc endpoint đổi?).');
    return pcMergeWhcode_(cfg, got);
  } catch (err) {
    return pcErr_('build', String(err && err.message || err));
  }
}
/* Merge [code,name] vào tab Warehouse code: dòng dán tay GIỮ NGUYÊN, mã trùng cập nhật tên, mã mới thêm. */
function pcMergeWhcode_(cfg, got) {
  var ss = SpreadsheetApp.openById(cfg.SHEET_ID);
  var sh = ss.getSheetByName(cfg.WHCODE_SHEET) || ss.insertSheet(cfg.WHCODE_SHEET);
  var cur = {}, order = [];
  var last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, 4).getValues().forEach(function (r) {
    var code = String(r[0]).trim(); if (!code || cur[code]) return;
    cur[code] = [code, String(r[1] || ''), String(r[2] || ''), String(r[3] || '')]; order.push(code);
  });
  got.forEach(function (g) {
    if (cur[g[0]]) cur[g[0]][1] = g[1];
    else { cur[g[0]] = [g[0], g[1], '', '']; order.push(g[0]); }
  });
  var values = [['Warehouse Code', 'Warehouse Name', 'Type', 'City Name']]
    .concat(order.sort().map(function (c) { return cur[c]; }));
  sh.clearContents();
  sh.getRange(1, 1, values.length, 4).setNumberFormat('@').setValues(values);
  return { status: 'success', rows: values.length - 1, synced: got.length,
    message: 'Tab "' + cfg.WHCODE_SHEET + '": ' + (values.length - 1) + ' kho (cập nhật ' + got.length + ' mã).' };
}

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
