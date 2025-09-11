const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

/**
 * Process an NRW (Natural Resources Wales) CSV export into the dashboard format.
 * Usage:
 *   node scripts/process-nrw-csv.js /absolute/path/to/file.csv [stationFileName]
 *
 * Example:
 *   node scripts/process-nrw-csv.js /Users/you/rainfall.collection/20250910154025.csv wales-1099.json
 */

async function main() {
  const csvPath = process.argv[2];
  const outputFileName = process.argv[3] || 'wales-1099.json';

  if (!csvPath) {
    console.error('Please provide the path to the NRW CSV file.');
    console.error('Usage: node scripts/process-nrw-csv.js /abs/path/to/file.csv [wales-1099.json]');
    process.exit(1);
  }

  const processedDir = path.join(__dirname, '..', 'data', 'processed');
  const publicDir = path.join(__dirname, '..', 'public', 'data', 'processed');

  try {
    const raw = await fs.readFile(csvPath, 'utf-8');
    const lines = raw.split(/\r?\n/);

    // Parse station metadata from the header section until the blank line
    const meta = {};
    let i = 0;
    for (; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') { // blank line separates metadata from data table
        i++; // move to first header row of data table
        break;
      }
      const [k, v] = line.split(',');
      if (k !== undefined && v !== undefined) {
        meta[k.trim()] = v.trim();
      }
    }

    // Expect a data header next, like: "Date (UTC),Value"
    const dataHeader = (lines[i] || '').trim();
    if (!dataHeader.toLowerCase().includes('date') || !dataHeader.toLowerCase().includes('value')) {
      throw new Error('Unexpected data header row. Expected columns like "Date (UTC),Value"');
    }
    i++;

    const rows = [];
    for (; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const [dateStr, valueStr] = line.split(',');
      if (!dateStr) continue;
      const dt = dayjs(dateStr);
      const date = dt.isValid() ? dt.format('YYYY-MM-DD') : '';
      const time = dt.isValid() ? dt.format('HH:mm') : '';
      const rainfall_mm = parseFloat(valueStr || '0') || 0;
      rows.push({ date, time, rainfall_mm, total_mm: 0 });
    }

    // Merge by exact date+time, prefer higher reading (backfill handling)
    const toKey = (r) => `${r.date} ${r.time}`;
    const mergedMap = new Map();
    let added = 0;
    let updated = 0;
    for (const r of rows) {
      if (!r.date) continue;
      const key = toKey(r);
      const existing = mergedMap.get(key);
      if (!existing) {
        mergedMap.set(key, r);
        added++;
      } else {
        const incoming = Number(r.rainfall_mm) || 0;
        const current = Number(existing.rainfall_mm) || 0;
        if (incoming > current) {
          mergedMap.set(key, r);
          updated++;
        }
      }
    }

    const merged = Array.from(mergedMap.values()).sort((a, b) => {
      const aDt = new Date(`${a.date} ${a.time}`);
      const bDt = new Date(`${b.date} ${b.time}`);
      return aDt - bDt;
    });

    const history = {
      lastUpdated: new Date().toISOString(),
      // Try to use NRW metadata when present
      station: meta.Location || meta.Station || 'unknown',
      nameEN: meta.NameEN || meta.TitleEN || undefined,
      nameCY: meta.NameCY || meta.TitleCY || undefined,
      source: 'NRW',
      data: merged
    };

    await fs.mkdir(processedDir, { recursive: true });
    await fs.mkdir(publicDir, { recursive: true });

    const outPath = path.join(processedDir, outputFileName);
    const outPublic = path.join(publicDir, outputFileName);
    await fs.writeFile(outPath, JSON.stringify(history, null, 2));
    await fs.writeFile(outPublic, JSON.stringify(history, null, 2));

    console.log(`NRW CSV processed → ${outputFileName}`);
    console.log(`Records: ${merged.length} (added ${added}, updated ${updated})`);
    console.log(`Saved: ${outPath}`);
    console.log(`Copied: ${outPublic}`);
  } catch (err) {
    console.error('Failed to process NRW CSV:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}


