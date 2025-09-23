#!/usr/bin/env node

/**
 * Upload all stations from stations-metadata.json to Netlify Blobs
 * This script creates blob entries for all stations in your metadata
 */

const fs = require('fs').promises;
const path = require('path');

async function uploadAllStationsToBlobs() {
  console.log('🚀 Starting bulk station upload to blob storage...');
  
  // Dynamic import for @netlify/blobs
  const { getStore } = await import('@netlify/blobs');
  
  // Configure store with explicit site ID
  const siteId = process.env.NETLIFY_SITE_ID || 'f9735549-2ceb-4b4b-8263-fd2d52f641bb';
  
  let store;
  try {
    if (process.env.NETLIFY_AUTH_TOKEN && process.env.NETLIFY_SITE_ID) {
      store = getStore({
        name: 'rainfall-data',
        siteID: process.env.NETLIFY_SITE_ID,
        token: process.env.NETLIFY_AUTH_TOKEN
      });
      console.log(`  🔑 Using explicit auth for site: ${process.env.NETLIFY_SITE_ID}`);
    } else {
      store = getStore('rainfall-data');
      console.log('  🔑 Using Netlify CLI environment');
    }
  } catch (error) {
    console.log('❌ Could not initialize blob storage');
    console.log('💡 Make sure you are logged in with: netlify login');
    console.log('📋 Or set NETLIFY_AUTH_TOKEN environment variable');
    throw error;
  }

  // Load stations metadata
  const metadataPath = path.join(__dirname, '..', 'data', 'processed', 'stations-metadata.json');
  const metadataContent = await fs.readFile(metadataPath, 'utf-8');
  const metadata = JSON.parse(metadataContent);
  
  console.log(`📊 Found ${metadata.count} stations in metadata`);
  
  let successCount = 0;
  let errorCount = 0;
  const results = [];
  
  // Process each station
  for (const [stationKey, stationData] of Object.entries(metadata.stations)) {
    console.log(`\n📊 Processing ${stationData.name} (${stationKey})...`);
    
    try {
      // Create a minimal data structure for the station
      // Since we don't have actual rainfall data for all stations,
      // we'll create a placeholder that indicates no data is available
      const stationBlobData = {
        station: stationData.stationId || stationKey,
        name: stationData.name,
        label: stationData.label,
        provider: stationData.provider,
        country: stationData.country,
        region: stationData.region,
        coordinates: stationData.coordinates,
        gridReference: stationData.gridReference,
        data: [], // Empty data array - no actual rainfall data
        hasData: stationData.hasData || false,
        lastUpdated: new Date().toISOString(),
        source: 'metadata-upload',
        note: 'Station metadata uploaded - no rainfall data available'
      };
      
      // Upload to blob storage using the station ID as the key
      const blobKey = `stations/${stationData.stationId || stationKey}.json`;
      console.log(`  ☁️  Uploading to: ${blobKey}`);
      
      await store.set(blobKey, JSON.stringify(stationBlobData), {
        metadata: { 
          contentType: 'application/json',
          station: stationData.stationId || stationKey,
          name: stationData.name,
          hasData: stationData.hasData ? 'true' : 'false'
        }
      });
      
      console.log(`  ✅ Successfully uploaded metadata for ${stationData.name}`);
      
      results.push({
        station: stationKey,
        stationId: stationData.stationId || stationKey,
        name: stationData.name,
        success: true,
        hasData: stationData.hasData || false
      });
      
      successCount++;
      
    } catch (error) {
      console.error(`  ❌ Error uploading ${stationKey}: ${error.message}`);
      
      results.push({
        station: stationKey,
        success: false,
        error: error.message
      });
      
      errorCount++;
    }
  }
  
  // Upload summary metadata
  try {
    const summary = {
      uploadedAt: new Date().toISOString(),
      totalStations: metadata.count,
      successfulUploads: successCount,
      failedUploads: errorCount,
      results: results,
      version: '2.0.0',
      description: 'All stations from stations-metadata.json uploaded to blob storage'
    };
    
    await store.set('metadata/stations-summary.json', summary);
    console.log('\n📋 Upload summary saved');
    
  } catch (error) {
    console.error('\n⚠️  Warning: Could not save upload summary:', error.message);
  }
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 BULK UPLOAD SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful uploads: ${successCount}`);
  console.log(`❌ Failed uploads: ${errorCount}`);
  console.log(`📈 Total stations processed: ${metadata.count}`);
  console.log(`📊 Success rate: ${((successCount / metadata.count) * 100).toFixed(1)}%`);
  
  if (successCount > 0) {
    console.log('\n🎉 All station metadata uploaded to blob storage!');
    console.log('💡 Now your API can find stations by their station ID');
    console.log('🔧 Test with: curl "https://rainfalltracker.netlify.app/.netlify/functions/rainfall-data?station=035024NE&debug=1"');
  }
  
  if (errorCount > 0) {
    console.log('\n⚠️  Some uploads failed. Check the error messages above.');
  }
}

// Run the upload
uploadAllStationsToBlobs().catch(console.error);
