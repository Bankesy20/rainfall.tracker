const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

// Test the data processing functions
async function testDataProcessing() {
  console.log('Testing data processing...');
  
  // Test CSV processing
  const mockCSV = `Date,Time,Rainfall (mm),Total (mm)
2024-12-07,08:00,0.0,0.0
2024-12-07,09:00,0.2,0.2
2024-12-07,10:00,1.5,1.7
2024-12-07,11:00,2.3,4.0
2024-1207,12:00,0.8,4.8`;

  const lines = mockCSV.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length >= headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index].trim();
      });
      data.push(row);
    }
  }

  console.log('Parsed CSV data:', data);
  
  // Test data conversion logic
  const processedData = data.map(row => {
    let date = '';
    let time = '';
    let rainfall_mm = 0;
    let total_mm = 0;

    for (const [key, value] of Object.entries(row)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('date')) {
        date = value;
      } else if (lowerKey.includes('time')) {
        time = value;
      } else if (lowerKey.includes('rainfall')) {
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

  console.log('Processed data:', processedData);
  
  // Test history update
  const history = {
    lastUpdated: new Date().toISOString(),
    station: "1141",
    data: []
  };

  const existingDates = new Set(history.data.map(item => `${item.date}_${item.time}`));
  
  for (const item of processedData) {
    const key = `${item.date}_${item.time}`;
    if (!existingDates.has(key)) {
      history.data.push(item);
      existingDates.add(key);
    }
  }

  history.data.sort((a, b) => {
    const dateA = new Date(`${a.date} ${a.time}`);
    const dateB = new Date(`${b.date} ${b.time}`);
    return dateA - dateB;
  });

  console.log('Updated history:', history);
  
  return history;
}

// Test file operations
async function testFileOperations() {
  console.log('Testing file operations...');
  
  const DATA_DIR = path.join(__dirname, '..', 'data');
  const RAW_DIR = path.join(DATA_DIR, 'raw');
  const PROCESSED_DIR = path.join(DATA_DIR, 'processed');
  
  // Ensure directories exist
  const dirs = [DATA_DIR, RAW_DIR, PROCESSED_DIR];
  for (const dir of dirs) {
    try {
      await fs.access(dir);
      console.log(`Directory exists: ${dir}`);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  }
  
  // Test writing sample data
  const history = await testDataProcessing();
  const historyByName = path.join(PROCESSED_DIR, 'rainfall-history.json');
  
  await fs.writeFile(historyByName, JSON.stringify(history, null, 2));
  console.log(`Written test data to: ${historyByName}`);
  
  // Copy to public directory for development server
  const publicDataDir = path.join(__dirname, '..', 'public', 'data', 'processed');
  const publicHistoryFile = path.join(publicDataDir, 'rainfall-history.json');
  
  try {
    await fs.mkdir(publicDataDir, { recursive: true });
    await fs.copyFile(historyByName, publicHistoryFile);
    console.log('Copied data to public directory for development server');
  } catch (error) {
    console.log('Could not copy to public directory:', error.message);
  }
  
  // Test reading the data back
  const readData = await fs.readFile(historyByName, 'utf-8');
  const parsedData = JSON.parse(readData);
  console.log('Successfully read back data:', parsedData.station, parsedData.data.length, 'records');
}

// Run tests
async function runTests() {
  try {
    console.log('Starting scraper tests...');
    console.log(`Current time: ${new Date().toISOString()}`);
    
    await testFileOperations();
    
    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runTests();
}

module.exports = { testDataProcessing, testFileOperations }; 