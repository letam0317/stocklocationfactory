# WMS Token Bridge — extension cho dashboard Factory

Mục đích: cho phép **Import 1-click ghi đúng tên người thao tác** và **không bao giờ đá phiên** WMS
của bạn. Extension chạy trong chính trình duyệt bạn, "nghe" token phiên WMS bạn đang dùng rồi đưa
cho dashboard — **không đăng nhập lại, không tạo phiên mới, không tab ẩn**.

## Vì sao cần
- API WMS ghi `created_by` = chủ token upload; muốn ghi tên bạn thì phải upload bằng token của bạn.
- Trang dashboard (github.io) không đọc được token WMS (khác origin) → cần extension làm cầu nối.
- Token của bạn nằm trong bộ nhớ SPA + header `Authorization`; extension chỉ QUAN SÁT header đó
  (không can thiệp, không đăng nhập) → không thể đá phiên ai.

## Cài (1 lần/máy — Edge hoặc Chrome)
1. Tải cả thư mục `wms-bridge/` về máy (giữ nguyên 3 file: manifest.json, background.js, bridge.js).
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
- `host_permissions: wms-gw.inshasaki.com` — để nghe header Authorization của chính bạn.
- `webRequest` (chỉ QUAN SÁT `onSendHeaders`, không chặn/sửa), `storage` (nhớ token mới nhất trong phiên).
- Content script chỉ chạy trên trang dashboard `letam0317.github.io` để làm cầu nối.
- Token chỉ lưu tạm trong `storage.session` (mất khi đóng trình duyệt), không gửi đi đâu ngoài WMS.

## Riêng tư / an toàn
Extension không đăng nhập hộ, không đọc mật khẩu, không gửi token ra ngoài. Nó chỉ chuyển token
phiên hiện tại của bạn cho dashboard cùng máy để tạo lệnh dưới danh nghĩa bạn.
