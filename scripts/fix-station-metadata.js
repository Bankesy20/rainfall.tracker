#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Station mapping for proper names and regions
const STATION_METADATA = {
  'E7050': { name: 'Preston Capes (E7050)', region: 'East Midlands' },
  'E19017': { name: 'Ashdon (E19017)', region: 'East of England' },
  'E13600': { name: 'Lyndhurst (E13600)', region: 'South East' },
  'E24879': { name: 'Hullbridge Raine (E24879)', region: 'South East' },
  'E5170': { name: 'Lower Standen (E5170)', region: 'South West' },
  'E23518': { name: 'Hethersett (E23518)', region: 'East of England' },
  'E24913': { name: 'Tiptree (E24913)', region: 'East of England' },
  'E8290': { name: 'Isfield Weir (E8290)', region: 'South East' },
  '577271': { name: 'Red Br (577271)', region: 'North West' },
  '031555': { name: 'Birmingham (031555)', region: 'West Midlands' }
};

async function fixStationMetadata() {
  const dataDir = path.join(__dirname, '..', 'data', 'processed');
  const publicDir = path.join(__dirname, '..', 'public', 'data', 'processed');
  
  try {
    const files = await fs.readdir(dataDir);
    const eaFiles = files.filter(f => f.startsWith('ea-') && f.endsWith('.json') && 
      !f.includes('england-stations') && !f.includes('rainfall-stations'));
    
    console.log(`Found ${eaFiles.length} EA station files to process`);
    
    for (const file of eaFiles) {
      try {
        const filePath = path.join(dataDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        
        if (data.station && STATION_METADATA[data.station]) {
          const metadata = STATION_METADATA[data.station];
          
          // Add missing fields
          data.label = metadata.name;
          data.provider = 'Environment Agency';
          data.country = 'England';
          
          // Write back to file
          await fs.writeFile(filePath, JSON.stringify(data, null, 2));
          
          // Also update public directory
          const publicPath = path.join(publicDir, file);
          await fs.writeFile(publicPath, JSON.stringify(data, null, 2));
          
          console.log(`✅ Updated ${file}: ${metadata.name}`);
        } else {
          console.log(`⚠️  Skipped ${file}: Unknown station ID ${data.station}`);
        }
      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error.message);
      }
    }
    
    console.log('\n🎉 Station metadata update complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  fixStationMetadata();
}

module.exports = { fixStationMetadata };
