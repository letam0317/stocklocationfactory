/* sw.js — service worker của dashboard Audit Factory (audit 23/08/2026).
 *
 * VÌ SAO CÓ: mất mạng + F5 = TRẮNG TRANG, mất 100% dashboard — trong khi lõi Nhận diện SKU vốn đã
 * offline-ready (mã vạch + chỉ mục IndexedDB). Chỉ cần trang HTML còn mở được là các đường offline
 * đó dùng được tiếp.
 *
 * VÌ SAO NETWORK-FIRST chứ KHÔNG cache-first (đề xuất gốc của audit là cache-first — đã bác):
 * dự án deploy bản mới liên tục (push repo là ra bản mới); cache-first nghĩa là người dùng bị
 * ĐÓNG BĂNG ở bản cũ sau mỗi lần deploy — có mạng vẫn xem bản cũ. Network-first thì có mạng luôn
 * là bản mới nhất (y như không có SW), chỉ khi MẤT MẠNG mới rơi về bản đã cất.
 *
 * Chỉ đụng GET cùng origin (trang + tài nguyên tĩnh của chính site). gviz/GAS/fonts đi thẳng mạng
 * như cũ — không cache dữ liệu, số liệu không bao giờ là bản nguội từ SW. */
var CACHE = 'slf-v1';
var SHELL = ['./', './index.html'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;   // gviz / GAS / CDN: đi thẳng mạng, không nhúng tay
  e.respondWith(
    fetch(req).then(function (r) {
      // Mạng sống: dùng bản mạng + cất một bản cho lúc mất mạng (best-effort)
      if (r && r.ok) {
        var cop = r.clone();
        caches.open(CACHE).then(function (c) { c.put(req, cop); }).catch(function () {});
      }
      return r;
    }).catch(function () {
      // Mất mạng: trả bản đã cất; điều hướng (F5 cả trang) thì lùi về index.html
      return caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
