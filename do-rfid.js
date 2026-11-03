/* do-rfid.js — THẺ «DÒ RFID» (Công cụ kho · 03/11/2026)
   Lọc cây vải cần đi tìm sau kiểm kê (UID group THIẾU = có trên hệ thống mà không đếm thấy, hoặc CHÊNH LỆCH số lượng)
   theo Request code · Ngày kiểm · Người kiểm → tải tệp .csv mã tag RFID để nạp vào Multi-Tag Locate của app 123RFID.
   Nguồn: tab kiemke-uidgr (đã nạp sẵn bởi uidgrLoad — cùng nguồn pop-up UID group lệch của Kiểm kê). Cột RFID + Counted by
   do push-pc-to-sheet ghi (mã tag lấy từ ảnh chụp Group UID sẵn có → 0 lượt gọi WMS thêm). Trang KHÔNG chạm WMS.
   Tái dùng: .cd-grid/.panel/.abntiles/.mtbl.mbcard/.kktab, enhanceSelect (ô chọn chuẩn), taoBoLocNgay (bộ lọc ngày chuẩn). */
(function () {
  var R = window.RFID = window.RFID || { rows: null, hien: 200, loc: { req: '', by: '', loai: 'thieu', dang: 'chu', a: '', b: '' }, dangNap: false };
  var $ = function (id) { return document.getElementById(id); };
  var soCo = function (v) { return v !== '' && v != null && !isNaN(Number(v)); };
  var ngayIso = function (s) { var ms = kkParseDate(s); return isNaN(ms) ? '' : new Date(ms).toISOString().slice(0, 10); };
  var hex = function (s) { var o = ''; for (var i = 0; i < s.length; i++) o += ('0' + s.charCodeAt(i).toString(16)).slice(-2); return o.toUpperCase(); };
  var LOAI = { thieu: 'Thiếu (không đếm thấy)', lech: 'Chênh lệch số lượng', ca: 'Thiếu + chênh lệch' };

  /* Dựng danh sách cây từ dòng kiemke-uidgr: 1 dòng / (request, UID group) — cây xuất hiện ở nhiều phiếu của cùng request
     (lần đếm trọn ô + lần đếm theo mã) thì GIỮ PHIẾU MỚI NHẤT, vì đó là kết luận sau cùng của request. */
  function dung(rows) {
    var m = {};
    (rows || []).forEach(function (o) {
      var uid = String(o.uid || '').replace(/^'/, ''); if (!uid) return;
      var qs = soCo(o.qs) ? Number(o.qs) : null, qu = soCo(o.qu) ? Number(o.qu) : null;
      var loai = (qs != null && qs > 0 && !qu) ? 'thieu' : (qs != null && qu != null && qu > 0 && qu !== qs) ? 'lech' : '';
      var k = String(o.req) + '|' + uid, ms = kkParseDate(o.cd);
      var cu = m[k]; if (cu && !(ms > cu._ms)) return;
      m[k] = { req: String(o.req || ''), uid: uid, rf: String(o.rfid || '').trim(), loc: String(o.loc || ''), sku: String(o.sku || ''), pn: String(o.pn || ''),
        qs: qs, qu: qu, loai: loai, by: String(o.by || ''), ngay: ngayIso(o.cd), _ms: ms, type: String(o.type || '') };
    });
    return Object.keys(m).map(function (k) { return m[k]; }).filter(function (x) { return x.loai; });
  }
  function locRows() {
    var L = R.loc;
    return (R.rows || []).filter(function (x) {
      if (L.req && x.req !== L.req) return false;
      if (L.by && x.by !== L.by) return false;
      if (L.loai !== 'ca' && x.loai !== L.loai) return false;
      if (L.a && (x.ngay < L.a || x.ngay > (L.b || L.a))) return false;
      return true;
    }).sort(function (a, b) { return a.loc.localeCompare(b.loc) || a.uid.localeCompare(b.uid); });
  }
  /* Ô chọn phụ thuộc nhau: danh sách Người kiểm theo request đang chọn (và ngược lại), kèm số cây */
  function moSel(id, tatCa, ds, cur, ten) {
    var el = $(id); if (!el) return;
    el.innerHTML = '<option value="">' + tatCa + '</option>' + ds.map(function (d) {
      return '<option value="' + esc(d[0]) + '"' + (d[0] === cur ? ' selected' : '') + '>' + esc(ten ? ten(d[0]) : d[0]) + ' (' + nf(d[1]) + ')</option>';
    }).join('');
    if (typeof window.enhanceSelect === 'function') window.enhanceSelect(el);
    if (el._csWrap && typeof el._csWrap._csDongBo === 'function') el._csWrap._csDongBo();
  }
  function demTheo(k, boQua) {
    var L = R.loc, d = {};
    (R.rows || []).forEach(function (x) {
      if (boQua !== 'req' && L.req && x.req !== L.req) return;
      if (boQua !== 'by' && L.by && x.by !== L.by) return;
      if (L.loai !== 'ca' && x.loai !== L.loai) return;
      if (L.a && (x.ngay < L.a || x.ngay > (L.b || L.a))) return;
      if (x[k]) d[x[k]] = (d[x[k]] || 0) + 1;
    });
    return d;
  }
  function veSel() {
    var dr = demTheo('req', 'req'), db = demTheo('by', 'by');
    if (R.loc.req && !dr[R.loc.req]) dr[R.loc.req] = 0;
    if (R.loc.by && !db[R.loc.by]) db[R.loc.by] = 0;
    moSel('rfidReq', 'Tất cả request', Object.keys(dr).sort(function (a, b) { return Number(b) - Number(a); }).map(function (k) { return [k, dr[k]]; }), R.loc.req);
    moSel('rfidBy', 'Tất cả người kiểm', Object.keys(db).sort().map(function (k) { return [k, db[k]]; }), R.loc.by, function (v) { return String(v).replace(/@.*/, ''); });
  }
  function ve() {
    var co = !!(R.rows && R.rows.length);
    $('rfidState').hidden = co; $('rfidTools').hidden = !co; $('rfidWrap').hidden = !co; $('rfidTiles').hidden = !co;
    if (!co) return;
    veSel();
    var loc = locRows(), coTag = loc.filter(function (x) { return x.rf; }).length;
    $('rfidTiles').innerHTML =
      '<div class="abntile" style="--cc:var(--accent)"><div class="k">' + nf(loc.length) + '</div><div class="l">cây cần tìm</div></div>' +
      '<div class="abntile" style="--cc:var(--good)"><div class="k">' + nf(coTag) + '</div><div class="l">có mã tag</div></div>' +
      '<div class="abntile" style="--cc:var(--bad)"><div class="k">' + nf(loc.length - coTag) + '</div><div class="l">chưa gắn tag</div></div>';
    var btn = $('rfidBtnTai'); btn.disabled = !coTag; btn.textContent = coTag ? 'Tải .csv (' + nf(coTag) + ' mã)' : 'Tải .csv';
    var html = '';
    loc.slice(0, R.hien).forEach(function (x) {
      html += '<tr>' +
        '<td class="mb-hd">' + (x.rf ? esc(x.rf) : '<span class="hint" title="Cây chưa gắn tag RFID — không dò được bằng súng, tìm theo vị trí">chưa có tag</span>') + '</td>' +
        '<td data-lb="UID group">' + esc(x.uid) + '</td>' +
        '<td class="mb-tag" data-lb="Vị trí">' + esc(x.loc) + '</td>' +
        '<td data-lb="SKU">' + esc(x.sku) + '</td>' +
        '<td class="pn mb-full' + (x.pn ? '' : ' mb-0') + '">' + esc(x.pn) + '</td>' +
        '<td class="sl" data-lb="SL hệ thống">' + (x.qs == null ? '—' : nf(x.qs)) + '</td>' +
        '<td class="sl' + (x.qu ? '' : ' mb-0') + '" data-lb="SL đếm">' + (x.qu ? nf(x.qu) : '—') + '</td>' +
        '</tr>';
    });
    $('rfidBody').innerHTML = html || '<tr><td colspan="7" class="empty">Không cây nào khớp bộ lọc.</td></tr>';
    var them = $('rfidBtnThem'); them.hidden = !(loc.length > R.hien);
    if (!them.hidden) them.textContent = 'Xem thêm (' + nf(loc.length - R.hien) + ' dòng nữa)';
  }
  window.rfidTai = function () {
    var ds = locRows().filter(function (x) { return x.rf; });
    if (!ds.length) return;
    var ma = ds.map(function (x) { return R.loc.dang === 'hex' ? hex(x.rf) : x.rf; });
    var blob = new Blob([ma.join('\r\n') + '\r\n'], { type: 'text/csv' });
    var a = document.createElement('a'), L = R.loc;
    a.href = URL.createObjectURL(blob);
    a.download = 'do-rfid' + (L.req ? '-' + L.req : '') + (L.by ? '-' + L.by.replace(/@.*/, '') : '') + (L.a ? '-' + L.a + (L.b && L.b !== L.a ? '_' + L.b : '') : '') + '-' + L.loai + (L.dang === 'hex' ? '-hex' : '') + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  };
  window.rfidThem = function () { R.hien += 200; ve(); };
  var ganXong = false;
  function gan() {
    if (ganXong) return; ganXong = true;
    ['rfidReq', 'rfidBy', 'rfidLoai', 'rfidDang'].forEach(function (id) {
      var el = $(id); if (!el) return;
      if (typeof window.enhanceSelect === 'function') window.enhanceSelect(el);
      el.addEventListener('change', function () {
        var k = { rfidReq: 'req', rfidBy: 'by', rfidLoai: 'loai', rfidDang: 'dang' }[id];
        R.loc[k] = this.value || (k === 'loai' ? 'thieu' : k === 'dang' ? 'chu' : ''); R.hien = 200; ve();
      });
    });
    if (typeof window.taoBoLocNgay === 'function' && $('rfidNgay')) {
      window.taoBoLocNgay({ root: $('rfidNgay'), idNut: 'rfidDateBtn', idPop: 'rfidDatePop', homNay: fcTodayISO,
        nhan: function (a, b) { if (!a) return 'Tất cả ngày kiểm'; var fa = a.slice(8, 10) + '/' + a.slice(5, 7), fb = b ? b.slice(8, 10) + '/' + b.slice(5, 7) : fa; return (b && b !== a) ? fa + ' → ' + fb : fa; },
        onApply: function (a, b) { R.loc.a = a || ''; R.loc.b = a ? (b || a) : ''; R.hien = 200; ve(); } });
    }
  }
  /* Mở thẻ: nạp tab kiemke-uidgr (cache phiên 10' chung với Kiểm kê). Lỗi mạng → báo + nút thử lại (luật offline mục 3). */
  window.rfidMo = function (force) {
    gan();
    if (R.rows && !force) { ve(); return; }
    if (R.dangNap) return;
    R.dangNap = true;
    var st = $('rfidState'); st.hidden = false; st.textContent = 'Đang đọc dữ liệu kiểm kê…';
    Promise.resolve().then(function () { return uidgrLoad(!!force); }).then(function () {
      if (UIDGR.err) throw 0;
      var all = []; Object.keys(UIDGR.map || {}).forEach(function (c) { all = all.concat(UIDGR.map[c]); });
      R.rows = dung(all);
      if (!R.rows.some(function (x) { return x.rf; }) && !R._baoTag) {
        R._baoTag = 1;   // tab chưa có cột RFID (lượt đồng bộ đầu sau cập nhật chưa chạy) — vẫn liệt kê cây
      }
      if (!R.rows.length) { st.hidden = false; st.textContent = 'Chưa có cây thiếu / chênh lệch nào trong dữ liệu kiểm kê.'; return; }
      ve();
    }).catch(function () {
      st.hidden = false;
      st.innerHTML = 'Không đọc được dữ liệu kiểm kê (mất mạng?). <button type="button" class="kktab" onclick="rfidMo(true)">Thử lại</button>';
    }).finally(function () { R.dangNap = false; });
  };
})();
