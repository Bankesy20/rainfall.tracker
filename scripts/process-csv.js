const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

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

    // Create the history object
    const history = {
      lastUpdated: new Date().toISOString(),
      station: "1141",
      data: processedData
    };

    // Save to the processed directory
    const outputPath = path.join(__dirname, '..', 'data', 'processed', 'rainfall-history.json');
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