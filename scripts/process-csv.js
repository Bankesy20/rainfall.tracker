const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');
const RainfallOutlierDetector = require('./outlier-detection');

/**
 * Process a downloaded CSV file into the dashboard format
 * Usage: node scripts/process-csv.js path/to/your/downloaded/file.csv
 */

async function processCSVFile(csvPath) {
  try {
    console.log(`Processing CSV file: ${csvPath}`);
    
    // Read the CSV file
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV file is empty or invalid');
    }

    // Parse CSV header
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('CSV headers:', headers);

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

    console.log(`Parsed ${data.length} data rows`);

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
            const dt = dayjs(dateTime);
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

    // Merge with existing processed data and prefer higher readings for the same slot
    const outputPath = path.join(__dirname, '..', 'data', 'processed', 'rainfall-history.json');
    let existingData = [];
    try {
      const existingFile = await fs.readFile(outputPath, 'utf-8');
      const existingHistory = JSON.parse(existingFile);
      existingData = existingHistory.data || [];
    } catch (_) {}

    const toKey = (item) => `${item.date} ${item.time}`;
    const mergedMap = new Map(existingData.map(item => [toKey(item), item]));

    for (const item of processedData) {
      const key = toKey(item);
      const existing = mergedMap.get(key);
      if (!existing) {
        mergedMap.set(key, item);
      } else {
        const existingVal = Number(existing.rainfall_mm) || 0;
        const incomingVal = Number(item.rainfall_mm) || 0;
        if (incomingVal > existingVal) {
          mergedMap.set(key, item);
        }
      }
    }

    const mergedData = Array.from(mergedMap.values()).sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`);
      const dateB = new Date(`${b.date} ${b.time}`);
      return dateA - dateB;
    });

    // Check for outliers and correct them
    console.log('🔍 Checking for rainfall outliers...');
    const detector = new RainfallOutlierDetector(25);
    const stationData = {
      station: "1141",
      data: mergedData
    };
    
    const outlierResult = detector.processStationData(stationData);
    let finalData = outlierResult.correctedData.data;
    
    if (outlierResult.hadOutliers) {
      console.log(`🔧 Corrected ${outlierResult.corrections.length} outliers in the data`);
      // Log corrections for transparency
      outlierResult.corrections.forEach(correction => {
        console.log(`  Fixed: ${correction.timestamp} ${correction.original}mm → ${correction.corrected}mm`);
      });
    }

    // Create the history object
    const history = {
      lastUpdated: new Date().toISOString(),
      station: "1141",
      data: finalData,
      ...(outlierResult.hadOutliers && {
        outlierDetection: outlierResult.correctedData.outlierDetection
      })
    };

    // Save to the processed directory
    await fs.writeFile(outputPath, JSON.stringify(history, null, 2));
    
    // Also copy to public directory for development
    const publicPath = path.join(__dirname, '..', 'public', 'data', 'processed', 'rainfall-history.json');
    await fs.writeFile(publicPath, JSON.stringify(history, null, 2));
    
    console.log(`✅ Successfully processed ${processedData.length} records`);
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`🌐 Also saved to: ${publicPath}`);
    console.log(`🔄 Refresh your browser to see the new data!`);

  } catch (error) {
    console.error('❌ Error processing CSV:', error.message);
    console.log('\n💡 Make sure you have a valid CSV file with rainfall data');
  }
}

// Get the CSV file path from command line arguments
const csvPath = process.argv[2];

if (!csvPath) {
  console.log('❌ Please provide the path to your CSV file');
  console.log('Usage: node scripts/process-csv.js path/to/your/file.csv');
  console.log('\nExample: node scripts/process-csv.js ~/Downloads/rainfall-data.csv');
  process.exit(1);
}

processCSVFile(csvPath); 