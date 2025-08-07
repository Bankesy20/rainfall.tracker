const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const zlib = require('zlib');

/**
 * Download rainfall CSV directly from the UK government website
 * Based on the HTML: <a href="/rainfall-station-csv/1141">Download data CSV (12KB)</a>
 */

async function downloadRainfallCSV() {
  const csvUrl = 'https://check-for-flooding.service.gov.uk/rainfall-station-csv/1141';
  const outputPath = path.join(__dirname, '..', 'data', 'raw', `rainfall-${new Date().toISOString().split('T')[0]}.csv`);
  
  console.log('🌧️ Downloading rainfall data from UK government website...');
  console.log(`📥 URL: ${csvUrl}`);
  console.log(`💾 Saving to: ${outputPath}`);
  console.log(`🔍 Node.js version: ${process.version}`);
  console.log(`🌐 Platform: ${process.platform}`);
  
  // Proper headers to mimic a real browser
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://check-for-flooding.service.gov.uk/rainfall-station/1141',
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
      path: '/rainfall-station-csv/1141',
      method: 'GET',
      headers: headers
    };
    
    const request = https.request(options, (response) => {
      console.log(`📊 Response status: ${response.statusCode}`);
      console.log(`📋 Response headers:`, JSON.stringify(response.headers, null, 2));
      
      if (response.statusCode !== 200) {
        console.error(`❌ HTTP Error: ${response.statusCode} - ${response.statusMessage}`);
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      // Handle gzip compression
      let stream = response;
      if (response.headers['content-encoding'] === 'gzip') {
        console.log('📦 Detected gzip compression, decompressing...');
        stream = response.pipe(zlib.createGunzip());
      }
      
      stream.pipe(file);
      
      file.on('finish', async () => {
        file.close();
        console.log('✅ Download completed successfully!');
        
        // Process the downloaded CSV
        try {
          await processDownloadedCSV(outputPath);
        } catch (error) {
          console.error('❌ Error processing CSV:', error.message);
        }
        
        resolve(outputPath);
      });
      
      file.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Delete the file if there was an error
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      console.error(`❌ Request error: ${err.message}`);
      console.error(`🔍 Error details:`, err);
      reject(err);
    });
    
    request.end();
  });
}

async function processDownloadedCSV(csvPath) {
  console.log('\n🔄 Processing downloaded CSV...');
  
  try {
    // Read the CSV file
    const csvContent = await fsPromises.readFile(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV file is empty or invalid');
    }

    // Parse CSV header
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('📋 CSV headers:', headers);

    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length >= headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        data.push(row);
      }
    }

    console.log(`📊 Parsed ${data.length} data rows`);

    // Convert to our standard format
    const processedData = data.map(row => {
      // Extract date and time from various possible formats
      let date = '';
      let time = '';
      let rainfall_mm = 0;
      let total_mm = 0;

      // Look for date/time columns
      for (const [key, value] of Object.entries(row)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('date') || lowerKey.includes('time')) {
          const dateTime = value;
          if (dateTime.includes('T')) {
            // ISO format
            const dt = require('dayjs')(dateTime);
            date = dt.format('YYYY-MM-DD');
            time = dt.format('HH:mm');
          } else if (dateTime.includes(' ')) {
            // Space separated
            const parts = dateTime.split(' ');
            date = parts[0];
            time = parts[1];
          } else {
            // Assume it's just a date
            date = dateTime;
          }
        } else if (lowerKey.includes('rainfall') || lowerKey.includes('precipitation')) {
          rainfall_mm = parseFloat(value) || 0;
        } else if (lowerKey.includes('total')) {
          total_mm = parseFloat(value) || 0;
        }
      }

      return {
        date,
        time,
        rainfall_mm,
        total_mm
      };
    }).filter(item => item.date && item.date !== '');

    // Load existing data if it exists
    const outputPath = path.join(__dirname, '..', 'data', 'processed', 'rainfall-history.json');
    let existingData = [];
    try {
      const existingFile = await fsPromises.readFile(outputPath, 'utf-8');
      const existingHistory = JSON.parse(existingFile);
      existingData = existingHistory.data || [];
      console.log(`📚 Loaded ${existingData.length} existing records`);
    } catch (error) {
      console.log('📚 No existing data found, starting fresh');
    }

    // Merge new data with existing data, avoiding duplicates
    const existingDates = new Set(existingData.map(item => `${item.date} ${item.time}`));
    const newData = processedData.filter(item => {
      const key = `${item.date} ${item.time}`;
      if (existingDates.has(key)) {
        console.log(`🔄 Skipping duplicate: ${key}`);
        return false;
      }
      return true;
    });

    const mergedData = [...existingData, ...newData];
    console.log(`📊 Added ${newData.length} new records`);
    console.log(`📈 Total records: ${mergedData.length}`);

    // Create the history object
    const history = {
      lastUpdated: new Date().toISOString(),
      station: "1141",
      data: mergedData
    };

    // Save to the processed directory
    await fsPromises.writeFile(outputPath, JSON.stringify(history, null, 2));
    
    // Also copy to public directory for development
    const publicDir = path.join(__dirname, '..', 'public', 'data', 'processed');
    await fsPromises.mkdir(publicDir, { recursive: true });
    const publicPath = path.join(publicDir, 'rainfall-history.json');
    await fsPromises.writeFile(publicPath, JSON.stringify(history, null, 2));
    
    console.log(`✅ Successfully processed ${processedData.length} records`);
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`🌐 Also saved to: ${publicPath}`);
    console.log(`🔄 Refresh your browser at http://localhost:3000 to see the real data!`);

  } catch (error) {
    console.error('❌ Error processing CSV:', error.message);
    console.log('\n💡 The CSV file was downloaded but couldn\'t be processed');
    console.log(`📁 Check the raw file at: ${csvPath}`);
  }
}

// Run the download
downloadRainfallCSV()
  .then((filePath) => {
    console.log(`\n🎉 Rainfall data download and processing completed!`);
    console.log(`📁 Raw CSV saved to: ${filePath}`);
  })
  .catch((error) => {
    console.error('❌ Download failed:', error.message);
    console.log('\n💡 You can also manually download the CSV from:');
    console.log('🌐 https://check-for-flooding.service.gov.uk/rainfall-station-csv/1141');
    console.log('📝 Then run: node scripts/process-csv.js path/to/downloaded/file.csv');
  }); 