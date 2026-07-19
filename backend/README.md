# Backend — Đồng bộ "Tồn kho bất thường" (7h sáng)

Tab **Tồn kho bất thường** trong `index.html` đọc dữ liệu từ tab Google Sheet
`stock-inventory-beta`. File `StockAbnormalSync.gs` là job Google Apps Script kéo báo
cáo WMS về ghi vào tab đó, chạy tự động **mỗi ngày 07:00 (giờ VN)**.

## Vì sao cần backend (không gọi thẳng từ trình duyệt)?
- API WMS đòi **Bearer token** (không có token → `401 API token required`).
- WMS ở khác origin → trình duyệt bị **CORS** chặn đọc.
- Đăng nhập là **SSO/OIDC liên kết IdP** → không thể login user/mật khẩu kiểu headless.

→ Giải pháp chuẩn & bền vững: đăng nhập **1 lần** trên trình duyệt để lấy
`refresh_token` (token dài hạn), lưu server-side; job dùng nó gọi
`POST /auth/user/refresh-token` để đổi lấy `access_token` mới mỗi lần chạy
(hệ thống **xoay vòng** refresh_token — script tự lưu đè token mới).

## Luồng dữ liệu
```
07:00 mỗi ngày ─▶ Apps Script (StockAbnormalSync.gs)
   ├─ getAccessToken_()  POST https://wms-gw.inshasaki.com/api/v1/auth/user/refresh-token  {refresh_token}
   │                     → { access_token, refresh_token(mới) }
   ├─ fetchStockPage_()  GET  https://wms-gw.inshasaki.com/api/v2/wms/report-management/stock-inventories
   │                          ?company_ids=1002&page=N&size=200   (Authorization: Bearer …)
   ├─ lọc product_type = Normal  &  giữ dòng có ≥1 chỉ số bất thường > 0
   └─ ghi vào Sheet tab `stock-inventory-beta`
                          ▲
   index.html (gviz) ─────┘  tab "Tồn kho bất thường" tự hiển thị
```

## Cài đặt (một lần)

### 1. Lấy `refresh_token` từ trình duyệt
1. Đăng nhập WMS bình thường: `https://wms.inshasaki.com`.
2. Mở **DevTools → Network**, lọc `refresh-token` (hoặc reload trang).
3. Mở request `POST …/auth/user/refresh-token` → tab **Response** → copy giá trị
   `refresh_token`. (Hoặc trong **Application → Local Storage / Cookies** tuỳ hệ.)

### 2. Tạo / mở Apps Script project
- Cách A (khuyến nghị): dùng **chính project Apps Script đang chạy `force_sync_wms`**
  (đã có sẵn cơ chế token) — thêm file `StockAbnormalSync.gs` vào đó. Nếu project đó đã
  lưu refresh_token ở Script Property khác, chỉ cần đảm bảo `WMS_REFRESH_TOKEN` trỏ đúng.
- Cách B: tạo project mới tại https://script.google.com → dán nội dung `StockAbnormalSync.gs`.

### 3. Khai báo Script Properties
`Project Settings (⚙) → Script properties → Add script property`:

| Property | Bắt buộc | Giá trị |
|---|---|---|
| `WMS_REFRESH_TOKEN` | ✅ | refresh_token lấy ở bước 1 |
| `SHEET_ID` | — | mặc định `1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs` |
| `WMS_COMPANY_IDS` | — | mặc định `1002` |
| `ABN_SHEET` | — | mặc định `stock-inventory-beta` |
| `WMS_PAGE_SIZE` | — | mặc định `200` |
| `TZ` | — | mặc định `Asia/Ho_Chi_Minh` |

Đặt timezone project: `Project Settings → Time zone → (GMT+07:00) Asia/Ho_Chi_Minh`.

### 4. Chạy thử + cấp quyền
- Chọn hàm **`syncStockAbnormal`** → **Run**. Lần đầu Google hỏi cấp quyền
  (UrlFetch + Sheets) → Cho phép. Xong mở Sheet kiểm tra tab `stock-inventory-beta`.

### 5. Bật lịch 7h sáng
- Chọn hàm **`installDailyTrigger`** → **Run**. Job sẽ tự chạy ~07:00 mỗi ngày.
- Gỡ lịch: chạy `removeDailyTrigger`.

## Kiểm tra
- Script Property `WMS_ABN_LAST_SYNC` ghi mốc + số dòng của lần chạy gần nhất.
- Mở dashboard → tab **Tồn kho bất thường** → phải thấy dữ liệu (thay cho thông báo
  "chưa có dữ liệu").

## Mở rộng work / hr
Module đăng nhập ở đây (refresh-token → access_token của `wms-gw`) tái dụng được cho các
hệ khác **cùng cụm SSO**. Khi làm dashboard work/hr, chỉ cần đổi `API_BASE` + đường dẫn
báo cáo tương ứng của từng hệ (nếu chúng dùng chung gateway `*-gw.inshasaki.com` và cùng
refresh-token) hoặc bổ sung refresh-token riêng cho từng hệ. Các endpoint hiện chưa xác
minh cho work/hr nên chưa gộp vào file này — cần URL báo cáo cụ thể của 2 hệ đó.

## Bảo mật
- `refresh_token` là bí mật — chỉ nằm trong Script Properties (không commit, không để trong `index.html`).
- Nếu lộ hoặc job báo lỗi refresh hết hạn: đăng nhập lại trên trình duyệt, lấy token mới, cập nhật `WMS_REFRESH_TOKEN`.
