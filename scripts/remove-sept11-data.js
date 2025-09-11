const fs = require('fs').promises;
const path = require('path');

// Remove all September 11th data from the NRW data files
async function removeSeptember11Data() {
  const files = [
    path.join(__dirname, '..', 'data', 'processed', 'wales-1099.json'),
    path.join(__dirname, '..', 'public', 'data', 'processed', 'wales-1099.json')
  ];
  
  for (const filePath of files) {
    try {
      console.log(`Processing ${filePath}...`);
      
      // Read the file
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      // Remove all data for September 11th, 2025
      const originalLength = data.data.length;
      data.data = data.data.filter(item => item.date !== '2025-09-11');
      const removedCount = originalLength - data.data.length;
      
      // Update last updated timestamp
      data.lastUpdated = new Date().toISOString();
      
      // Write back to file
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      
      console.log(`✅ Removed ${removedCount} sample data entries for 2025-09-11`);
      
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  }
  
  console.log('✅ September 11th sample data removal completed');
}

// Run if called directly
if (require.main === module) {
  removeSeptember11Data()
    .then(() => {
      console.log('Sample data removal completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Sample data removal failed:', error);
      process.exit(1);
    });
}

module.exports = removeSeptember11Data;
