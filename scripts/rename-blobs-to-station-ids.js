#!/usr/bin/env node

/**
 * Rename existing blobs from slugified names to station IDs
 * This preserves all your existing data while fixing the naming convention
 */

const fs = require('fs').promises;

async function renameBlobsToStationIds() {
  console.log('🔄 Renaming existing blobs to use station IDs as keys...');
  
  // Dynamic import for @netlify/blobs
  const { getStore } = await import('@netlify/blobs');
  
  // Configure store
  const store = getStore({
    name: 'rainfall-data',
    siteID: process.env.NETLIFY_SITE_ID || 'f9735549-2ceb-4b4b-8263-fd2d52f641bb',
    token: process.env.NETLIFY_AUTH_TOKEN || 'nfp_DfAAJ5BgQ3FX7HtRJkaJWsYRwUozjtw73a99'
  });
  
  console.log(`🔑 Using site: ${process.env.NETLIFY_SITE_ID || 'f9735549-2ceb-4b4b-8263-fd2d52f641bb'}`);
  
  // Get all existing station blobs
  const { blobs } = await store.list({ prefix: 'stations/' });
  const stationBlobs = blobs.filter(blob => 
    blob.key.startsWith('stations/') && 
    blob.key.endsWith('.json') &&
    !blob.key.match(/^stations\/[A-Z0-9]+\.json$/) // Skip ones already using station IDs
  );
  
  console.log(`📦 Found ${stationBlobs.length} blobs to potentially rename`);
  
  let renamedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const renamedBlobs = [];
  
  for (const blob of stationBlobs) {
    console.log(`\n🔍 Processing: ${blob.key}`);
    
    try {
      // Get the blob content
      const blobContent = await store.get(blob.key);
      const blobData = typeof blobContent === 'string' ? JSON.parse(blobContent) : blobContent;
      
      // Extract the station ID
      const stationId = blobData.station;
      if (!stationId) {
        console.log(`  ⚠️  No station ID found, skipping`);
        skippedCount++;
        continue;
      }
      
      // Create the new key
      const newKey = `stations/${stationId}.json`;
      
      // Check if it would conflict with existing key
      if (newKey === blob.key) {
        console.log(`  ✅ Already has correct name`);
        skippedCount++;
        continue;
      }
      
      // Check if new key already exists
      try {
        const existingBlob = await store.get(newKey);
        if (existingBlob) {
          console.log(`  ⚠️  Target key ${newKey} already exists, skipping to avoid conflict`);
          skippedCount++;
          continue;
        }
      } catch (e) {
        // Good, new key doesn't exist (this is what we want)
        if (e.message && e.message.includes('does not exist')) {
          // Perfect, we can proceed with the rename
        } else {
          // Some other error, log it but continue
          console.log(`  ⚠️  Error checking ${newKey}: ${e.message}`);
        }
      }
      
      console.log(`  📋 Station: ${blobData.stationName || stationId}`);
      console.log(`  🔄 Renaming: ${blob.key} → ${newKey}`);
      
      // Copy to new key
      await store.set(newKey, blobContent, {
        metadata: { 
          contentType: 'application/json',
          station: stationId,
          originalKey: blob.key,
          renamedAt: new Date().toISOString()
        }
      });
      
      // Verify the copy worked
      const verifyContent = await store.get(newKey);
      const verifyData = typeof verifyContent === 'string' ? JSON.parse(verifyContent) : verifyContent;
      
      if (verifyData.station === stationId && verifyData.data && Array.isArray(verifyData.data)) {
        // Delete the old key
        await store.delete(blob.key);
        
        console.log(`  ✅ Successfully renamed (${verifyData.data.length} records preserved)`);
        
        renamedBlobs.push({
          oldKey: blob.key,
          newKey: newKey,
          stationId: stationId,
          stationName: blobData.stationName || stationId,
          recordCount: verifyData.data.length
        });
        
        renamedCount++;
      } else {
        console.log(`  ❌ Verification failed, not deleting original`);
        errorCount++;
      }
      
    } catch (error) {
      console.error(`  ❌ Error processing ${blob.key}: ${error.message}`);
      errorCount++;
    }
  }
  
  // Save rename log
  try {
    const renameLog = {
      renamedAt: new Date().toISOString(),
      totalProcessed: stationBlobs.length,
      renamed: renamedCount,
      skipped: skippedCount,
      errors: errorCount,
      renamedBlobs: renamedBlobs
    };
    
    await store.set('metadata/blob-rename-log.json', renameLog);
    console.log('\n📋 Rename log saved to metadata/blob-rename-log.json');
  } catch (error) {
    console.error('\n⚠️  Warning: Could not save rename log:', error.message);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🔄 BLOB RENAME SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successfully renamed: ${renamedCount} blobs`);
  console.log(`⏭️  Skipped: ${skippedCount} blobs`);
  console.log(`❌ Errors: ${errorCount} blobs`);
  console.log(`📊 Total processed: ${stationBlobs.length} blobs`);
  
  if (renamedCount > 0) {
    console.log('\n🎉 Blob renaming completed successfully!');
    console.log('💡 Your API should now work with station IDs directly');
    console.log('🧪 Test with: curl "https://rainfalltracker.netlify.app/.netlify/functions/rainfall-data?station=035024NE&debug=1"');
  }
  
  if (errorCount > 0) {
    console.log('\n⚠️  Some renames failed. Check error messages above.');
    process.exit(1);
  }
}

renameBlobsToStationIds().catch(error => {
  console.error('❌ Blob rename failed:', error);
  process.exit(1);
});
