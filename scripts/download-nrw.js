const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

/**
 * Lightweight NRW downloader that avoids Puppeteer/Chromium.
 *
 * Strategy:
 * - Fetch the NRW station page HTML
 * - Extract the first CSV download link (href containing .csv)
 * - Resolve to absolute URL and download the CSV
 * - Process CSV via existing scripts/process-nrw-csv.js
 */

const NRW_STATION_ID = process.env.NRW_STATION_ID || '1099';
const STATION_URL = `https://rivers-and-seas.naturalresources.wales/station/${NRW_STATION_ID}`;

const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const PROCESSED_DIR = path.join(DATA_DIR, 'processed');
const PUBLIC_PROCESSED_DIR = path.join(__dirname, '..', 'public', 'data', 'processed');

async function ensureDirectoryExists(directoryPath) {
  try {
    await fsPromises.mkdir(directoryPath, { recursive: true });
  } catch (_) {
    // ignore
  }
}

async function extractCsvUrlFromHtml(html, baseUrl) {
  const candidates = [];

  // 1) Direct .csv hrefs
  {
    const re = /href\s*=\s*(["'])([^"'>]*\.csv[^"'>]*)\1/ig;
    let m;
    while ((m = re.exec(html)) !== null) {
      candidates.push(m[2]);
    }
  }

  // 2) Links with CSV export class names
  if (candidates.length === 0) {
    const reExportClass = /<a[^>]+class=(["'])[^"']*(export[^"']*csv|export-control--csv)[^"']*\1[^>]*href=(["'])([^"'>]+)\3/ig;
    let m;
    while ((m = reExportClass.exec(html)) !== null) {
      candidates.push(m[4]);
    }
  }

  // 3) Any href that includes export or download
  if (candidates.length === 0) {
    const reExport = /href\s*=\s*(["'])([^"'>]*(export|download)[^"'>]*)\1/ig;
    let m;
    while ((m = reExport.exec(html)) !== null) {
      candidates.push(m[2]);
    }
  }

  if (candidates.length === 0) return null;

  // Prefer more specific looking ones
  const prioritized = candidates.sort((a, b) => {
    const score = (s) => {
      let v = 0;
      const lower = s.toLowerCase();
      if (lower.includes('.csv')) v += 5;
      if (lower.includes('export')) v += 3;
      if (lower.includes('download')) v += 2;
      if (lower.includes('csv')) v += 1;
      return -v;
    };
    return score(a) - score(b);
  });

  const best = prioritized[0];
  try {
    return new URL(best, baseUrl).toString();
  } catch (_) {
    return null;
  }
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': STATION_URL,
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.text();
}

async function fetchBuffer(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/csv,application/octet-stream,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function runProcessorOnCsv(csvPath, outputFileName) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      path.join(__dirname, 'process-nrw-csv.js'),
      csvPath,
      outputFileName
    ], { stdio: 'inherit' });

    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`CSV processor exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function main() {
  console.log(`Starting NRW downloader for station ${NRW_STATION_ID}`);
  console.log(`Station page: ${STATION_URL}`);

  await ensureDirectoryExists(RAW_DIR);
  await ensureDirectoryExists(PROCESSED_DIR);
  await ensureDirectoryExists(PUBLIC_PROCESSED_DIR);

  // 1) Fetch station HTML
  const html = await fetchText(STATION_URL);
  console.log(`Fetched station HTML (${html.length} chars)`);

  // 2) Build CSV export URL directly; support optional date range via env vars
  //    Env options:
  //      NRW_FROM (YYYY-MM-DD), NRW_TO (YYYY-MM-DD)
  //      NRW_DAYS (integer) → computes FROM=TO-DAYS
  //    If none provided, default to full export (no dates)
  let csvUrl = await extractCsvUrlFromHtml(html, STATION_URL);
  const PARAM_ID = process.env.NRW_PARAMETER_ID || '10194';
  const envFrom = (process.env.NRW_FROM || '').trim();
  const envTo = (process.env.NRW_TO || '').trim();
  const envDays = (process.env.NRW_DAYS || '').trim();

  const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const todayYmd = () => new Date().toISOString().slice(0,10);
  const minusDays = (d) => {
    const n = Number(envDays);
    if (!Number.isFinite(n) || n <= 0) return null;
    const dt = new Date(d + 'T00:00:00Z');
    dt.setUTCDate(dt.getUTCDate() - n);
    return dt.toISOString().slice(0,10);
  };

  if (!csvUrl) {
    let from = null;
    let to = null;
    if (isYmd(envFrom)) from = envFrom;
    if (isYmd(envTo)) to = envTo;
    if (!from && envDays) {
      const t = to || todayYmd();
      const f = minusDays(t);
      if (f) { from = f; to = t; }
    }

    const base = new URL(`/Graph/GetHistoricalCsv?location=${encodeURIComponent(NRW_STATION_ID)}&parameter=${encodeURIComponent(PARAM_ID)}`, STATION_URL);
    if (from && to) {
      base.searchParams.set('from', from);
      base.searchParams.set('to', to);
    }
    csvUrl = base.toString();
  }
  console.log(`CSV URL: ${csvUrl}`);

  // 3) Download CSV
  const now = new Date();
  const isoDate = now.toISOString().split('T')[0];
  const csvFileName = `nrw-${NRW_STATION_ID}-${isoDate}.csv`;
  const csvPath = path.join(RAW_DIR, csvFileName);
  const csvBuffer = await fetchBuffer(csvUrl);
  await fsPromises.writeFile(csvPath, csvBuffer);
  console.log(`Saved CSV → ${csvPath} (${csvBuffer.length} bytes)`);

  // 4) Process CSV to JSON (wales-<id>.json)
  const outputFileName = `wales-${NRW_STATION_ID}.json`;
  await runProcessorOnCsv(csvPath, outputFileName);
  console.log(`Processed CSV → ${outputFileName}`);

  // 5) Sanity check that file exists (processed/public handled by processor script)
  const processedPath = path.join(PROCESSED_DIR, outputFileName);
  if (!fs.existsSync(processedPath)) {
    throw new Error(`Processed JSON not found at ${processedPath}`);
  }
  console.log('NRW download and processing completed successfully');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('NRW downloader failed:', err.message);
    process.exit(1);
  });
}


