// sync.mjs — Đăng nhập WMS (SSO + TOTP) → lấy dữ liệu stock-location 2 công ty
// → ghi vào Google Sheet (tab MTG + Garment). Chạy hằng ngày trên GitHub Actions.
import puppeteer from 'puppeteer';
import * as OTPAuth from 'otpauth';
import { google } from 'googleapis';

const {
  WMS_USERNAME, WMS_PASSWORD, WMS_2FA_SECRET,
  GOOGLE_SERVICE_ACCOUNT_JSON,
  SHEET_ID = '1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs'
} = process.env;

const API = 'https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-locations/bins/count/v3';
const LOGIN_URL = 'https://wms.inshasaki.com/auth/login';
const HOME_URL = 'https://wms.inshasaki.com/';

// Cấu hình 2 tab (company + warehouse_ids). Có thể chỉnh khi WMS đổi kho.
const TARGETS = [
  { tab: 'MTG',     company: 1002, warehouses: '1458,1441,1307,1250,1179,1178,1177,1151' },
  { tab: 'Garment', company: 1005, warehouses: '1516,1341,1340,1339,1266' },
];

const HEADER = ['SKU','Barcode','ProductName','LocationDescription','BrandName','CategoryName','Warehouse',
  'InbinQuantity','PicklistedQuantity','PickingQuantity','NotfoundQuantity','PackedQuantity','Total',
  'Created Date','Updated Date','StorageTypeName','ClassifyName','Shelf Life (month)'];

function log(...a){ console.log(new Date().toISOString().slice(11,19), ...a); }
function must(v,name){ if(!v) throw new Error('Thiếu biến môi trường: '+name); return v; }

// ---------- 1) Đăng nhập lấy token ----------
async function getToken(){
  must(WMS_USERNAME,'WMS_USERNAME'); must(WMS_PASSWORD,'WMS_PASSWORD'); must(WMS_2FA_SECRET,'WMS_2FA_SECRET');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  try{
    log('Mở trang login…');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });
    // Bấm "Đăng nhập bằng SSO"
    await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/SSO/i.test(x.innerText)); if(b) b.click(); });
    // Bước 1: email/username
    await page.waitForSelector('input[name="email"]', { timeout: 45000 });
    log('Nhập username…');
    await page.type('input[name="email"]', WMS_USERNAME, { delay: 20 });
    await clickNext(page);
    // Bước 2: password
    await page.waitForSelector('input[type="password"]', { timeout: 45000 });
    log('Nhập password…');
    await page.type('input[type="password"]', WMS_PASSWORD, { delay: 20 });
    await clickNext(page);
    // Bước 3: OTP (TOTP)
    await fillOtp(page);
    // Chờ quay lại app + token xuất hiện trong localStorage.auth_store
    log('Chờ token…');
    const token = await waitForToken(page);
    if(!token) throw new Error('Không lấy được token sau đăng nhập');
    log('Đăng nhập OK, đã có token.');
    return token;
  }catch(e){
    try{ await page.screenshot({ path: 'login-error.png', fullPage: true }); log('Đã lưu login-error.png'); }catch(_){}
    throw e;
  }finally{
    await browser.close();
  }
}

async function clickNext(page){
  // Ưu tiên nút submit/Continue; fallback Enter
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button,[type=submit]')]
      .find(x => x.type==='submit' || /continue|tiếp tục|next|đăng nhập|verify|xác nhận/i.test((x.innerText||'')));
    if(b){ b.click(); return true; } return false;
  });
  if(!clicked) await page.keyboard.press('Enter');
  await new Promise(r=>setTimeout(r,1500));
}

async function fillOtp(page){
  const code = new OTPAuth.TOTP({
    algorithm:'SHA1', digits:6, period:30,
    secret: OTPAuth.Secret.fromBase32(WMS_2FA_SECRET.replace(/\s+/g,''))
  }).generate();
  log('Sinh OTP:', code.replace(/\d/g,'•'));
  // Chờ ô OTP xuất hiện (một input, hoặc nhiều ô 1 ký tự)
  await page.waitForFunction(() => {
    const ins = [...document.querySelectorAll('input')].filter(i => i.offsetParent!==null && i.type!=='password' && i.name!=='email');
    return ins.length>=1;
  }, { timeout: 30000 }).catch(()=>{});
  const boxes = await page.$$('input');
  const visible = [];
  for(const h of boxes){ const v = await h.evaluate(el => el.offsetParent!==null && el.type!=='password' && el.name!=='email'); if(v) visible.push(h); }
  if(visible.length >= 6){
    for(let i=0;i<6;i++){ await visible[i].type(code[i], { delay: 40 }); }
  }else if(visible.length >= 1){
    await visible[0].click({clickCount:3}); await visible[0].type(code, { delay: 40 });
  }else{
    throw new Error('Không tìm thấy ô nhập OTP');
  }
  await clickNext(page);
}

async function waitForToken(page){
  for(let i=0;i<40;i++){
    const url = page.url();
    if(/wms\.inshasaki\.com/.test(url)){
      const tok = await page.evaluate(() => {
        const raw = localStorage.getItem('auth_store') || '';
        const m = raw.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/);
        return m ? m[0] : null;
      }).catch(()=>null);
      if(tok) return tok;
    }
    await new Promise(r=>setTimeout(r,1500));
    // nếu chưa về app, thử điều hướng về home để đọc localStorage
    if(i===10){ try{ await page.goto(HOME_URL, { waitUntil:'networkidle2' }); }catch(_){}}
  }
  return null;
}

// ---------- 2) Lấy dữ liệu ----------
async function fetchAll(company, warehouses, token){
  const size = 1000; let page = 1, all = [], count = Infinity;
  while(all.length < count){
    const url = `${API}?company_ids=${company}&ignore_zero_total=1&page=${page}&size=${size}&warehouse_ids=${warehouses}`;
    const r = await fetch(url, { headers: { Authorization: 'Bearer '+token, Accept: 'application/json' } });
    if(!r.ok) throw new Error(`API ${r.status} (company ${company}, page ${page})`);
    const j = await r.json();
    count = j.count ?? 0;
    const recs = j.records || [];
    all.push(...recs);
    log(`  company ${company}: page ${page} → +${recs.length} (tổng ${all.length}/${count})`);
    if(!recs.length) break;
    page++;
    if(page > 500) break; // an toàn
  }
  return all;
}

function toRow(r){
  return [ r.sku ?? '', '', r.product_name ?? '', r.location_description ?? '', r.brand_name ?? '',
    r.category_name ?? '', r.warehouse_name ?? '', r.count_inbin ?? '', '', '', '', '', r.quantity ?? 0,
    r.created_at ?? '', r.updated_at ?? '', r.storage_type_name ?? '', r.product_type_name ?? '', '' ];
}

// ---------- 3) Ghi Google Sheet ----------
function sheetsClient(){
  const creds = JSON.parse(must(GOOGLE_SERVICE_ACCOUNT_JSON,'GOOGLE_SERVICE_ACCOUNT_JSON'));
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}
async function writeTab(sheets, tab, dataRows){
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `${tab}!A:R` });
  await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${tab}!A1`, valueInputOption:'RAW', requestBody: { values: [HEADER] } });
  const CH = 10000; let pos = 2;
  for(let i=0;i<dataRows.length;i+=CH){
    const chunk = dataRows.slice(i, i+CH);
    await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${tab}!A${pos}`, valueInputOption:'RAW', requestBody: { values: chunk } });
    pos += chunk.length;
  }
  log(`  ✓ Ghi ${dataRows.length} dòng vào tab "${tab}"`);
}

// ---------- main ----------
(async () => {
  log('=== BẮT ĐẦU đồng bộ WMS → Google Sheet ===');
  const token = await getToken();
  const sheets = sheetsClient();
  for(const t of TARGETS){
    log(`Lấy dữ liệu ${t.tab} (company ${t.company})…`);
    const recs = await fetchAll(t.company, t.warehouses, token);
    await writeTab(sheets, t.tab, recs.map(toRow));
  }
  log('=== HOÀN TẤT ===');
  process.exit(0);
})().catch(e => { console.error('LỖI:', e.message); process.exit(1); });
