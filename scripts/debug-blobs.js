#!/usr/bin/env node

/**
 * Debug script to check what's actually in Netlify Blobs
 * This will help us understand why the frontend isn't showing all stations
 */

async function debugBlobs() {
  console.log('🔍 Debugging Netlify Blobs...');
  
  try {
    // Dynamic import for @netlify/blobs
    const { getStore } = await import('@netlify/blobs');
    
    const store = getStore({
      name: 'rainfall-data',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN
    });
    
    console.log(`🔑 Using site: ${process.env.NETLIFY_SITE_ID}`);
    
    // List all blobs in the stations folder
    console.log('\n📋 Listing all blobs with stations/ prefix...');
    const { blobs } = await store.list({ prefix: 'stations/' });
    
    console.log(`📊 Found ${blobs.length} blobs in stations/ folder:`);
    
    const stations = [];
    let validStations = 0;
    let invalidStations = 0;
    
    for (const blob of blobs) {
      console.log(`\n📄 Processing: ${blob.key}`);
      
      try {
        const content = await store.get(blob.key);
        const data = typeof content === 'string' ? JSON.parse(content) : content;
        
        console.log(`  📊 Data structure check:`);
        console.log(`    - Has 'station' field: ${!!data.station}`);
        console.log(`    - Has 'stationName' field: ${!!data.stationName}`);
        console.log(`    - Has 'label' field: ${!!data.label}`);
        console.log(`    - Has 'data' array: ${!!(data.data && Array.isArray(data.data))}`);
        console.log(`    - Record count: ${data.data ? data.data.length : 'N/A'}`);
        
        if (data && data.station) {
          // Extract station key from blob path
          const stationKey = blob.key.replace('stations/', '').replace('.json', '');
          
          const station = {
            key: stationKey,
            id: data.station,
            label: data.label || data.stationName || `Station ${data.station}`,
            name: data.stationName,
            provider: data.provider || 'Unknown',
            country: data.country || 'Unknown',
            location: data.location,
            lastUpdated: data.lastUpdated,
            recordCount: data.recordCount || (data.data ? data.data.length : 0),
            source: 'blob'
          };
          
          stations.push(station);
          validStations++;
          
          console.log(`  ✅ Valid station:`);
          console.log(`    - Key: ${station.key}`);
          console.log(`    - ID: ${station.id}`);
          console.log(`    - Label: ${station.label}`);
          console.log(`    - Name: ${station.name}`);
          console.log(`    - Provider: ${station.provider}`);
          console.log(`    - Records: ${station.recordCount}`);
        } else {
          invalidStations++;
          console.log(`  ❌ Invalid station: Missing 'station' field`);
          console.log(`    - Available fields: ${Object.keys(data || {}).join(', ')}`);
        }
        
      } catch (error) {
        invalidStations++;
        console.log(`  ❌ Error processing blob: ${error.message}`);
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Valid stations: ${validStations}`);
    console.log(`❌ Invalid stations: ${invalidStations}`);
    console.log(`📋 Total blobs: ${blobs.length}`);
    
    if (stations.length > 0) {
      console.log('\n🎯 All valid stations that should appear in frontend:');
      stations.forEach((station, i) => {
        console.log(`  ${i + 1}. ${station.label} (${station.key})`);
      });
      
      console.log('\n🔄 Simulating API response:');
      const apiResponse = {
        stations,
        count: stations.length,
        timestamp: new Date().toISOString()
      };
      console.log(JSON.stringify(apiResponse, null, 2));
    }
    
    console.log('\n💡 If your frontend only shows 2 stations, check:');
    console.log('  1. Browser cache (hard refresh with Ctrl+F5)');
    console.log('  2. Frontend console for API errors');
    console.log('  3. Network tab to see actual API response');
    console.log('  4. Try opening your site in incognito mode');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.log('\n💡 Make sure you have:');
    console.log('  - NETLIFY_AUTH_TOKEN environment variable set');
    console.log('  - NETLIFY_SITE_ID environment variable set');
    process.exit(1);
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
  debugBlobs().catch((error) => {
    console.error('❌ Debug failed:', error.message);
    process.exit(1);
  });
}

module.exports = { debugBlobs };


