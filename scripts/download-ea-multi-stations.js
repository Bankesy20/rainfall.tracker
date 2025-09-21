const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const https = require('https');
const zlib = require('zlib');

/**
 * Download rainfall CSV from multiple EA stations
 * Based on the single station script but adapted for multiple stations
 */

// Configuration - 10 diverse EA stations across different regions
const STATIONS_CONFIG = [
  {
    stationId: 'E7050',
    stationName: 'Preston Capes',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E7050',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E7050',
    region: 'East Midlands'
  },
  {
    stationId: 'E19017',
    stationName: 'Cambridge',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E19017',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E19017',
    region: 'East of England'
  },
  {
    stationId: 'E13600',
    stationName: 'Lyndhurst',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E13600',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E13600',
    region: 'South East'
  },
  {
    stationId: 'E24879',
    stationName: 'Bournemouth',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E24879',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E24879',
    region: 'South West'
  },
  {
    stationId: 'E5170',
    stationName: 'Bristol',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E5170',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E5170',
    region: 'South West'
  },
  {
    stationId: 'E23518',
    stationName: 'Manchester',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E23518',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E23518',
    region: 'North West'
  },
  {
    stationId: 'E24913',
    stationName: 'Liverpool',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E24913',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E24913',
    region: 'North West'
  },
  {
    stationId: 'E8290',
    stationName: 'Sheffield',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/E8290',
    humanPage: 'https://check-for-flooding.service.gov.uk/rainfall-station/E8290',
    region: 'Yorkshire'
  },
  {
    stationId: '577271',
    stationName: 'Newcastle',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/577271',
    humanPage: 'https://check-for-flooding.service.gov.uk/station/577271?parameter=rainfall',
    region: 'North East'
  },
  {
    stationId: '031555',
    stationName: 'Birmingham',
    csvUrl: 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/031555',
    humanPage: 'https://check-for-flooding.service.gov.uk/station/031555?parameter=rainfall',
    region: 'West Midlands'
  }
];

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
        value: value,
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
      recordCount: data.length,
      data: data
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
  
  // Save to processed directory
  await fsPromises.writeFile(outputFile, JSON.stringify(data, null, 2));
  console.log(`💾 Saved processed data to: ${outputFile}`);
  
  // Also save to public directory for the web app
  const publicDir = path.join(__dirname, '..', 'public', 'data', 'processed');
  const publicFile = path.join(publicDir, `ea-${station.stationId}.json`);
  
  await fsPromises.mkdir(publicDir, { recursive: true });
  await fsPromises.writeFile(publicFile, JSON.stringify(data, null, 2));
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
      
      // Small delay between stations to be respectful to the server
      await new Promise(resolve => setTimeout(resolve, 2000));
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
