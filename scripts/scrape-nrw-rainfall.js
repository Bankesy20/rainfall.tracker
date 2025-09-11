const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { spawn } = require('child_process');

const NRW_STATION_URL = process.env.NRW_STATION_URL || 'https://rivers-and-seas.naturalresources.wales/Station/1099?parameterType=2';
const OUTPUT_NAME = process.env.NRW_OUTPUT_FILE || 'wales-1099.json';
const RANGE_DAYS = parseInt(process.env.NRW_RANGE_DAYS || '120', 10); // default ~4 months

const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');

async function ensureDirs() {
  for (const dir of [DATA_DIR, RAW_DIR]) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

async function launchBrowser() {
  let executablePath;
  // Prefer system Chrome on non-Linux (local dev), since @sparticuz/chromium is for AWS Lambda (Linux)
  if (process.platform === 'darwin') {
    const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    try { await fs.access(macChrome); executablePath = macChrome; } catch (_) { executablePath = undefined; }
  } else if (process.platform === 'win32') {
    const winChrome = process.env['PROGRAMFILES'] + '\\Google\\Chrome\\Application\\chrome.exe';
    try { await fs.access(winChrome); executablePath = winChrome; } catch (_) { executablePath = undefined; }
  }
  if (!executablePath) {
    try { executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || await chromium.executablePath(); } catch (_) { executablePath = undefined; }
  }
  const headlessOverride = process.env.HEADFUL === '1' ? false : undefined;
  const browser = await puppeteer.launch({
    args: chromium.args || ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: chromium.defaultViewport || { width: 1366, height: 900 },
    executablePath,
    headless: typeof headlessOverride === 'boolean' ? headlessOverride : (chromium.headless !== false ? true : false),
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  return { browser, page };
}

async function setDownload(page) {
  const cdp = await page.target().createCDPSession();
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: RAW_DIR });
}

async function clickByText(page, tag, text) {
  const handles = await page.$$(tag);
  for (const h of handles) {
    const v = (await page.evaluate(el => el.textContent || '', h)).trim();
    if (v.toLowerCase().includes(text.toLowerCase())) {
      await h.click();
      return true;
    }
  }
  return false;
}

async function exportCsv(page) {
  // Open page
  await page.goto(NRW_STATION_URL, { waitUntil: 'networkidle2', timeout: 60000 });

  // Some pages lazy load; wait a bit
  await page.waitForTimeout(3000);

  // Try to click "Export CSV" button under the graph
  const clicked = await clickByText(page, 'button', 'Export CSV') || await clickByText(page, 'a', 'Export CSV');
  if (!clicked) {
    // Fallback: try to open any visible modal trigger
    await page.keyboard.press('Escape');
    throw new Error('Could not find Export CSV button');
  }

  // Wait for modal contents
  await page.waitForTimeout(800);

  // Fill date range inputs within the modal
  const previousDayOnly = process.env.NRW_PREV_DAY === '1';
  let fromStr, toStr;
  if (previousDayOnly) {
    const target = dayjs().subtract(1, 'day');
    fromStr = target.format('DD/MM/YYYY');
    toStr = target.format('DD/MM/YYYY');
  } else {
    const to = dayjs();
    const from = to.subtract(RANGE_DAYS, 'day');
    fromStr = from.format('DD/MM/YYYY');
    toStr = to.format('DD/MM/YYYY');
  }

  // Try to locate two inputs inside the modal by role
  const inputs = await page.$$('div[role="dialog"] input, .modal input, .dialog input, input');
  let setCount = 0;
  for (const input of inputs) {
    const type = await page.evaluate(el => el.getAttribute('type') || '', input);
    const disabled = await page.evaluate(el => el.disabled, input);
    if (disabled) continue;
    if (type === 'text' || type === 'date' || type === null) {
      await input.click({ clickCount: 3 });
      await input.type(setCount === 0 ? fromStr : toStr, { delay: 10 });
      setCount++;
      if (setCount >= 2) break;
    }
  }

  // Click "Export data as CSV"
  await clickByText(page, 'button', 'Export data as CSV');

  // Wait for file to appear
  const before = new Set(fssync.readdirSync(RAW_DIR));
  const deadline = Date.now() + 30000;
  let downloaded = null;
  while (Date.now() < deadline) {
    const now = new Set(fssync.readdirSync(RAW_DIR));
    for (const f of now) {
      if (!before.has(f) && f.toLowerCase().endsWith('.csv')) {
        downloaded = path.join(RAW_DIR, f);
        break;
      }
    }
    if (downloaded) break;
    await new Promise(r => setTimeout(r, 500));
  }
  if (!downloaded) {
    throw new Error('CSV download did not complete');
  }

  const newName = path.join(RAW_DIR, `nrw-${dayjs().format('YYYYMMDD-HHmmss')}.csv`);
  await fs.rename(downloaded, newName);
  return newName;
}

async function processCsv(csvPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [path.join(__dirname, 'process-nrw-csv.js'), csvPath, OUTPUT_NAME], { stdio: 'inherit' });
    proc.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`process-nrw-csv exited with ${code}`)));
  });
}

async function run() {
  await ensureDirs();

  // Fallback: allow testing with a local CSV without launching a browser
  const localCsv = process.env.NRW_CSV;
  if (localCsv) {
    const abs = path.isAbsolute(localCsv) ? localCsv : path.join(process.cwd(), localCsv);
    console.log(`Using local CSV (no browser): ${abs}`);
    await processCsv(abs);
    console.log('Processed local NRW CSV successfully.');
    return;
  }

  // Default: drive the website to export CSV
  const { browser, page } = await launchBrowser();
  try {
    await setDownload(page);
    const csv = await exportCsv(page);
    await processCsv(csv);
    console.log('NRW rainfall scrape complete.');
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  run().catch((e) => {
    console.error('NRW scrape failed:', e.message);
    process.exit(1);
  });
}


