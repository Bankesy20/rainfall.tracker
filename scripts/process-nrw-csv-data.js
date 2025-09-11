const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

// Process the NRW CSV data and convert to our JSON format
async function processNRWCSV() {
  const csvPath = path.join(__dirname, '..', '20250910154025.csv');
  const outputPath = path.join(__dirname, '..', 'data', 'processed', 'wales-1099.json');
  const publicOutputPath = path.join(__dirname, '..', 'public', 'data', 'processed', 'wales-1099.json');
  
  console.log('Processing NRW CSV data...');
  
  try {
    // Read the CSV file
    const csvContent = await fs.readFile(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    console.log(`Read ${lines.length} lines from CSV`);
    
    // Find the data section (after the header info)
    let dataStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('Date (UTC),Value')) {
        dataStartIndex = i + 1;
        break;
      }
    }
    
    if (dataStartIndex === -1) {
      throw new Error('Could not find data section in CSV');
    }
    
    console.log(`Data starts at line ${dataStartIndex + 1}`);
    
    // Process the data lines
    const data = [];
    let totalRainfall = 0;
    
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const [dateTimeStr, valueStr] = line.split(',');
      if (!dateTimeStr || !valueStr) continue;
      
      const dateTime = dayjs(dateTimeStr);
      const rainfall_mm = parseFloat(valueStr) || 0;
      
      // Add to running total
      totalRainfall += rainfall_mm;
      
      data.push({
        date: dateTime.format('YYYY-MM-DD'),
        time: dateTime.format('HH:mm'),
        rainfall_mm: rainfall_mm,
        total_mm: totalRainfall
      });
    }
    
    console.log(`Processed ${data.length} data points`);
    console.log(`Total rainfall: ${totalRainfall.toFixed(2)} mm`);
    
    // Create the JSON structure
    const jsonData = {
      lastUpdated: new Date().toISOString(),
      station: "wales-1099",
      nameEN: "Maenclochog",
      nameCY: "Maenclochog",
      source: "NRW",
      data: data
    };
    
    // Ensure directories exist
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.mkdir(path.dirname(publicOutputPath), { recursive: true });
    
    // Write the JSON files
    await fs.writeFile(outputPath, JSON.stringify(jsonData, null, 2));
    await fs.writeFile(publicOutputPath, JSON.stringify(jsonData, null, 2));
    
    console.log(`✅ Successfully processed NRW data!`);
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`📁 Saved to: ${publicOutputPath}`);
    console.log(`📊 Data range: ${data[0]?.date} to ${data[data.length - 1]?.date}`);
    console.log(`🌧️ Total rainfall: ${totalRainfall.toFixed(2)} mm`);
    
  } catch (error) {
    console.error('❌ Error processing NRW CSV:', error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  processNRWCSV()
    .then(() => {
      console.log('NRW CSV processing completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('NRW CSV processing failed:', error);
      process.exit(1);
    });
}

module.exports = processNRWCSV;
