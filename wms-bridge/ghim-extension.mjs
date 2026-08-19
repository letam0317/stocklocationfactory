/**
 * ghim-extension.mjs — GHIM CẦU NỐI VÀO EDGE ĐỂ KHÔNG TẮT ĐƯỢC NỮA (11/08/2026).
 *
 *  VÌ SAO CÓ FILE NÀY — sự cố 11/08/2026:
 *  extension này vốn nạp kiểu "Load unpacked", mà unpacked thì SỐNG NHỜ Chế độ nhà phát triển.
 *  Edge tắt chế độ đó (khởi động lại, cập nhật, một cú bấm "Tắt") là extension chết theo —
 *  hôm 11/08 nó tắt lúc ~13:00, token WMS bị thu hồi 13:03, và vì không còn ai nghe token nên
 *  dữ liệu WMS đứng im 5 tiếng. Không có đường tự lành: bot không sinh được OTP nữa.
 *
 *  CÁCH CHỮA GỐC: đóng gói thành .crx (khoá cố định → ID cố định) rồi khai bằng POLICY
 *  `ExtensionInstallForcelist` của Edge. Extension do policy cài thì:
 *    • Edge TỰ CÀI LẠI mỗi lần khởi động, không cần Chế độ nhà phát triển;
 *    • người dùng KHÔNG có nút Tắt/Xoá (Edge ghi "Được cài bởi quản trị viên");
 *    • không còn phụ thuộc folder mã nguồn có bị di chuyển hay không.
 *  Policy ghi vào HKCU (không cần quyền admin) — chỉ áp cho chính người dùng này.
 *
 *  DÙNG:
 *    node ghim-extension.mjs          → đóng gói + ghim (chạy lại nhiều lần vô hại)
 *    node ghim-extension.mjs --bo     → tháo ghim (xoá policy, giữ file .crx)
 *    node ghim-extension.mjs --xem    → chỉ xem trạng thái hiện tại
 *
 *  SAU KHI GHIM: khởi động lại Edge (hoặc edge://policy → "Reload policies"), rồi vào
 *  edge://extensions XOÁ bản unpacked cũ — để khỏi có hai bản cùng nghe token.
 *
 *  KHOÁ RIÊNG (.pem) là danh tính của extension: mất nó thì bản cập nhật sau sẽ có ID khác và
 *  policy cũ trỏ vào chỗ trống. Nó nằm trong `wms-bridge-ghim/` và đã được .gitignore — KHÔNG commit.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { docTrangThaiExt } from "../../hasaki/trang-thai-bridge.js";

const NGUON = path.dirname(fileURLToPath(import.meta.url));            // …/factory/wms-bridge
const KHO = path.join(path.dirname(NGUON), "wms-bridge-ghim");         // …/factory/wms-bridge-ghim
const F_CRX = path.join(KHO, "wms-bridge.crx");
const F_PEM = path.join(KHO, "wms-bridge.pem");
const F_XML = path.join(KHO, "update.xml");
const KHOA_REG = "HKCU\\SOFTWARE\\Policies\\Microsoft\\Edge\\ExtensionInstallForcelist";

const BO = process.argv.includes("--bo");
const CHI_XEM = process.argv.includes("--xem");
const log = (...a) => console.log(...a);

/* ───────────────────────── tiện ích ───────────────────────── */

function timEdge() {
  const ung = [
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  for (const p of ung) if (p && fs.existsSync(p)) return p;
  try { return execFileSync("where.exe", ["msedge"], { encoding: "utf8" }).split(/\r?\n/)[0].trim() || null; } catch { return null; }
}

/* ID extension của Chromium = 32 ký tự đầu của SHA256(public key dạng DER), mỗi chữ số hex đổi
 * sang chữ a..p. Tính được từ .pem nên biết ID TRƯỚC khi cài — điều kiện bắt buộc để khai policy. */
function idTuKhoa(pem) {
  const der = crypto.createPublicKey({ key: pem, format: "pem" }).export({ type: "spki", format: "der" });
  const bam = crypto.createHash("sha256").update(der).digest("hex").slice(0, 32);
  return [...bam].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
}

const docPhienBan = () => JSON.parse(fs.readFileSync(path.join(NGUON, "manifest.json"), "utf8")).version;

function regDoc() {
  try {
    // stdio pipe cả 3 luồng: chưa ghim thì reg.exe in "unable to find..." ra stderr — đó là ca
    // BÌNH THƯỜNG, không phải lỗi, đừng để nó lọt lên màn hình làm người đọc tưởng hỏng.
    const ra = execFileSync("reg.exe", ["query", KHOA_REG], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    return ra.split(/\r?\n/).map((d) => d.trim()).filter((d) => /REG_SZ/.test(d))
      .map((d) => { const [ten, , ...gt] = d.split(/\s{2,}|\t+/); return { ten, giaTri: gt.join(" ") }; });
  } catch { return []; }   // chưa có khoá = chưa ghim
}

/* ───────────────────────── các bước ───────────────────────── */

/** Đóng gói .crx bằng chính Edge (`--pack-extension`). Lần đầu Edge tự sinh .pem, lần sau dùng lại. */
function dongGoi() {
  const edge = timEdge();
  if (!edge) throw new Error("Không tìm thấy msedge.exe — cần Edge để đóng gói .crx.");
  fs.mkdirSync(KHO, { recursive: true });

  // Edge ghi kết quả CẠNH folder nguồn: <parent>/wms-bridge.crx (+ .pem nếu chưa có khoá).
  const crxTam = path.join(path.dirname(NGUON), path.basename(NGUON) + ".crx");
  const pemTam = path.join(path.dirname(NGUON), path.basename(NGUON) + ".pem");
  for (const f of [crxTam, pemTam]) { try { fs.rmSync(f, { force: true }); } catch { /* không sao */ } }

  /* --user-data-dir tạm là BẮT BUỘC: nếu không, tham số bị chuyển vào tiến trình Edge đang chạy
   * và lệnh đóng gói im lặng không làm gì (bẫy đã gặp khi Edge đang mở). */
  const hoSoTam = fs.mkdtempSync(path.join(os.tmpdir(), "edge-pack-"));
  const args = ["--pack-extension=" + NGUON, "--user-data-dir=" + hoSoTam, "--no-first-run", "--no-default-browser-check"];
  if (fs.existsSync(F_PEM)) args.splice(1, 0, "--pack-extension-key=" + F_PEM);
  try { execFileSync(edge, args, { stdio: "pipe", timeout: 120000 }); } catch (e) { /* Edge trả mã lạ nhưng vẫn ghi file — xét bằng sự tồn tại của .crx */ }
  try { fs.rmSync(hoSoTam, { recursive: true, force: true }); } catch { /* dọn best-effort */ }

  if (!fs.existsSync(crxTam)) throw new Error("Edge không tạo được .crx (thử đóng hết cửa sổ Edge rồi chạy lại).");
  fs.copyFileSync(crxTam, F_CRX); fs.rmSync(crxTam, { force: true });
  if (fs.existsSync(pemTam)) {
    if (!fs.existsSync(F_PEM)) { fs.copyFileSync(pemTam, F_PEM); log("  ✓ Đã sinh khoá riêng mới: " + F_PEM); }
    fs.rmSync(pemTam, { force: true });
  }
  if (!fs.existsSync(F_PEM)) throw new Error("Thiếu khoá riêng .pem — không tính được ID cố định.");
  return { crx: F_CRX, pem: F_PEM };
}

/** Manifest cập nhật kiểu Omaha — Edge đọc file này để biết "cài bản nào, ở đâu". */
function ghiUpdateXml(id, phienBan) {
  const codebase = "file:///" + F_CRX.replace(/\\/g, "/");
  fs.writeFileSync(F_XML,
    "<?xml version='1.0' encoding='UTF-8'?>\n" +
    "<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>\n" +
    "  <app appid='" + id + "'>\n" +
    "    <updatecheck codebase='" + codebase + "' version='" + phienBan + "' />\n" +
    "  </app>\n" +
    "</gupdate>\n", "utf8");
  return F_XML;
}

/* Windows khoá HKCU\SOFTWARE\Policies cho riêng Administrators (người dùng chỉ được ĐỌC) — cố ý,
 * để người dùng thường không tự đặt policy cho mình. Tài khoản này CÓ trong nhóm Administrators
 * nhưng tiến trình không nâng quyền, nên cần đúng một lượt UAC. Truyền lệnh bằng --EncodedCommand
 * để đường dẫn có dấu cách ("New folder") không bị tách sai khi qua Start-Process. */
function ghiRegQuaAdmin(ten, giaTri) {
  const khoaPs = "HKCU:\\SOFTWARE\\Policies\\Microsoft\\Edge\\ExtensionInstallForcelist";
  const lenh = "New-Item -Path '" + khoaPs + "' -Force | Out-Null; "
    + "New-ItemProperty -Path '" + khoaPs + "' -Name '" + ten + "' -PropertyType String -Value '" + giaTri + "' -Force | Out-Null";
  fs.writeFileSync(path.join(KHO, "GHIM-CAN-QUYEN-ADMIN.ps1"), lenh + "\nWrite-Host 'Da ghim cau noi WMS.'\n", "utf8");
  const b64 = Buffer.from(lenh, "utf16le").toString("base64");
  execFileSync("powershell.exe", ["-NoProfile", "-Command",
    "Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-EncodedCommand','" + b64 + "'"],
    { stdio: "pipe", timeout: 180000 });
}

function ghim(id) {
  const giaTri = id + ";file:///" + F_XML.replace(/\\/g, "/");
  const cu = regDoc();
  /* Khớp cả theo ID lẫn theo đường dẫn update.xml: nếu khoá .pem bị mất và phải sinh khoá mới thì
   * ID đổi — không nhận ra mục cũ sẽ để lại một mục policy trỏ vào ID không còn tồn tại. */
  const trung = cu.find((v) => v.giaTri.startsWith(id + ";") || /wms-bridge-ghim/i.test(v.giaTri));
  const ten = trung ? trung.ten : String((cu.reduce((m, v) => Math.max(m, Number(v.ten) || 0), 0)) + 1);
  try {
    execFileSync("reg.exe", ["add", KHOA_REG, "/v", ten, "/t", "REG_SZ", "/d", giaTri, "/f"], { stdio: "pipe" });
  } catch (e) {
    log("  ⚠ Cần nâng quyền 1 lượt để ghi policy — hộp thoại UAC đang mở, bấm 'Yes'.");
    log("    (Chỉ ghi đúng 1 giá trị registry ở trên, không thay đổi gì khác.)");
    try { ghiRegQuaAdmin(ten, giaTri); } catch { /* bấm No / hết giờ — xử lý ở bước kiểm bên dưới */ }
    if (!regDoc().some((v) => v.giaTri.startsWith(id + ";"))) {
      throw new Error("Chưa ghi được policy (UAC bị từ chối?). Chạy tay 1 lần:\n"
        + "      chuột phải vào " + path.join(KHO, "GHIM-CAN-QUYEN-ADMIN.ps1") + " → Run with PowerShell (quyền Admin)");
    }
    log("  ✓ Đã ghi policy bằng quyền admin.");
  }
  return { ten, giaTri, giuLai: cu.filter((v) => v.ten !== ten) };
}

function thaoGhim() {
  const cu = regDoc().filter((v) => /wms-bridge/i.test(v.giaTri));
  if (!cu.length) return 0;
  try {
    for (const v of cu) execFileSync("reg.exe", ["delete", KHOA_REG, "/v", v.ten, "/f"], { stdio: "pipe" });
  } catch {
    // Xoá cũng cần quyền như ghi (cùng ACL) — mở UAC đúng một lượt, bấm Yes.
    log("  ⚠ Cần nâng quyền 1 lượt để xoá policy — bấm 'Yes' ở hộp thoại UAC.");
    const khoaPs = "HKCU:\\SOFTWARE\\Policies\\Microsoft\\Edge\\ExtensionInstallForcelist";
    const lenh = cu.map((v) => "Remove-ItemProperty -Path '" + khoaPs + "' -Name '" + v.ten + "' -Force -ErrorAction SilentlyContinue").join("; ");
    const b64 = Buffer.from(lenh, "utf16le").toString("base64");
    try {
      execFileSync("powershell.exe", ["-NoProfile", "-Command",
        "Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-EncodedCommand','" + b64 + "'"],
        { stdio: "pipe", timeout: 180000 });
    } catch { /* bấm No — số đếm dưới đây sẽ nói thật */ }
  }
  return cu.length - regDoc().filter((v) => /wms-bridge/i.test(v.giaTri)).length;
}

function inTrangThai() {
  const tt = docTrangThaiExt();
  log("  Trạng thái trong Edge : " + tt.vi + (tt.id ? " · id " + tt.id : ""));
  const cu = regDoc();
  log("  Policy ghim hiện có   : " + (cu.length ? cu.map((v) => v.ten + "=" + v.giaTri).join(" | ") : "(chưa có)"));
  log("  Gói .crx              : " + (fs.existsSync(F_CRX) ? F_CRX : "(chưa đóng gói)"));
}

/* ───────────────────────── luồng chính ───────────────────────── */

try {
  if (CHI_XEM) { log("Cầu nối WMS — trạng thái ghim:"); inTrangThai(); process.exit(0); }

  if (BO) {
    const n = thaoGhim();
    log(n ? "✓ Đã tháo " + n + " mục policy ghim. Khởi động lại Edge để nó nhả extension." : "– Không có mục policy nào của cầu nối để tháo.");
    inTrangThai();
    process.exit(0);
  }

  const phienBan = docPhienBan();
  log("Ghim cầu nối WMS vào Edge (v" + phienBan + ")...");
  dongGoi();
  const id = idTuKhoa(fs.readFileSync(F_PEM, "utf8"));
  log("  ✓ Đã đóng gói: " + F_CRX);
  log("  ✓ ID cố định : " + id);
  ghiUpdateXml(id, phienBan);
  const kq = ghim(id);
  log("  ✓ Đã khai policy: " + KHOA_REG + " → " + kq.ten + " = " + kq.giaTri);
  if (kq.giuLai.length) log("    (giữ nguyên " + kq.giuLai.length + " mục policy khác đã có sẵn)");

  log("");
  log("CÒN 2 VIỆC TAY (Edge chỉ đọc policy lúc khởi động):");
  log("  1) Đóng hết cửa sổ Edge rồi mở lại — hoặc vào edge://policy bấm 'Reload policies'.");
  log("  2) Vào edge://extensions: bản mới hiện chữ 'Được cài bởi quản trị viên' (không có nút Tắt).");
  log("     XOÁ bản unpacked cũ (bản có nút Xoá) để hai bản không cùng nghe token.");
  log("");
  log("Kiểm lại bất cứ lúc nào: node ghim-extension.mjs --xem");
  log("Muốn quay về như cũ    : node ghim-extension.mjs --bo");
} catch (e) {
  log("✗ " + (e && e.message ? e.message : String(e)));
  process.exitCode = 1;
}
