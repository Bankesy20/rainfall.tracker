const fs = require('fs');
const dayjs = require('dayjs');

// Load E71440 data
const data = JSON.parse(fs.readFileSync('data/processed/ea-E71440.json', 'utf8'));

// Calculate 30-day total
const cutoffTime = dayjs().subtract(30, 'day').toDate();
const thirtyDayData = data.data.filter(record => new Date(record.dateTime) >= cutoffTime);

console.log(`Total records in last 30 days: ${thirtyDayData.length}`);
console.log(`Cutoff time: ${cutoffTime.toISOString()}`);

// Sum rainfall_mm values
const totalRainfall = thirtyDayData.reduce((sum, record) => sum + (record.rainfall_mm || 0), 0);
console.log(`Total rainfall (sum of rainfall_mm): ${totalRainfall} mm`);

// Check for any non-zero values
const nonZeroValues = thirtyDayData.filter(record => record.rainfall_mm > 0);
console.log(`Non-zero rainfall records: ${nonZeroValues.length}`);

if (nonZeroValues.length > 0) {
  console.log('Non-zero values:');
  nonZeroValues.forEach(record => {
    console.log(`  ${record.dateTime}: ${record.rainfall_mm}mm`);
  });
}

// Check for corrected records
const correctedRecords = thirtyDayData.filter(record => record.corrected === true);
console.log(`Corrected records: ${correctedRecords.length}`);

if (correctedRecords.length > 0) {
  console.log('Corrected records:');
  correctedRecords.forEach(record => {
    console.log(`  ${record.dateTime}: ${record.rainfall_mm}mm (was ${record.original_rainfall_mm}mm)`);
  });
}
