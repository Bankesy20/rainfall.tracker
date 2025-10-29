#!/usr/bin/env node

/**
 * NRW Batch Downloader 1 - Downloads first half of Welsh stations
 * Used by GitHub Actions workflows for Welsh rainfall data
 */

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Import the base functionality from the NRW downloader
const nrwDownloader = require('./download-nrw');

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

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.text();
}

async function downloadFile(url, filePath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  await fsPromises.writeFile(filePath, Buffer.from(buffer));
}

async function extractCsvUrlFromHtml(html, baseUrl) {
  const candidates = [];
  
  // Look for CSV download links in the HTML
  const csvLinkRegex = /href="([^"]*\.csv[^"]*)"/gi;
  let match;
  while ((match = csvLinkRegex.exec(html)) !== null) {
    candidates.push(match[1]);
  }
  
  if (candidates.length === 0) {
    return null;
  }
  
  // Use the first CSV link found
  const csvPath = candidates[0];
  
  // Resolve relative URLs
  if (csvPath.startsWith('http')) {
    return csvPath;
  } else if (csvPath.startsWith('/')) {
    const base = new URL(baseUrl);
    return `${base.protocol}//${base.host}${csvPath}`;
  } else {
    const base = new URL(baseUrl);
    return `${base.protocol}//${base.host}${base.pathname.replace(/\/[^/]*$/, '/')}${csvPath}`;
  }
}

async function runProcessorOnCsv(csvPath, outputFileName) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/process-nrw-csv.js', csvPath, outputFileName], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Processor exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function processStation(station) {
  try {
    console.log(`\n🚀 Processing station: ${station.station_name} (${station.station_id})`);
    
    const stationUrl = station.url;
    const stationId = station.station_id.toString();
    
    // 1) Fetch station HTML
    const html = await fetchText(stationUrl);
    console.log(`📄 Fetched station HTML (${html.length} chars)`);

    // 2) Build CSV export URL with date range (NRW requires this for unique data per station)
    let csvUrl = await extractCsvUrlFromHtml(html, stationUrl);
    const PARAM_ID = '10194'; // Rainfall parameter ID
    
    // Calculate date range - support env vars for scheduled runs (like Maenclochog script)
    // Default to ~13 months for initial backlog,.Clear but allow override via env vars
    const envFrom = (process.env.NRW_FROM || '').trim();
    const envTo = (process.env.NRW_TO || '').trim();
    const envDays = (process.env.NRW_DAYS || '').trim();
    
    const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    const todayYmd = () => new Date().toISOString().slice(0, 10);
    const minusDays = (d, days) => {
      const dt = new Date(d + 'T00:00:00Z');
      dt.setUTCDate(dt.getUTCDate() - days);
      return dt.toISOString().slice(0, 10);
    };
    
    let fromStr, toStr;
    if (isYmd(envFrom)) {
      fromStr = envFrom;
      toStr = isYmd(envTo) ? envTo : todayYmd();
    } else if (envDays) {
      const days = parseInt(envDays, 10);
      if (days > 0) {
        toStr = isYmd(envTo) ? envTo : todayYmd();
        fromStr = minusDays(toStr, days);
      } else {
        // Invalid days, use default
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setMonth(toDate.getMonth() - 13);
        fromStr = fromDate.toISOString().split('T')[0];
        toStr = toDate.toISOString().split('T')[0];
      }
    } else {
      // Default: ~13 months for initial backlog
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setMonth(toDate.getMonth() - 13);
      fromStr = fromDate.toISOString().split('T')[0];
      toStr = toDate.toISOString().split('T')[0];
    }
    
    if (!csvUrl) {
      // Build CSV URL directly with date range if not found in HTML
      const base = new URL(`/Graph/GetHistoricalCsv?location=${encodeURIComponent(stationId)}&parameter=${encodeURIComponent(PARAM_ID)}`, stationUrl);
      base.searchParams.set('from', fromStr);
      base.searchParams.set('to', toStr);
      csvUrl = base.toString();
    } else {
      // If URL was extracted from HTML, ensure it has date parameters
      const url = new URL(csvUrl);
      if (!url.searchParams.has('from') || !url.searchParams.has('to')) {
        url.searchParams.set('from', fromStr);
        url.searchParams.set('to', toStr);
        csvUrl = url.toString();
      }
    }
    
    console.log(`📊 CSV URL: ${csvUrl}`);

    // 3) Download CSV
    const now = new Date();
    const isoDate = now.toISOString().split('T')[0];
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const csvFileName = `nrw-${stationId}-${timestamp}.csv`;
    const csvPath = path.join(RAW_DIR, csvFileName);
    
    await downloadFile(csvUrl, csvPath);
    console.log(`💾 Downloaded CSV: ${csvFileName}`);

    // 4) Process CSV
    const outputFileName = `wales-${stationId}.json`;
    await runProcessorOnCsv(csvPath, outputFileName);
    console.log(`⚙️  Processed CSV to: ${outputFileName}`);

    // 5) Clean up raw CSV file
    try {
      await fsPromises.unlink(csvPath);
      console.log(`🗑️  Cleaned up raw CSV file`);
    } catch (error) {
      console.log(`⚠️  Could not clean up CSV file: ${error.message}`);
    }

    console.log(`✅ Station ${station.station_name} complete!`);
    
    return {
      stationId: stationId,
      stationName: station.station_name,
      region: 'Wales',
      success: true,
      outputFile: outputFileName
    };
    
  } catch (error) {
    console.error(`❌ Error processing station ${station.station_name}:`, error.message);
    return {
      stationId: station.station_id.toString(),
      stationName: station.station_name,
      region: 'Wales',
      success: false,
      error: error.message
    };
  }
}

async function downloadBatch1() {
  console.log(`🚀 Starting NRW Batch 1 download...`);
  
  await ensureDirectoryExists(RAW_DIR);
  await ensureDirectoryExists(PROCESSED_DIR);
  await ensureDirectoryExists(PUBLIC_PROCESSED_DIR);
  
  // Load Welsh stations
  const stationsJsonPath = path.join(__dirname, '..', 'welsh_rainfall_stations_with_coords.json');
  
  try {
    const raw = fs.readFileSync(stationsJsonPath, 'utf8');
    const allStations = JSON.parse(raw);
    
    // Exclude Maencloghog (1099) as it's handled separately
    const excludedIds = new Set(['1099']);
    const validStations = allStations.filter(station => {
      return station.station_id && station.station_name && !excludedIds.has(station.station_id.toString());
    });
    
    console.log(`📊 Total Welsh stations: ${allStations.length}`);
    console.log(`📊 Valid stations (excluding Maencloghog): ${validStations.length}`);
    
    // Split into two batches - first half
    const batchSize = Math.ceil(validStations.length / 2);
    const batch1Stations = validStations.slice(0, batchSize);
    
    console.log(`📍 Batch 1 stations: ${batch1Stations.length}`);
    console.log(`📍 Range: ${batch1Stations[0]?.station_name} → ${batch1Stations[batch1Stations.length - 1]?.station_name}`);
    
    if (batch1Stations.length === 0) {
      console.log('⚠️  No stations found for batch 1, exiting successfully');
      return;
    }
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Process each station sequentially to avoid overwhelming the server
    for (const station of batch1Stations) {
      const result = await processStation(station);
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }
      
      // Polite delay with small jitter between stations
      const jitter = Math.floor(Math.random() * 1000); // 0-1000ms
      const delay = 3000 + jitter; // 3-4 seconds
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Summary
    console.log(`\n🎯 NRW BATCH 1 SUMMARY:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📊 Total stations: ${batch1Stations.length}`);
    
    console.log(`\n📋 DETAILED RESULTS:`);
    results.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.stationName} (${result.stationId}) - ${result.region}`);
      } else {
        console.log(`❌ ${result.stationName} (${result.stationId}) - ${result.region}: ${result.error}`);
      }
    });
    
    console.log(`\n✅ NRW Batch 1 download complete!`);
    
  } catch (error) {
    console.error('❌ Error in batch download:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  downloadBatch1();
}

module.exports = { downloadBatch1 };
