#!/usr/bin/env node

/**
 * Test script to debug the rainfall-data API function locally
 * This will help us understand why EA stations show "No Data Available"
 */

async function testRainfallDataAPI() {
  console.log('🔍 Testing rainfall-data API logic...');
  
  const testStations = ['preston-capes', 'brooksby', 'miserden1141'];
  
  for (const station of testStations) {
    console.log(`\n📊 Testing station: ${station}`);
    
    try {
      // Dynamic import for @netlify/blobs
      const { getStore } = await import('@netlify/blobs');
      
      const store = getStore({
        name: 'rainfall-data',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_AUTH_TOKEN
      });
      
      const blobKey = `stations/${station}.json`;
      console.log(`  🔍 Looking for blob: ${blobKey}`);
      
      const blobContent = await store.get(blobKey);
      console.log(`  ✅ Blob found, type: ${typeof blobContent}`);
      
      // Parse the JSON
      const blobData = typeof blobContent === 'string' ? JSON.parse(blobContent) : blobContent;
      
      console.log(`  📊 Data structure:`);
      console.log(`    - Has 'data' array: ${!!(blobData.data && Array.isArray(blobData.data))}`);
      console.log(`    - Records: ${blobData.data ? blobData.data.length : 'N/A'}`);
      console.log(`    - Station ID: ${blobData.station || 'N/A'}`);
      console.log(`    - Station Name: ${blobData.stationName || 'N/A'}`);
      console.log(`    - Last Updated: ${blobData.lastUpdated || 'N/A'}`);
      
      // Test the data format expected by frontend
      if (blobData.data && blobData.data.length > 0) {
        const sampleRecord = blobData.data[0];
        console.log(`    - Sample record:`, JSON.stringify(sampleRecord, null, 6));
      }
      
      // Simulate what the API should return
      const apiResponse = {
        data: blobData,
        source: 'blob',
        station: station,
        recordCount: blobData.data ? blobData.data.length : 0
      };
      
      console.log(`  🎯 API response size: ${JSON.stringify(apiResponse).length} bytes`);
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
}

// Check for required environment variables
if (!process.env.NETLIFY_AUTH_TOKEN || !process.env.NETLIFY_SITE_ID) {
  console.error('❌ Missing required environment variables:');
  console.log('  NETLIFY_AUTH_TOKEN:', process.env.NETLIFY_AUTH_TOKEN ? '✅ Set' : '❌ Missing');
  console.log('  NETLIFY_SITE_ID:', process.env.NETLIFY_SITE_ID ? '✅ Set' : '❌ Missing');
  console.log('\n💡 Set them with:');
  console.log('  export NETLIFY_AUTH_TOKEN="your_token"');
  console.log('  export NETLIFY_SITE_ID="your_site_id"');
  process.exit(1);
}

if (require.main === module) {
  testRainfallDataAPI().catch((error) => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testRainfallDataAPI };

