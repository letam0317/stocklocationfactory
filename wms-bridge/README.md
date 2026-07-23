# WMS Token Bridge — extension cho dashboard Factory

Mục đích: cho phép **Import 1-click ghi đúng tên người thao tác** và **không bao giờ đá phiên** WMS
của bạn. Extension chạy trong chính trình duyệt bạn, "nghe" token phiên WMS bạn đang dùng rồi đưa
cho dashboard — **không đăng nhập lại, không tạo phiên mới, không tab ẩn**.

**Mới (21/07/2026):** token còn được đẩy lên Apps Script của dự án để **máy trạm đồng bộ dùng lại
phiên đang sống của bạn** thay vì tự re-login SSO — vì WMS chỉ cho 1 phiên/tài khoản, re-login của
máy trạm là bạn bị văng. Cài extension này trên máy có mở WMS = hết bị văng trong giờ làm, đồng thời
nút "Tải lại dữ liệu" trên dashboard chạy được cả trong giờ làm việc.

**v1.2.0 (22/07/2026):** thêm kênh nghe token **ngay trong trang WMS** (`wms-main-hook.js` hook
fetch/XHR ở MAIN world + `wms-relay.js` chuyển về background). Kênh webRequest cũ hay HỤT vì
service worker MV3 ngủ sau ~30 giây; kênh mới không bao giờ lỡ và mỗi lần báo token còn tự đánh
thức service worker dậy đẩy GAS.

**v1.3.0 (23/07/2026) — GIỮ TOKEN SỐNG CHỦ ĐỘNG:** trước đây extension bắt token thụ động (chỉ
tóm khi SPA tự bắn request) và cứ 3 phút NHẮC LẠI đúng chuỗi cũ mà không kiểm còn sống hay không —
nên khi bạn bị đá phiên (ai đó đăng nhập), nó vẫn đẩy **token đã chết** lên máy trạm → sáng 23/07
cụm 8h40 hoãn, dữ liệu đứng im dù bạn đang mở WMS. Bản này thêm:
- **Tự kiểm mỗi 2 phút** (`chrome.alarms`): tự gọi `get-me` với token đang giữ — chạy đều **kể cả
  khi tab WMS đứng yên**, không phụ thuộc SPA có bắn request hay không.
- **Chỉ đẩy token đã xác thực sống** (get-me 200) lên máy trạm — không bao giờ đẩy xác chết nữa.
- Token **chết (401/403) → ngừng đẩy + xoá**, dashboard hiện "mở lại WMS" thay vì tưởng còn sống.
  Khi bạn thao tác tiếp, SPA cấp token mới → hook bắt lại → tự lành.

**Máy đã cài bản cũ phải bấm Reload (↻) trong `edge://extensions` và mở lại tab WMS** thì bản mới
mới có hiệu lực (v1.3.0 thêm quyền `alarms`).

## Vì sao cần
- API WMS ghi `created_by` = chủ token upload; muốn ghi tên bạn thì phải upload bằng token của bạn.
- Trang dashboard (github.io) không đọc được token WMS (khác origin) → cần extension làm cầu nối.
- Token của bạn nằm trong bộ nhớ SPA + header `Authorization`; extension chỉ QUAN SÁT header đó
  (không can thiệp, không đăng nhập) → không thể đá phiên ai.

## Cài (1 lần/máy — Edge hoặc Chrome)
1. Tải cả thư mục `wms-bridge/` về máy (giữ nguyên 5 file: manifest.json, background.js, bridge.js, wms-main-hook.js, wms-relay.js — README không bắt buộc).
2. Mở `edge://extensions` (hoặc `chrome://extensions`).
3. Bật **Developer mode** (góc phải).
4. Bấm **Load unpacked** → chọn thư mục `wms-bridge`.
5. Xong. Không cần cấu hình gì.

> Triển khai cho nhiều máy: có thể đóng gói `.crx` hoặc đẩy qua chính sách nhóm (Edge/Chrome
> ExtensionInstallForcelist) trỏ tới thư mục/nguồn nội bộ. Hỏi IT nếu muốn cài hàng loạt.

## Dùng
1. Mở 1 tab **wms.inshasaki.com**, đăng nhập bằng **tài khoản của chính bạn**, thao tác vài giây
   (để extension nghe được token).
2. Mở dashboard Factory → tab Kiểm kê / Tồn kho bất thường → chọn SKU → **Tạo lệnh kiểm kê**.
3. Trong modal sẽ xuất hiện nút **⚡ Import bằng tài khoản của bạn**. Bấm → lệnh lên WMS ngay,
   `created_by` = bạn, không đá phiên tab WMS bạn đang mở.
4. Không cài extension vẫn dùng được: nút **⬇ Tải file .xlsx** → tự import trong WMS (cũng ghi tên bạn).

## Quyền extension (tối thiểu)
- `host_permissions: wms-gw.inshasaki.com` — để nghe header Authorization của chính bạn + tự gọi `get-me` kiểm token còn sống.
- `webRequest` (chỉ QUAN SÁT `onSendHeaders`, không chặn/sửa), `storage` (nhớ token mới nhất trong phiên), `alarms` (hẹn giờ 2 phút tự kiểm token — v1.3.0).
- Content script trên `letam0317.github.io` (cầu nối dashboard) và `wms.inshasaki.com`
  (chỉ QUAN SÁT header Authorization của fetch/XHR — không sửa request, không đăng nhập).
- Token chỉ lưu tạm trong `storage.session` (mất khi đóng trình duyệt), không gửi đi đâu ngoài WMS.

## Riêng tư / an toàn
Extension không đăng nhập hộ, không đọc mật khẩu, không gửi token ra ngoài. Nó chỉ chuyển token
phiên hiện tại của bạn cho dashboard cùng máy để tạo lệnh dưới danh nghĩa bạn.
