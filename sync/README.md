# Tự động đồng bộ WMS → Google Sheet (mỗi ngày 7:00 sáng VN)

Job GitHub Actions `daily-sync.yml` sẽ: đăng nhập WMS (SSO + tự sinh OTP) → gọi API
stock-location cho **Mastige (company 1002)** và **Garment (company 1005)** → ghi vào
2 tab `MTG` / `Garment` của Google Sheet. Dashboard đọc live nên tự cập nhật.

## Cần cài đặt 1 lần

### 1) Tạo Service Account để ghi Google Sheet
1. Vào https://console.cloud.google.com/ → tạo (hoặc chọn) 1 project.
2. **APIs & Services → Library** → bật **Google Sheets API**.
3. **APIs & Services → Credentials → Create credentials → Service account** → đặt tên → Done.
4. Mở service account vừa tạo → tab **Keys → Add key → Create new key → JSON** → tải file JSON về.
5. Mở Google Sheet `stocklocationfactory` → **Share** → dán email service account
   (dạng `ten-sa@ten-project.iam.gserviceaccount.com`) → quyền **Editor** → Send.

### 2) Thêm GitHub Secrets
Repo `letam0317/stocklocationfactory` → **Settings → Secrets and variables → Actions →
New repository secret**, thêm 4 secret:

| Tên secret | Giá trị |
|---|---|
| `WMS_USERNAME` | tài khoản đăng nhập WMS (vd `tam.le`) |
| `WMS_PASSWORD` | mật khẩu WMS |
| `WMS_2FA_SECRET` | khoá base32 khi quét QR Authenticator (KHÔNG phải mã 6 số) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | dán **toàn bộ nội dung** file JSON ở bước 1 |

### 3) Chạy thử
Tab **Actions** → chọn **Daily WMS stock-location sync** → **Run workflow**.
Xem log; nếu đăng nhập lỗi, job sẽ đính kèm ảnh `login-error.png` để chẩn đoán.

## Lịch chạy
- Tự động **00:00 UTC = 07:00 VN** mỗi ngày (sửa dòng `cron` trong `.github/workflows/daily-sync.yml`).
- Có thể bấm **Run workflow** để chạy tay bất cứ lúc nào.

## Đổi kho/công ty
Sửa mảng `TARGETS` trong `sync/sync.mjs` (company + danh sách warehouse_ids).
