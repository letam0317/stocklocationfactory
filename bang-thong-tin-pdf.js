/* bang-thong-tin-pdf.js — XUẤT PDF NÉT VẼ cho tab «Bảng thông tin» (02/11/2026)
 * User 02/11: «nét vẽ, đồng thời làm cấu hình tương tự .pdf (Drive): đúng bằng thành phẩm, không chừa lề, dạng nét vẽ: phóng to bao nhiêu cũng nét».
 * Mẫu Drive (soi pymupdf): Illustrator, chữ đã outline, 0 ảnh, MediaBox = TrimBox = khổ thành phẩm, 1 trang / mặt.
 * Cách làm: tấm biển dựng bằng HTML (y hệt bản xem trước, cùng cỡ chữ đã đo) → đọc VỊ TRÍ từng thứ trình duyệt đã xếp:
 *   · khung nền / bo góc / viền  → hình chữ nhật bo góc (nét vẽ PDF);
 *   · chữ: từng ký tự lấy vị trí bằng Range, vẽ bằng ĐƯỜNG VIỀN GLYPH của Be Vietnam Pro (opentype.js đọc tệp .ttf trong phong/)
 *     — mỗi glyph 1 Form XObject dùng lại ⇒ tệp nhẹ; chữ thành nét như «Create Outlines» của Illustrator, máy nhà in không cần phông;
 *   · logo / biểu tượng: path SVG (tách từ PDF gốc) → path PDF;
 *   · ảnh người dùng chọn (cột ảnh xe nâng) là ảnh chụp ⇒ nhúng JPEG gốc, cắt đúng khung (object-fit:cover).
 * Phần tử lật 180° (khung trên của «khu vực khai báo») vẽ kèm phép quay quanh tâm hộp của nó.
 * Không gọi upstream nào; phông + opentype.js nằm cùng repo (OFL / MIT). */
(function () {
  'use strict';
  if (window.BTT_VECTO) return;
  var TEP = { 500: 'phong/BeVietnamPro-Medium.ttf', 600: 'phong/BeVietnamPro-SemiBold.ttf', 700: 'phong/BeVietnamPro-Bold.ttf', 800: 'phong/BeVietnamPro-ExtraBold.ttf' };
  var F = null, _tai = null;
  function napScript(src) {
    return new Promise(function (ok, hong) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { hong(new Error('script ' + src)); }; document.head.appendChild(s); });
  }
  function tai() {
    if (_tai) return _tai;
    _tai = (window.opentype ? Promise.resolve() : napScript('phong/opentype-1.3.4.min.js')).then(function () {
      return Promise.all(Object.keys(TEP).map(function (w) {
        return fetch(TEP[w]).then(function (r) { if (!r.ok) throw new Error('phong ' + r.status); return r.arrayBuffer(); })
          .then(function (b) { return [w, window.opentype.parse(b)]; });
      }));
    }).then(function (ds) { F = {}; ds.forEach(function (x) { F[x[0]] = x[1]; }); return F; })
      .catch(function (e) { _tai = null; throw e; });
    return _tai;
  }
  var phongCua = function (w) { w = +w || 400; return F[w <= 550 ? 500 : w <= 650 ? 600 : w <= 750 ? 700 : 800]; };

  /* ---- màu / số ---- */
  var so = function (x) { return (Math.round(x * 1000) / 1000).toString(); };
  function mau(c) {   // 'rgb(a)' → [r,g,b,a] 0..1
    var m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null;
    var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
    return [p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 ? p[3] : 1];
  }
  var rg = function (c) { return so(c[0]) + ' ' + so(c[1]) + ' ' + so(c[2]); };

  /* tỉ lệ đường chân chữ (baseline) so với đỉnh hộp chữ của Range, đo thật trên trang theo từng độ đậm */
  var _base = {};
  function tiLeBase(w) {
    if (_base[w] != null) return _base[w];
    var o = document.createElement('div');
    o.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;font:' + w + ' 100px/normal "Be Vietnam Pro";white-space:nowrap';
    o.innerHTML = 'H<span style="display:inline-block;width:1px;height:0;vertical-align:baseline"></span>';
    document.body.appendChild(o);
    var r = document.createRange(); r.setStart(o.firstChild, 0); r.setEnd(o.firstChild, 1);
    var t = r.getBoundingClientRect().top, b = o.lastChild.getBoundingClientRect().bottom;
    o.remove(); _base[w] = (b - t) / 100; return _base[w];
  }

  /* ---- dựng 1 trang ---- */
  function veTrang(goc, wMm, hMm, nguon) {
    var R0 = goc.getBoundingClientRect(), Wpt = wMm * 72 / 25.4, Hpt = hMm * 72 / 25.4, s = Wpt / R0.width;
    var X = function (x) { return (x - R0.left) * s; }, Y = function (y) { return Hpt - (y - R0.top) * s; };
    var c = [], thieu = {};
    var gs = function (a) { if (a >= 0.999) return ''; var k = 'G' + Math.round(a * 1000); nguon.gs[k] = a; return '/' + k + ' gs '; };
    var doMo = function (el) { var a = 1; for (var e = el; e && e.nodeType === 1; e = e.parentElement) { a *= +getComputedStyle(e).opacity; if (e === goc) break; } return a; };
    var lat = function (el) { var n = 0; for (var e = el; e && e.nodeType === 1; e = e.parentElement) { var t = getComputedStyle(e).transform; if (t && t !== 'none') { var m = /matrix\(([^,]+),[^,]+,[^,]+,([^,]+)/.exec(t); if (m && +m[1] < -0.5 && +m[2] < -0.5) n++; } if (e === goc) break; } return n % 2 === 1; };
    /* quay 180° quanh tâm hộp r (toạ độ trang) — dùng cho phần tử lật */
    var quay = function (r) { var cx = X(r.left + r.width / 2), cy = Y(r.top + r.height / 2); return '-1 0 0 -1 ' + so(2 * cx) + ' ' + so(2 * cy) + ' cm '; };

    /* hình chữ nhật bo góc theo CSS (bán kính tự thu khi tổng 2 góc > cạnh) */
    function hopBo(r, cs, thut) {
      var x = r.left + thut, y = r.top + thut, w = r.width - 2 * thut, h = r.height - 2 * thut; if (w <= 0 || h <= 0) return '';
      var rr = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map(function (k) { return Math.max(0, (parseFloat(cs[k]) || 0) - thut); });
      var f = Math.min(1, w / ((rr[0] + rr[1]) || 1e9), w / ((rr[3] + rr[2]) || 1e9), h / ((rr[0] + rr[3]) || 1e9), h / ((rr[1] + rr[2]) || 1e9));
      rr = rr.map(function (v) { return v * f; });
      if (!rr[0] && !rr[1] && !rr[2] && !rr[3]) return so(X(x)) + ' ' + so(Y(y + h)) + ' ' + so(w * s) + ' ' + so(h * s) + ' re ';
      var K = 0.5523, p = [];
      var M = function (a, b) { p.push(so(X(a)) + ' ' + so(Y(b)) + ' m'); }, L = function (a, b) { p.push(so(X(a)) + ' ' + so(Y(b)) + ' l'); };
      var C = function (a1, b1, a2, b2, a3, b3) { p.push([X(a1), Y(b1), X(a2), Y(b2), X(a3), Y(b3)].map(so).join(' ') + ' c'); };
      M(x + rr[0], y); L(x + w - rr[1], y);
      if (rr[1]) C(x + w - rr[1] * (1 - K), y, x + w, y + rr[1] * (1 - K), x + w, y + rr[1]);
      L(x + w, y + h - rr[2]);
      if (rr[2]) C(x + w, y + h - rr[2] * (1 - K), x + w - rr[2] * (1 - K), y + h, x + w - rr[2], y + h);
      L(x + rr[3], y + h);
      if (rr[3]) C(x + rr[3] * (1 - K), y + h, x, y + h - rr[3] * (1 - K), x, y + h - rr[3]);
      L(x, y + rr[0]);
      if (rr[0]) C(x, y + rr[0] * (1 - K), x + rr[0] * (1 - K), y, x + rr[0], y);
      return p.join(' ') + ' h ';
    }
    function veHop(el) {
      var cs = getComputedStyle(el), r = el.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return;
      var a = doMo(el), q = lat(el) && el !== goc ? quay(r) : '';
      var nen = mau(cs.backgroundColor);
      if (nen && nen[3] > 0.001) { var d = hopBo(r, cs, 0); if (d) c.push('q ' + q + gs(a * nen[3]) + rg(nen) + ' rg ' + d + 'f Q'); }
      var bw = parseFloat(cs.borderTopWidth) || 0, bm = mau(cs.borderTopColor);
      if (bw > 0 && cs.borderTopStyle !== 'none' && bm && bm[3] > 0.001) {
        var d2 = hopBo(r, cs, bw / 2); if (d2) c.push('q ' + q + gs(a * bm[3]) + rg(bm) + ' RG ' + so(bw * s) + ' w ' + d2 + 'S Q');
      }
    }
    function veSvg(el) {
      var r = el.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return;
      var vb = (el.getAttribute('viewBox') || '0 0 ' + r.width + ' ' + r.height).split(/[\s,]+/).map(parseFloat);
      var k = Math.min(r.width / vb[2], r.height / vb[3]), ox = r.left + (r.width - vb[2] * k) / 2 - vb[0] * k, oy = r.top + (r.height - vb[3] * k) / 2 - vb[1] * k;
      var mauChu = mau(getComputedStyle(el).color) || [0, 0, 0, 1], a = doMo(el), q = lat(el) ? quay(r) : '';
      var bo = ['q ' + q];
      [].forEach.call(el.querySelectorAll('path'), function (pa) {
        var fill = pa.getAttribute('fill') || '#000', cm = fill === 'currentColor' ? mauChu : fill === 'none' ? null : hex(fill);
        if (!cm) return;
        var dd = pa.getAttribute('d') || '', tk = dd.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [], i = 0, lenh = '', out = [];
        var P = function () { var px = ox + (+tk[i++]) * k, py = oy + (+tk[i++]) * k; return so(X(px)) + ' ' + so(Y(py)); };
        while (i < tk.length) {
          if (/[A-Za-z]/.test(tk[i])) lenh = tk[i++];
          if (lenh === 'M') { out.push(P() + ' m'); lenh = 'L'; }
          else if (lenh === 'L') out.push(P() + ' l');
          else if (lenh === 'C') out.push(P() + ' ' + P() + ' ' + P() + ' c');
          else if (lenh === 'Z' || lenh === 'z') { out.push('h'); lenh = ''; }
          else { i++; }   // lệnh lạ (hình trong repo chỉ có M C L Z) — bỏ qua số để không treo
        }
        bo.push(gs(a * cm[3]) + rg(cm) + ' rg ' + out.join(' ') + (pa.getAttribute('fill-rule') === 'evenodd' ? ' f*' : ' f'));
      });
      bo.push('Q'); c.push(bo.join('\n'));
    }
    function veAnh(el) {
      var r = el.getBoundingClientRect(), src = el.getAttribute('src') || '';
      var m = /^data:image\/jpe?g;base64,(.+)$/.exec(src); if (!m || r.width <= 0 || !el.naturalWidth) return;
      var nw = el.naturalWidth, nh = el.naturalHeight, k = Math.max(r.width / nw, r.height / nh), w = nw * k, h = nh * k;
      var x = r.left + (r.width - w) / 2, y = r.top + (r.height - h) / 2;
      var ten = 'I' + nguon.anh.length; var bin = atob(m[1]), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      nguon.anh.push({ ten: ten, w: nw, h: nh, du: u });
      c.push('q ' + (lat(el) ? quay(r) : '') + so(X(r.left)) + ' ' + so(Y(r.bottom)) + ' ' + so(r.width * s) + ' ' + so(r.height * s) + ' re W n ' +
        so(w * s) + ' 0 0 ' + so(h * s) + ' ' + so(X(x)) + ' ' + so(Y(y + h)) + ' cm /' + ten + ' Do Q');
    }
    /* ⚠ không có trong Be Vietnam Pro ⇒ vẽ tay: tam giác bo nhẹ + dấu chấm than (rỗng ruột như ký hiệu chữ) */
    function veCanhBao(r, cm, a, q) {
      var w = Math.min(r.width, r.height) * 0.92, cx = r.left + r.width / 2, cy = r.top + r.height / 2 + w * 0.02;
      var top = cy - w * 0.45, day = cy + w * 0.4, nua = w * 0.5, t = w * 0.11;
      var ngoai = [[cx, top], [cx + nua, day], [cx - nua, day]], trong = [[cx, top + t * 2.05], [cx + nua - t * 1.75, day - t * 0.95], [cx - nua + t * 1.75, day - t * 0.95]];
      var P = function (p) { return so(X(p[0])) + ' ' + so(Y(p[1])); };
      var d = P(ngoai[0]) + ' m ' + P(ngoai[1]) + ' l ' + P(ngoai[2]) + ' l h ' + P(trong[0]) + ' m ' + P(trong[2]) + ' l ' + P(trong[1]) + ' l h ';
      var gw = t * 0.9, g0 = top + w * 0.36, g1 = day - w * 0.26, ch = day - w * 0.17;
      d += so(X(cx - gw / 2)) + ' ' + so(Y(g1)) + ' ' + so(gw * s) + ' ' + so((g1 - g0) * s) + ' re ';
      d += so(X(cx - gw / 2)) + ' ' + so(Y(ch + gw)) + ' ' + so(gw * s) + ' ' + so(gw * s) + ' re ';
      c.push('q ' + q + gs(a * cm[3]) + rg(cm) + ' rg ' + d + 'f* Q');
    }
    function veChu(node) {
      var el = node.parentElement, cs = getComputedStyle(el), t = node.nodeValue || ''; if (!t.trim()) return;
      var w = +cs.fontWeight || 400, fs = parseFloat(cs.fontSize), cm = mau(cs.color) || [0, 0, 0, 1], f = phongCua(w);
      var a = doMo(el), xoay = lat(el), bl = tiLeBase(w), rg0 = document.createRange(), upm = f.unitsPerEm, ty = fs * s / upm;
      var dau = gs(a * cm[3]) + rg(cm) + ' rg ';
      for (var i = 0; i < t.length;) {
        var j = i + 1;
        if (/[\uD800-\uDBFF]/.test(t[i])) j++;
        while (j < t.length && /[̀-ͯ]/.test(t[j])) j++;   // gom dấu kết hợp (gõ kiểu tổ hợp) về 1 cụm
        var cum = t.slice(i, j); rg0.setStart(node, i); rg0.setEnd(node, j); i = j;
        if (/^\s+$/.test(cum)) continue;
        var rs = rg0.getClientRects(), r = null; for (var z = 0; z < rs.length; z++) if (rs[z].width > 0) { r = rs[z]; break; }
        if (!r) continue;
        var q = xoay ? quay(r) : '';
        if (cum === '⚠') { veCanhBao(r, cm, a, q); continue; }
        var nfc = cum.normalize('NFC'), gl = f.charToGlyph(nfc);
        if (!gl || !gl.index) { thieu[cum] = 1; continue; }   // ký tự phông không có (emoji…) — báo cho người dùng, không vẽ bừa
        var ten = glyphForm(f, w, gl, nguon);
        if (!ten) continue;
        var bx = r.left, by = r.top + bl * fs;
        c.push('q ' + q + dau + so(ty) + ' 0 0 ' + so(ty) + ' ' + so(X(bx)) + ' ' + so(Y(by)) + ' cm /' + ten + ' Do Q');
      }
    }
    var dinhVi = function (el) { return getComputedStyle(el).position !== 'static'; };
    function ve1(el) {
      var tag = el.tagName.toLowerCase();
      if (tag === 'svg') return veSvg(el), false;
      if (tag === 'img') return veAnh(el), false;
      veHop(el); return true;
    }
    function dong(el, sau) {   // vẽ theo thứ tự cây, phần tử định vị (position ≠ static) dồn ra sau (như thứ tự vẽ của CSS)
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) { veChu(n); continue; }
        if (n.nodeType !== 1 || getComputedStyle(n).display === 'none') continue;
        if (dinhVi(n)) { sau.push(n); continue; }
        if (ve1(n)) dong(n, sau);
      }
    }
    function lop(el) {
      var sau = [];
      if (ve1(el)) dong(el, sau);
      sau.map(function (e, i) { return { e: e, i: i, z: parseInt(getComputedStyle(e).zIndex, 10) || 0 }; })
        .sort(function (a, b) { return a.z - b.z || a.i - b.i; }).forEach(function (x) { lop(x.e); });
    }
    lop(goc);
    return { w: Wpt, h: Hpt, noiDung: c.join('\n'), thieu: Object.keys(thieu) };
  }
  function hex(h) {
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h || ''); if (!m) return mau(h);
    var x = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    return [0, 2, 4].map(function (i) { return parseInt(x.substr(i, 2), 16) / 255; }).concat(1);
  }
  /* glyph → Form XObject (đơn vị phông, trục y lên = đúng trục PDF); quadratic TrueType → cubic */
  function glyphForm(f, w, gl, nguon) {
    var ten = 'g' + w + '_' + gl.index; if (nguon.glyph[ten] !== undefined) return nguon.glyph[ten] ? ten : null;
    var cmds = gl.path && gl.path.commands || [], o = [], cx = 0, cy = 0, sx = 0, sy = 0;
    cmds.forEach(function (k) {
      if (k.type === 'M') { o.push(so(k.x) + ' ' + so(k.y) + ' m'); cx = sx = k.x; cy = sy = k.y; }
      else if (k.type === 'L') { o.push(so(k.x) + ' ' + so(k.y) + ' l'); cx = k.x; cy = k.y; }
      else if (k.type === 'Q') { o.push([cx + 2 / 3 * (k.x1 - cx), cy + 2 / 3 * (k.y1 - cy), k.x + 2 / 3 * (k.x1 - k.x), k.y + 2 / 3 * (k.y1 - k.y), k.x, k.y].map(so).join(' ') + ' c'); cx = k.x; cy = k.y; }
      else if (k.type === 'C') { o.push([k.x1, k.y1, k.x2, k.y2, k.x, k.y].map(so).join(' ') + ' c'); cx = k.x; cy = k.y; }
      else if (k.type === 'Z') { o.push('h'); cx = sx; cy = sy; }
    });
    if (!o.length) { nguon.glyph[ten] = ''; return null; }
    var b = gl.getBoundingBox ? gl.getBoundingBox() : { x1: -500, y1: -500, x2: 2000, y2: 2000 };
    nguon.glyph[ten] = { bbox: [b.x1 - 2, b.y1 - 2, b.x2 + 2, b.y2 + 2].map(Math.round), nd: o.join(' ') + ' f' };
    return ten;
  }

  /* nén Flate bằng CompressionStream (zlib = đúng FlateDecode); trình duyệt cũ không có thì để thô */
  function nen(u8) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve(null);
    var cs = new CompressionStream('deflate'), wr = cs.writable.getWriter(); wr.write(u8); wr.close();
    return new Response(cs.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); }, function () { return null; });
  }

  /* ---- viết tệp PDF 1.4: trang = đúng khổ thành phẩm, MediaBox = TrimBox = BleedBox (như tệp Illustrator trên Drive) ---- */
  function vietPdf(trang, nguon, o) {
    var enc = new TextEncoder();
    var obj = [], soObj = 0, moi = function () { return ++soObj; };
    var dat = function (n, than, du) { obj[n] = { than: than, du: du }; };
    var hex16 = function (s) { var h = 'FEFF'; for (var i = 0; i < s.length; i++) h += ('000' + s.charCodeAt(i).toString(16).toUpperCase()).slice(-4); return '<' + h + '>'; };
    var nCat = moi(), nCay = moi(), nInfo = moi();
    var tenG = Object.keys(nguon.glyph).filter(function (k) { return nguon.glyph[k]; }), soG = {};
    tenG.forEach(function (k) { soG[k] = moi(); });
    var soA = nguon.anh.map(function () { return moi(); });
    var gsTen = Object.keys(nguon.gs), nGs = gsTen.length ? moi() : 0;
    var ds = trang.map(function () { return { n: moi(), nd: moi() }; });
    var viec = [];
    tenG.forEach(function (k) {
      var g = nguon.glyph[k];
      viec.push({ n: soG[k], dau: '<</Type/XObject/Subtype/Form/BBox[' + g.bbox.join(' ') + ']', du: enc.encode(g.nd) });
    });
    nguon.anh.forEach(function (a, i) { dat(soA[i], '<</Type/XObject/Subtype/Image/Width ' + a.w + '/Height ' + a.h + '/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ' + a.du.length + '>>', a.du); });
    if (nGs) dat(nGs, '<<' + gsTen.map(function (k) { return '/' + k + '<</Type/ExtGState/ca ' + so(nguon.gs[k]) + '/CA ' + so(nguon.gs[k]) + '>>'; }).join('') + '>>');
    var xo = '/XObject<<' + tenG.map(function (k) { return '/' + k + ' ' + soG[k] + ' 0 R'; }).join('') + nguon.anh.map(function (a, i) { return '/' + a.ten + ' ' + soA[i] + ' 0 R'; }).join('') + '>>';
    var tainguyen = '<<' + xo + (nGs ? '/ExtGState ' + nGs + ' 0 R' : '') + '>>';
    trang.forEach(function (t, j) {
      var hop = '[0 0 ' + so(t.w) + ' ' + so(t.h) + ']';
      dat(ds[j].n, '<</Type/Page/Parent ' + nCay + ' 0 R/MediaBox' + hop + '/TrimBox' + hop + '/BleedBox' + hop + '/Resources ' + tainguyen + '/Contents ' + ds[j].nd + ' 0 R>>');
      viec.push({ n: ds[j].nd, dau: '<<', du: enc.encode(t.noiDung) });
    });
    dat(nCay, '<</Type/Pages/Count ' + ds.length + '/Kids[' + ds.map(function (t) { return t.n + ' 0 R'; }).join(' ') + ']>>');
    var n0 = new Date(), p2 = function (x) { return ('0' + x).slice(-2); };
    dat(nInfo, '<</Title' + hex16(o.tieuDe) + '/Subject' + hex16(o.chuDe) + '/Keywords' + hex16(o.tuKhoa) + '/Creator' + hex16('audit-dc · Bảng thông tin') + '/Producer' + hex16('audit-dc · nét vẽ (chữ đã chuyển thành đường viền)') +
      '/CreationDate(D:' + n0.getFullYear() + p2(n0.getMonth() + 1) + p2(n0.getDate()) + p2(n0.getHours()) + p2(n0.getMinutes()) + p2(n0.getSeconds()) + ')>>');
    dat(nCat, '<</Type/Catalog/Pages ' + nCay + ' 0 R/PageLayout/SinglePage/ViewerPreferences<</PrintScaling/None/NumCopies ' + Math.max(1, o.soBan || 1) + '/Duplex/Simplex/PickTrayByPDFSize true/DisplayDocTitle true>>>>');
    return Promise.all(viec.map(function (v) {
      return nen(v.du).then(function (z) {
        var du = z && z.length < v.du.length ? z : v.du;
        dat(v.n, v.dau + (du === z ? '/Filter/FlateDecode' : '') + '/Length ' + du.length + '>>', du);
      });
    })).then(function () {
      var phan = [], dai = 0, viTri = [];
      var them = function (x) { var b = typeof x === 'string' ? enc.encode(x) : x; phan.push(b); dai += b.length; };
      them('%PDF-1.4\n'); them(new Uint8Array([37, 226, 227, 207, 211, 10]));
      for (var n = 1; n <= soObj; n++) {
        var ob = obj[n]; viTri[n] = dai; them(n + ' 0 obj\n' + ob.than);
        if (ob.du) { them('\nstream\n'); them(ob.du); them('\nendstream'); }
        them('\nendobj\n');
      }
      var xref = dai, x = 'xref\n0 ' + (soObj + 1) + '\n0000000000 65535 f \n';
      for (var k = 1; k <= soObj; k++) x += ('000000000' + viTri[k]).slice(-10) + ' 00000 n \n';
      them(x + 'trailer\n<</Size ' + (soObj + 1) + '/Root ' + nCat + ' 0 R/Info ' + nInfo + ' 0 R>>\nstartxref\n' + xref + '\n%%EOF\n');
      return new Blob(phan, { type: 'application/pdf' });
    });
  }

  /* API: dung(cacGoc[], wMm, hMm, meta) → Promise<{tep, thieu[]}> — mỗi gốc (.bttb đã xếp chữ xong, đang nằm trong trang) = 1 trang */
  window.BTT_VECTO = {
    tai: tai,
    dung: function (cacGoc, wMm, hMm, meta) {
      return tai().then(function () {
        var nguon = { glyph: {}, anh: [], gs: {} }, thieu = {};
        var trang = cacGoc.map(function (g) { var t = veTrang(g, wMm, hMm, nguon); t.thieu.forEach(function (x) { thieu[x] = 1; }); return t; });
        return vietPdf(trang, nguon, meta).then(function (tep) { return { tep: tep, thieu: Object.keys(thieu), soGlyph: Object.keys(nguon.glyph).length, soAnh: nguon.anh.length }; });
      });
    }
  };
})();
