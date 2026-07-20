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

## Import lệnh kiểm kê từ dashboard (PhysicalCountImport.gs)

Dashboard cho tick chọn SKU trong pop-up 2 tab (Kiểm kê + Tồn kho bất thường) rồi bấm
**Tạo lệnh kiểm kê** → dựng file `.xlsx` đúng template `WMS_INVENTORY_KEY_TEMPLATE_CP_CHECKLIST_SKU`
(mỗi SKU 1 dòng: Warehouse Code | Type | Sku | Plan Date | Executed By) và import lên WMS.

### Kiến trúc (ràng buộc thực tế quyết định)
- **WMS chặn IP ngoài** → GAS (IP Google) KHÔNG gọi được `wms-gw` (đã kiểm chứng: UrlFetch
  "Địa chỉ không khả dụng"; máy nội bộ gọi được bình thường).
- **Gateway mở CORS `*`** → TRÌNH DUYỆT operator (IP nội bộ) upload thẳng WMS được.
- → Phân vai: **GAS** dựng file `.xlsx` (`pc_import` dryRun) + phát token (`pc_token`) + ghi tab
  Warehouse code (`pc_save_whcode`); **trình duyệt** upload: `validate/type-sku` trước, đạt thì
  `import/type-sku`, đọc lỗi từng dòng (`error_message`) từ body WMS trả về.

### Endpoint WMS (trích từ bundle SPA — counting-plan = "CP" trong tên template)
```
base:      https://wms-gw.inshasaki.com/api/v1
validate:  POST /wms/counting-plan/checklists/validate/type-sku
import:    POST /wms/counting-plan/checklists/import/type-sku
           (multipart, file trong field "chunk"; import trang location: .../type-location)
template:  GET  /wms/counting-plan/checklists/download-template/type-sku
```

### Trạng thái triển khai (đã làm qua clasp — 2026-07-20)
- ✅ `PhysicalCountImport.js` đã push vào project 5S; router `pc_import / pc_token /
  pc_save_whcode / pc_sync_whcode / pc_set_key` đã nối vào `doPost` của `sa.js`;
  deployment `AKfycbzIE6E…` cập nhật version mới (URL web app KHÔNG đổi).
- ✅ `PC_KEY` đã đặt (TOFU qua `pc_set_key`; đổi khóa cần `oldKey`+`newKey`). Operator nhập
  khóa 1 lần trên dashboard (lưu localStorage) — khóa KHÔNG nằm trong mã nguồn trang.
- ✅ Tab `Warehouse code` đã tạo (seed `1436 | SHOP - 170 QUOC LO 1A`); danh mục 13 kho material
  đồng bộ bằng nút "⟳ Đồng bộ danh mục kho từ WMS" ngay trong modal (cần token WMS còn phiên).
- ✅ Test end-to-end phần GAS: `pc_import` dryRun trả file `.xlsx` chuẩn (header + dòng text đúng
  thứ tự cột); `pc_token`, `pc_save_whcode` hoạt động.
- ⚠️ **Token WMS 1 phiên/tài khoản** (`auth_session_displaced`): token robot chết khi có đăng nhập
  đè. Import thất bại 401 → dashboard tự tải file `.xlsx` về để import tay + hướng dẫn chạy lại
  sau khi robot đăng nhập (cụm 7h / LOGIN-HASAKI).
- (Khuyến nghị) Template gốc: upload `.xlsx` lên Drive → mở bằng Google Sheets → copy ID →
  `PC_TEMPLATE_SHEET_ID` (script sẽ COPY template mà điền, giữ nguyên tên sheet + sheet tham chiếu).

### Script Properties
| Property | Bắt buộc | Giá trị |
|---|---|---|
| `PC_KEY` | ✅ (đã đặt) | khóa riêng cho action `pc_*` — chính sách "đụng token WMS phải khóa", không dùng chung SECRET 5S |
| `PC_TEMPLATE_SHEET_ID` | — | ID bản Google Sheets của template gốc |
| `PC_FILE_NAME` | — | mặc định `WMS_INVENTORY_KEY_TEMPLATE_CP_CHECKLIST_SKU.xlsx` |
| `PC_MAX_ROWS` | — | trần số dòng 1 lệnh, mặc định 5000 |
| `PC_WAREHOUSE_IDS` / `PC_COMPANY_IDS` | — | danh sách id cho đồng bộ tab Warehouse code (mặc định = union cấu hình 5S) |
| `PC_IMPORT_URL` / `PC_FILE_FIELD` | (bỏ) | chỉ dùng nếu sau này WMS mở IP cho GAS upload trực tiếp |

### Tab `Warehouse code`
4 cột: Warehouse Code | Warehouse Name | Type | City Name. Dashboard tra mã kho theo TÊN kho
của từng dòng SKU; dòng không khớp bị chặn import và báo đỏ kèm nút đồng bộ. **Merge an toàn**:
dòng dán tay giữ nguyên, mã trùng chỉ cập nhật tên, chạy lại lúc nào cũng được. *SKU type không
cần tab riêng* (quy ước cố định: SKU = 1, SKU factory = 2, đã nhúng trong dashboard).

### Phân loại lỗi hiển thị trên dashboard
- `Lỗi trung gian (config|build|auth)` = lỗi phía GAS/khóa/token.
- `WMS từ chối (validate|import)` = WMS trả lỗi — hiện message + ghi chú lỗi TỪNG DÒNG
  (`error_message`) từ body WMS; đồng thời tự tải file `.xlsx` về làm phương án import tay.

## Mở rộng work / hr
Module đăng nhập ở đây (refresh-token → access_token của `wms-gw`) tái dụng được cho các
hệ khác **cùng cụm SSO**. Khi làm dashboard work/hr, chỉ cần đổi `API_BASE` + đường dẫn
báo cáo tương ứng của từng hệ (nếu chúng dùng chung gateway `*-gw.inshasaki.com` và cùng
refresh-token) hoặc bổ sung refresh-token riêng cho từng hệ. Các endpoint hiện chưa xác
minh cho work/hr nên chưa gộp vào file này — cần URL báo cáo cụ thể của 2 hệ đó.

## Bảo mật
- `refresh_token` là bí mật — chỉ nằm trong Script Properties (không commit, không để trong `index.html`).
- Nếu lộ hoặc job báo lỗi refresh hết hạn: đăng nhập lại trên trình duyệt, lấy token mới, cập nhật `WMS_REFRESH_TOKEN`.
