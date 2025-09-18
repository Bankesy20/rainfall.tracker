#!/usr/bin/env node

/**
 * Download rainfall data from multiple EA stations
 * Adapted from download-rainfall.js to handle multiple stations efficiently
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');

dayjs.extend(utc);

// Selected 10 EA stations for testing
const EA_STATIONS = [
  {
    id: '573674',
    name: 'Northern Station',
    lat: 53.971437,
    long: -2.529714,
    csvUrl: 'http://environment.data.gov.uk/flood-monitoring/id/measures/573674-rainfall-tipping_bucket_raingauge-t-15_min-mm/readings.csv'
  },
  {
    id: 'E19017', 
    name: 'East England Station',
    lat: 52.058925,
    long: 0.296651,
    csvUrl: 'http://environment.data.gov.uk/flood-monitoring/id/measures/E19017-rainfall-tipping_bucket_raingauge-t-15_min-mm/readings.csv'
  },
  {
    id: '240662TP',
    name: 'Central England Station', 
    lat: 51.937159,
    long: -0.384591,
    csvUrl: 'http://environment.data.gov.uk/flood-monitoring/id/measures/240662TP-rainfall-tipping_bucket_raingauge-t-15_min-mm/readings.csv'
  },
  {
    id: '558491',
    name: 'Midlands Station',
    lat: 53.38925,
    long: -1.919511,
    csvUrl: 'http://environment.data.gov.uk/flood-monitoring/id/measures/558491-rainfall-tipping_bucket_raingauge-t-15_min-mm/readings.csv'
  },
  {
    id: '059793',
    name: 'Yorkshire Station',
    lat: 53.966652,
    long: -1.115089,
    csvUrl: 'http://environment.data.gov.uk/flood-monitoring/id/measures/059793-rainfall-tipping_bucket_raingauge-t-15_min-mm/readings.csv'
  },
  {
    id: '013553',
    name: 'Northern Border Station',
    lat: 54.820161,
    long: -2.445834,
    csvUrl: 'http://environment.data.gov.uk/flood-monitoring/id/measures/013553-rainfall-tipping_bucket_raingauge-t-15_min-mm/readings.csv'
  },
  {
    id: '50108',
    name: 'Southwest Station',
    lat: 50.925011,
    long: -3.713738,
    csvUrl: 'http://environment.data.gov.uk/flood-monitoring/id/measures/50108-rainfall-tipping_bucket_raingauge-t-15_min-mm/readings.csv'
  },
  {
    id: 'E14920',
    name: 'South Coast Station',
    lat: 50.691845,
    long: -1.308358,
    csvUrl: 'http://environment.data.gov.uk/flood-monitoring/id/measures/E14920-rainfall-tipping_bucket_raingauge-t-15_min-mm/readings.csv'
  },
  {
    id: '038476',
    name: 'East Coast Station',
    lat: 54.107252,
    long: -0.128568,
    csvUrl: 'http://environment.data.gov.uk/flood-monitoring/id/measures/038476-rainfall-tipping_bucket_raingauge-t-15_min-mm/readings.csv'
  },
  {
    id: 'E11461',
    name: 'South Station',
    lat: 50.902688,
    long: -1.10472,
    csvUrl: 'http://environment.data.gov.uk/flood-monitoring/id/measures/E11461-rainfall-tipping_bucket_raingauge-t-15_min-mm/readings.csv'
  }
];

const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const PROCESSED_DIR = path.join(DATA_DIR, 'processed');
const PUBLIC_PROCESSED_DIR = path.join(__dirname, '..', 'public', 'data', 'processed');

async function ensureDirectoryExists(directoryPath) {
  try {
    await fs.mkdir(directoryPath, { recursive: true });
  } catch (_) {
    // Directory already exists
  }
}

async function downloadStationData(station) {
  console.log(`\n🌧️ Downloading data for ${station.name} (${station.id})...`);
  
  const today = new Date().toISOString().split('T')[0];
  const csvFileName = `ea-${station.id}-${today}.csv`;
  const csvPath = path.join(RAW_DIR, csvFileName);
  
  // Check if we already downloaded this station today
  try {
    await fs.access(csvPath);
    console.log(`  ⏭️  Already downloaded today, skipping download`);
    return await processStationData(station, csvPath);
  } catch {
    // File doesn't exist, proceed with download
  }
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(csvPath);
    
    // Use https for EA URLs
    const url = station.csvUrl;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/csv,application/csv,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
      }
    };
    
    const request = https.request(options, async (response) => {
      console.log(`  📊 Response status: ${response.statusCode}`);
      
      if (response.statusCode !== 200) {
        console.error(`  ❌ HTTP Error: ${response.statusCode}`);
        file.close();
        await fs.unlink(csvPath).catch(() => {});
        reject(new Error(`HTTP ${response.statusCode} for station ${station.id}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', async () => {
        file.close();
        console.log(`  ✅ Downloaded successfully`);
        
        try {
          const result = await processStationData(station, csvPath);
          resolve(result);
        } catch (error) {
          console.error(`  ❌ Error processing: ${error.message}`);
          reject(error);
        }
      });
      
      file.on('error', async (err) => {
        await fs.unlink(csvPath).catch(() => {});
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      console.error(`  ❌ Request error: ${err.message}`);
      reject(err);
    });
    
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error(`Timeout downloading ${station.id}`));
    });
    
    request.end();
  });
}

async function processStationData(station, csvPath) {
  console.log(`  🔄 Processing CSV data...`);
  
  try {
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV file is empty or invalid');
    }
    
    // Parse CSV header - EA API returns dateTime,value format
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log(`  📋 Headers: ${headers.join(', ')}`);
    
    // Process data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length >= 2) {
        const dateTimeStr = values[0];
        const rainfallStr = values[1];
        
        if (dateTimeStr && rainfallStr !== '') {
          try {
            const dt = dayjs.utc(dateTimeStr);
            if (dt.isValid()) {
              const rainfall_mm = parseFloat(rainfallStr) || 0;
              
              data.push({
                date: dt.format('YYYY-MM-DD'),
                time: dt.format('HH:mm'),
                dateTimeUtc: dt.toISOString(),
                rainfall_mm: rainfall_mm,
                total_mm: 0 // Will be calculated later if needed
              });
            }
          } catch (parseError) {
            // Skip invalid rows
            continue;
          }
        }
      }
    }
    
    console.log(`  📊 Parsed ${data.length} data rows`);
    
    if (data.length === 0) {
      throw new Error('No valid data found in CSV');
    }
    
    // Sort by datetime
    data.sort((a, b) => new Date(a.dateTimeUtc) - new Date(b.dateTimeUtc));
    
    // Load existing data and merge
    const outputFileName = `ea-${station.id}.json`;
    const outputPath = path.join(PROCESSED_DIR, outputFileName);
    
    let existingData = [];
    try {
      const existingFile = await fs.readFile(outputPath, 'utf-8');
      const existingHistory = JSON.parse(existingFile);
      existingData = existingHistory.data || [];
      console.log(`  📚 Loaded ${existingData.length} existing records`);
    } catch (error) {
      console.log(`  📚 No existing data found, starting fresh`);
    }
    
    // Merge with existing data (prefer higher rainfall values for same datetime)
    const toKey = (item) => `${item.date} ${item.time}`;
    const mergedMap = new Map(existingData.map(item => [toKey(item), item]));
    
    let addedCount = 0;
    let updatedCount = 0;
    
    for (const item of data) {
      const key = toKey(item);
      const existing = mergedMap.get(key);
      
      if (!existing) {
        mergedMap.set(key, item);
        addedCount++;
      } else {
        const existingVal = Number(existing.rainfall_mm) || 0;
        const incomingVal = Number(item.rainfall_mm) || 0;
        
        if (incomingVal > existingVal) {
          mergedMap.set(key, item);
          updatedCount++;
        }
      }
    }
    
    // Convert back to array and sort
    const mergedData = Array.from(mergedMap.values()).sort((a, b) => {
      return new Date(a.dateTimeUtc || `${a.date}T${a.time}:00Z`) - 
             new Date(b.dateTimeUtc || `${b.date}T${b.time}:00Z`);
    });
    
    console.log(`  📈 Added ${addedCount} new records, updated ${updatedCount} records`);
    console.log(`  📊 Total records: ${mergedData.length}`);
    
    // Create the history object
    const history = {
      lastUpdated: new Date().toISOString(),
      station: station.id,
      stationName: station.name,
      location: {
        lat: station.lat,
        long: station.long
      },
      dataSource: 'EA API',
      recordCount: mergedData.length,
      data: mergedData
    };
    
    // Save to processed directory
    await fs.writeFile(outputPath, JSON.stringify(history, null, 2));
    
    // Also save to public directory
    const publicPath = path.join(PUBLIC_PROCESSED_DIR, outputFileName);
    await fs.writeFile(publicPath, JSON.stringify(history, null, 2));
    
    console.log(`  ✅ Successfully processed and saved ${mergedData.length} records`);
    console.log(`  📁 Saved to: ${outputPath}`);
    console.log(`  🌐 Public: ${publicPath}`);
    
    return {
      stationId: station.id,
      name: station.name,
      recordCount: mergedData.length,
      newRecords: addedCount,
      updatedRecords: updatedCount
    };
    
  } catch (error) {
    console.error(`  ❌ Error processing CSV: ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting EA batch download...');
  
  // Check for test mode and station limit
  const args = process.argv.slice(2);
  const isTestMode = args.includes('--test');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const stationLimit = limitArg ? parseInt(limitArg.split('=')[1]) : EA_STATIONS.length;
  
  // Select stations to process
  const stationsToProcess = EA_STATIONS.slice(0, Math.min(stationLimit, EA_STATIONS.length));
  
  if (isTestMode) {
    console.log('🧪 Running in TEST MODE');
    console.log(`📊 Testing ${stationsToProcess.length} of ${EA_STATIONS.length} stations`);
  } else {
    console.log(`📊 Processing ${stationsToProcess.length} stations`);
  }
  
  // Log which stations we're processing
  console.log('🎯 Stations to process:');
  stationsToProcess.forEach((station, i) => {
    console.log(`  ${i + 1}. ${station.id} - ${station.name}`);
  });
  
  // Ensure directories exist
  await ensureDirectoryExists(RAW_DIR);
  await ensureDirectoryExists(PROCESSED_DIR);
  await ensureDirectoryExists(PUBLIC_PROCESSED_DIR);
  
  const results = [];
  const errors = [];
  
  // Download stations sequentially to be nice to the API
  for (const station of stationsToProcess) {
    try {
      const result = await downloadStationData(station);
      results.push(result);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Failed to process station ${station.id}: ${error.message}`);
      errors.push({
        stationId: station.id,
        name: station.name,
        error: error.message
      });
    }
  }
  
  // Summary
  console.log('\n📊 EA Batch Download Summary:');
  if (isTestMode) {
    console.log('🧪 TEST MODE COMPLETE');
  }
  console.log(`✅ Successful: ${results.length} stations`);
  console.log(`❌ Failed: ${errors.length} stations`);
  
  if (results.length > 0) {
    console.log('\n✅ Successfully processed stations:');
    for (const result of results) {
      console.log(`  ${result.stationId} (${result.name}): ${result.recordCount} total records (${result.newRecords} new, ${result.updatedRecords} updated)`);
    }
  }
  
  if (errors.length > 0) {
    console.log('\n❌ Failed stations:');
    for (const error of errors) {
      console.log(`  ${error.stationId} (${error.name}): ${error.error}`);
    }
  }
  
  console.log('\n🎉 EA batch download completed!');
  
  // Exit with error code if any failures
  if (errors.length > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ EA batch download failed:', error.message);
    process.exit(1);
  });
}

module.exports = { downloadStationData, processStationData, EA_STATIONS };
