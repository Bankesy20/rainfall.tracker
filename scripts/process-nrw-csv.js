const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

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
      const dt = dayjs.utc(dateStr);
      const date = dt.isValid() ? dt.format('YYYY-MM-DD') : '';
      const time = dt.isValid() ? dt.format('HH:mm') : '';
      const rainfallValue = Number(valueStr);
      const rainfall_mm = Number.isFinite(rainfallValue) ? Math.max(0, rainfallValue) : 0;
      const dateTimeUtc = dt.isValid() ? dt.toISOString() : null;
      rows.push({ date, time, dateTimeUtc, rainfall_mm, total_mm: 0 });
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

    let merged = Array.from(mergedMap.values()).sort((a, b) => {
      const aTs = Date.parse(`${a.date}T${a.time || '00:00'}:00Z`);
      const bTs = Date.parse(`${b.date}T${b.time || '00:00'}:00Z`);
      return aTs - bTs;
    });

    // Attempt to merge with existing history to preserve full timeline
    const outPath = path.join(processedDir, outputFileName);
    let existing = null;
    try {
      const existingRaw = await fs.readFile(outPath, 'utf8');
      existing = JSON.parse(existingRaw);
    } catch (_) {
      existing = null;
    }

    if (existing && Array.isArray(existing.data)) {
      const existingMap = new Map(existing.data.map(r => [`${r.date} ${r.time}`, r]));
      for (const r of merged) {
        const key = `${r.date} ${r.time}`;
        const prev = existingMap.get(key);
        if (!prev) {
          existingMap.set(key, r);
        } else {
          const incoming = Number(r.rainfall_mm) || 0;
          const current = Number(prev.rainfall_mm) || 0;
          if (incoming > current) existingMap.set(key, r);
        }
      }
      merged = Array.from(existingMap.values()).sort((a, b) => {
        const aTs = Date.parse(`${a.date}T${a.time || '00:00'}:00Z`);
        const bTs = Date.parse(`${b.date}T${b.time || '00:00'}:00Z`);
        return aTs - bTs;
      });
    }

    // Compute running totals and backfill dateTimeUtc where missing
    let runningTotal = 0;
    merged = merged.map((r) => {
      const rainfall = Number.isFinite(r.rainfall_mm) ? Math.max(0, r.rainfall_mm) : 0;
      runningTotal += rainfall;
      const ensuredDateTimeUtc = r.dateTimeUtc || `${r.date}T${r.time || '00:00'}:00.000Z`;
      return { ...r, rainfall_mm: rainfall, total_mm: runningTotal, dateTimeUtc: ensuredDateTimeUtc };
    });

    // Extract station ID from filename or metadata
    const stationId = (existing && existing.station) || meta.Location || meta.Station || 'unknown';
    const stationNameEN = (existing && existing.nameEN) || (existing && existing.stationName) || meta.NameEN || meta.TitleEN || undefined;
    const stationName = stationNameEN ? `${stationNameEN} (${stationId})` : `Station ${stationId}`;
    
    const history = {
      lastUpdated: new Date().toISOString(),
      // Prefer prior metadata if present, otherwise use NRW metadata
      station: stationId,
      stationName: stationName,
      nameEN: stationNameEN,
      nameCY: (existing && existing.nameCY) || meta.NameCY || meta.TitleCY || undefined,
      region: 'Wales',
      source: 'NRW',
      data: merged
    };

    await fs.mkdir(processedDir, { recursive: true });
    await fs.mkdir(publicDir, { recursive: true });

    const outPublic = path.join(publicDir, outputFileName);
    await fs.writeFile(outPath, JSON.stringify(history, null, 2));
    await fs.writeFile(outPublic, JSON.stringify(history, null, 2));

    console.log(`NRW CSV processed → ${outputFileName}`);
    console.log(`Records (after merge): ${merged.length} (added ${added}, updated ${updated} within CSV)`);
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


