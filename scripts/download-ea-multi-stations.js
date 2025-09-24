const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const RainfallOutlierDetector = require('./outlier-detection');

// Politeness delay between requests (ms), configurable via env EA_DELAY_MS
const BASE_DELAY_MS = parseInt(process.env.EA_DELAY_MS || '2500', 10);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Download rainfall CSV from multiple EA stations
 * Based on the single station script but adapted for multiple stations
 */

// Base configuration - existing EA stations across different regions
const BASE_STATIONS_CONFIG = [
  {
    stationId: 'E7050',
    stationName: 'Preston Capes (E7050)',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E7050',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E7050',
    region: 'East Midlands'
  },
  {
    stationId: 'E19017',
    stationName: 'Ashdon (E19017)',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E19017',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E19017',
    region: 'East of England'
  },
  {
    stationId: 'E13600',
    stationName: 'Lyndhurst (E13600)',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E13600',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E13600',
    region: 'South East'
  },
  {
    stationId: 'E24879',
    stationName: 'Hullbridge Raine (E24879)',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E24879',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E24879',
    region: 'South East'
  },
  {
    stationId: 'E5170',
    stationName: 'Lower Standen (E5170)',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E5170',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E5170',
    region: 'South West'
  },
  {
    stationId: 'E23518',
    stationName: 'Hethersett (E23518)',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E23518',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E23518',
    region: 'East of England'
  },
  {
    stationId: 'E24913',
    stationName: 'Tiptree (E24913)',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E24913',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E24913',
    region: 'East of England'
  },
  {
    stationId: 'E8290',
    stationName: 'Isfield Weir (E8290)',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E8290',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E8290',
    region: 'South East'
  },
  {
    stationId: '577271',
    stationName: 'Red Br (577271)',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/577271',
    humanPage: 'https://check-for-flooding.service.gov.uk/station/577271?parameter=rainfall',
    region: 'North West'
  },
];

// Build full stations list by appending ALL remaining EA stations from processed JSON
function buildStationsConfig() {
  const stationsJsonPath = path.join(__dirname, '..', 'data', 'processed', 'ea-england-stations-with-names.json');

  let additional = [];
  try {
    const raw = fs.readFileSync(stationsJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed.items) ? parsed.items : [];

    const existingIds = new Set(BASE_STATIONS_CONFIG.map(s => String(s.stationId)));
    // Exclude stations handled in other workflows
    const excludedIds = new Set(['1141', '1099']); // Miserden (EA), Maenclochog (NRW - precaution)

    for (const item of items) {
      const stationId = String(item.stationReference || item.key || '').trim();
      const label = (item.label || item.gaugeName || '').trim();
      const humanPage = item.humanPage || '';

      if (!stationId || !label || existingIds.has(stationId) || excludedIds.has(stationId)) {
        continue;
      }

      additional.push({
        stationId: stationId,
        stationName: `${label} (${stationId})`,
        csvUrl: `https://check-for-flooding.service.gov.uk/rainfall-station-csv/${stationId}`,
        humanPage: humanPage || `https://check-for-flooding.service.gov.uk/rainfall-station/${stationId}`,
        region: 'England'
      });
    }
  } catch (err) {
    console.warn('⚠️ Could not load additional EA stations from JSON:', err.message);
  }

  return BASE_STATIONS_CONFIG.concat(additional);
}

// Use only the base stations for GitHub Actions (not all 837 stations!)
const STATIONS_CONFIG = process.env.GITHUB_ACTIONS ? BASE_STATIONS_CONFIG : buildStationsConfig();

async function downloadEACSV(station) {
  const outputPath = path.join(__dirname, '..', 'data', 'raw', `ea-${station.stationId}-${new Date().toISOString().split('T')[0]}.csv`);
  
  console.log(`🌧️ Downloading EA rainfall data for ${station.stationName} (${station.stationId}) - ${station.region}...`);
  console.log(`📥 URL: ${station.csvUrl}`);
  console.log(`💾 Saving to: ${outputPath}`);
  
  // Proper headers to mimic a real browser
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': station.humanPage,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Cache-Control': 'max-age=0'
  };
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    const options = {
      hostname: 'check-for-flooding.service.gov.uk',
      path: `/rainfall-station-csv/${station.stationId}`,
      method: 'GET',
      headers: headers
    };
    
    const request = https.request(options, (response) => {
      console.log(`📊 Response status: ${response.statusCode}`);
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      // Handle gzip compression
      let stream = response;
      if (response.headers['content-encoding'] === 'gzip') {
        console.log('🗜️ Decompressing gzip content...');
        stream = response.pipe(zlib.createGunzip());
      }
      
      stream.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✅ Download complete: ${outputPath}`);
        resolve(outputPath);
      });
      
      file.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Delete the file on error
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      console.error('❌ Request error:', err);
      reject(err);
    });
    
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
    
    request.end();
  });
}

async function processDownloadedCSV(csvPath, station) {
  console.log(`🔄 Processing CSV file: ${csvPath}`);
  
  try {
    const csvContent = await fsPromises.readFile(csvPath, 'utf8');
    const lines = csvContent.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error('CSV file appears to be empty or invalid');
    }
    
    // Parse CSV header
    const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log(`📋 CSV Headers: ${header.join(', ')}`);
    
    // Find columns - EA stations use different format
    const timestampIndex = header.findIndex(h => h.toLowerCase().includes('timestamp'));
    const valueIndex = header.findIndex(h => h.toLowerCase().includes('value') || h.toLowerCase().includes('rainfall'));
    
    if (timestampIndex === -1 || valueIndex === -1) {
      throw new Error(`Could not find required columns. Found: ${header.join(', ')}`);
    }
    
    console.log(`⏰ Timestamp column: ${header[timestampIndex]} (index ${timestampIndex})`);
    console.log(`💧 Value column: ${header[valueIndex]} (index ${valueIndex})`);
    
    // Process data rows
    const data = [];
    let validRows = 0;
    let skippedRows = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length < Math.max(timestampIndex, valueIndex) + 1) {
        console.log(`⚠️ Skipping malformed row ${i + 1}: ${line}`);
        skippedRows++;
        continue;
      }
      
      const timestamp = values[timestampIndex];
      const value = parseFloat(values[valueIndex]);
      
      if (isNaN(value)) {
        console.log(`⚠️ Skipping row ${i + 1} with invalid value: ${values[valueIndex]}`);
        skippedRows++;
        continue;
      }
      
      // Parse the timestamp (format: 2025-09-16T12:15:00Z)
      const dateTime = new Date(timestamp);
      if (isNaN(dateTime.getTime())) {
        console.log(`⚠️ Skipping row ${i + 1} with invalid timestamp: ${timestamp}`);
        skippedRows++;
        continue;
      }
      
      // Extract date and time components
      const date = dateTime.toISOString().split('T')[0];
      const time = dateTime.toISOString().split('T')[1].replace('Z', '');
      
      data.push({
        date: date,
        time: time,
        dateTime: timestamp,
        rainfall_mm: value,
        total_mm: 0, // EA stations don't provide cumulative totals
        station: station.stationId,
        stationName: station.stationName,
        region: station.region
      });
      
      validRows++;
    }
    
    console.log(`📊 Processed ${validRows} valid rows, skipped ${skippedRows} invalid rows`);
    
    if (validRows === 0) {
      throw new Error('No valid data rows found in CSV');
    }
    
    // Sort by date and time
    data.sort((a, b) => {
      const dateA = new Date(a.dateTime);
      const dateB = new Date(b.dateTime);
      return dateA - dateB;
    });
    
    // Check for outliers and correct them
    console.log('🔍 Checking for rainfall outliers...');
    const detector = new RainfallOutlierDetector(25);
    const stationData = {
      station: station.stationId,
      stationName: station.stationName,
      data: data
    };
    
    const outlierResult = detector.processStationData(stationData);
    let finalData = outlierResult.correctedData.data;
    
    if (outlierResult.hadOutliers) {
      console.log(`🔧 Corrected ${outlierResult.corrections.length} outliers in EA station ${station.stationId}`);
      // Log corrections for transparency
      outlierResult.corrections.forEach(correction => {
        console.log(`  Fixed: ${correction.timestamp} ${correction.original}mm → ${correction.corrected}mm`);
      });
    }
    
    // Create the final data structure
    const result = {
      lastUpdated: new Date().toISOString(),
      station: station.stationId,
      stationName: station.stationName,
      region: station.region,
      location: {
        lat: null, // Could be added from station config if needed
        long: null
      },
      dataSource: 'EA API',
      recordCount: finalData.length,
      data: finalData,
      ...(outlierResult.hadOutliers && {
        outlierDetection: outlierResult.correctedData.outlierDetection
      })
    };
    
    return result;
    
  } catch (error) {
    console.error('❌ Error processing CSV:', error);
    throw error;
  }
}

async function saveProcessedData(data, station) {
  const outputDir = path.join(__dirname, '..', 'data', 'processed');
  const outputFile = path.join(outputDir, `ea-${station.stationId}.json`);
  
  // Ensure output directory exists
  await fsPromises.mkdir(outputDir, { recursive: true });
  
  // Load existing data if it exists (for incremental updates)
  let existingData = null;
  try {
    const existingContent = await fsPromises.readFile(outputFile, 'utf-8');
    existingData = JSON.parse(existingContent);
    console.log(`📂 Found existing data with ${existingData.data ? existingData.data.length : 0} records`);
  } catch (error) {
    console.log(`📂 No existing data found, creating new file`);
  }
  
  // Merge new data with existing data (avoiding duplicates)
  let mergedData;
  if (existingData && existingData.data && Array.isArray(existingData.data)) {
    // Create a set of existing date/time combinations to avoid duplicates
    const existingKeys = new Set(existingData.data.map(item => `${item.date}_${item.time}`));
    
    // Filter out duplicates from new data
    const newRecords = data.data.filter(item => {
      const key = `${item.date}_${item.time}`;
      return !existingKeys.has(key);
    });
    
    console.log(`📊 New data: ${data.data.length} records, ${newRecords.length} new (${data.data.length - newRecords.length} duplicates skipped)`);
    
    // Merge the data
    mergedData = {
      ...data,
      data: [...existingData.data, ...newRecords].sort((a, b) => {
        const dateA = new Date(a.dateTime);
        const dateB = new Date(b.dateTime);
        return dateA - dateB;
      }),
      recordCount: existingData.data.length + newRecords.length,
      lastUpdated: new Date().toISOString(),
      previousUpdate: existingData.lastUpdated,
      incrementalUpdate: true
    };
  } else {
    // No existing data, use the new data as-is
    mergedData = {
      ...data,
      incrementalUpdate: false
    };
  }
  
  // Save to processed directory
  await fsPromises.writeFile(outputFile, JSON.stringify(mergedData, null, 2));
  console.log(`💾 Saved processed data to: ${outputFile} (${mergedData.recordCount} total records)`);
  
  // Also save to public directory for the web app
  const publicDir = path.join(__dirname, '..', 'public', 'data', 'processed');
  const publicFile = path.join(publicDir, `ea-${station.stationId}.json`);
  
  await fsPromises.mkdir(publicDir, { recursive: true });
  await fsPromises.writeFile(publicFile, JSON.stringify(mergedData, null, 2));
  console.log(`🌐 Saved public data to: ${publicFile}`);
  
  return outputFile;
}

async function processStation(station) {
  try {
    console.log(`\n🚀 Processing station: ${station.stationName} (${station.stationId})`);
    
    // Download CSV
    const csvPath = await downloadEACSV(station);
    
    // Process CSV
    const data = await processDownloadedCSV(csvPath, station);
    
    // Save processed data
    const outputFile = await saveProcessedData(data, station);
    
    console.log(`✅ Station ${station.stationName} complete!`);
    console.log(`📊 Records processed: ${data.recordCount}`);
    
    return {
      stationId: station.stationId,
      stationName: station.stationName,
      region: station.region,
      recordCount: data.recordCount,
      success: true,
      outputFile: outputFile
    };
    
  } catch (error) {
    console.error(`❌ Error processing station ${station.stationName}:`, error);
    return {
      stationId: station.stationId,
      stationName: station.stationName,
      region: station.region,
      recordCount: 0,
      success: false,
      error: error.message
    };
  }
}

async function main() {
  try {
    console.log('🚀 Starting multi-station EA data download...');
    console.log(`📍 Processing ${STATIONS_CONFIG.length} stations`);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    // Process each station sequentially to avoid overwhelming the server
    for (const station of STATIONS_CONFIG) {
      const result = await processStation(station);
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }
      
      // Polite delay with small jitter between stations
      const jitter = Math.floor(Math.random() * 500); // 0-500ms
      const delay = BASE_DELAY_MS + jitter;
      await sleep(delay);
    }
    
    // Summary
    console.log('\n🎯 SUMMARY:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📊 Total stations: ${STATIONS_CONFIG.length}`);
    
    // Detailed results
    console.log('\n📋 DETAILED RESULTS:');
    results.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.stationName} (${result.stationId}) - ${result.region}: ${result.recordCount} records`);
      } else {
        console.log(`❌ ${result.stationName} (${result.stationId}) - ${result.region}: ${result.error}`);
      }
    });
    
    console.log('\n✅ Multi-station EA data download complete!');
    
  } catch (error) {
    console.error('❌ Error in main process:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  downloadEACSV,
  processDownloadedCSV,
  saveProcessedData,
  processStation,
  STATIONS_CONFIG
};
