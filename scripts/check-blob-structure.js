#!/usr/bin/env node

/**
 * Check the actual structure of Welsh station blobs
 */

async function checkBlobStructure() {
  console.log('🔍 Checking Welsh station blob structure...\n');
  
  try {
    // Dynamic import for @netlify/blobs
    const { getStore } = await import('@netlify/blobs');
    
    // Configure store
    const store = getStore({
      name: 'rainfall-data',
      siteID: process.env.NETLIFY_SITE_ID || 'f9735549-2ceb-4b4b-8263-fd2d52f641bb',
      token: process.env.NETLIFY_AUTH_TOKEN || 'nfp_DfAAJ5BgQ3FX7HtRJkaJWsYRwUozjtw73a99'
    });
    
    // Test specific blob
    const blobKey = 'stations/nant-y-ffrith-1012.json';
    console.log(`🔍 Checking blob structure: ${blobKey}`);
    
    const blobContent = await store.get(blobKey);
    if (blobContent) {
      const blobData = typeof blobContent === 'string' ? JSON.parse(blobContent) : blobContent;
      
      console.log('📊 Blob data structure:');
      console.log('=' .repeat(50));
      console.log(`Keys: ${Object.keys(blobData).join(', ')}`);
      console.log('');
      
      // Show each field
      Object.entries(blobData).forEach(([key, value]) => {
        if (key === 'data' && Array.isArray(value)) {
          console.log(`${key}: Array with ${value.length} items`);
          if (value.length > 0) {
            console.log(`  First item: ${JSON.stringify(value[0], null, 2)}`);
          }
        } else if (typeof value === 'object' && value !== null) {
          console.log(`${key}: Object with keys: ${Object.keys(value).join(', ')}`);
        } else {
          console.log(`${key}: ${value}`);
        }
      });
      
      console.log('\n🔍 Expected vs Actual:');
      console.log('=' .repeat(50));
      console.log(`Expected 'station': ${blobData.station || 'MISSING'}`);
      console.log(`Expected 'stationName': ${blobData.stationName || 'MISSING'}`);
      console.log(`Expected 'nameEN': ${blobData.nameEN || 'MISSING'}`);
      console.log(`Expected 'data': ${blobData.data ? 'Array with ' + blobData.data.length + ' items' : 'MISSING'}`);
      console.log(`Expected 'lastUpdated': ${blobData.lastUpdated || 'MISSING'}`);
      console.log(`Expected 'source': ${blobData.source || 'MISSING'}`);
      
    } else {
      console.log('❌ Blob not found');
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

if (require.main === module) {
  checkBlobStructure()
    .then(() => {
      console.log('\n✅ Blob structure check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Check failed:', error);
      process.exit(1);
    });
}

module.exports = checkBlobStructure;
