#!/usr/bin/env node

/**
 * Test rename for a single blob to verify the process works
 */

async function testRenameSingleBlob() {
  console.log('🧪 Testing rename for single blob: scaling-reservoir-035024ne.json');
  
  // Dynamic import for @netlify/blobs
  const { getStore } = await import('@netlify/blobs');
  
  // Configure store
  const store = getStore({
    name: 'rainfall-data',
    siteID: process.env.NETLIFY_SITE_ID || 'f9735549-2ceb-4b4b-8263-fd2d52f641bb',
    token: process.env.NETLIFY_AUTH_TOKEN || 'nfp_DfAAJ5BgQ3FX7HtRJkaJWsYRwUozjtw73a99'
  });
  
  const oldKey = 'stations/scaling-reservoir-035024ne.json';
  const newKey = 'stations/035024NE.json';
  
  try {
    console.log(`📥 Getting blob: ${oldKey}`);
    const blobContent = await store.get(oldKey);
    console.log(`✅ Found blob, size: ${blobContent.length} characters`);
    
    const blobData = typeof blobContent === 'string' ? JSON.parse(blobContent) : blobContent;
    console.log(`📊 Station ID: ${blobData.station}`);
    console.log(`📊 Station Name: ${blobData.stationName}`);
    console.log(`📊 Records: ${blobData.data ? blobData.data.length : 'no data'}`);
    
    // Check if target exists
    console.log(`🔍 Checking if target exists: ${newKey}`);
    try {
      await store.get(newKey);
      console.log(`❌ Target ${newKey} already exists!`);
      return;
    } catch (e) {
      if (e.message && e.message.includes('does not exist')) {
        console.log(`✅ Target ${newKey} does not exist, safe to proceed`);
      } else {
        console.log(`⚠️  Error checking target: ${e.message}`);
        return;
      }
    }
    
    // Copy to new key
    console.log(`📤 Copying to: ${newKey}`);
    await store.set(newKey, blobContent, {
      metadata: { 
        contentType: 'application/json',
        station: blobData.station,
        originalKey: oldKey,
        renamedAt: new Date().toISOString()
      }
    });
    
    // Verify the copy
    console.log(`🔍 Verifying copy...`);
    const verifyContent = await store.get(newKey);
    const verifyData = typeof verifyContent === 'string' ? JSON.parse(verifyContent) : verifyContent;
    
    if (verifyData.station === blobData.station && verifyData.data && Array.isArray(verifyData.data)) {
      console.log(`✅ Copy verified! Records: ${verifyData.data.length}`);
      
      // Delete the old key
      console.log(`🗑️  Deleting old key: ${oldKey}`);
      await store.delete(oldKey);
      
      console.log(`🎉 Successfully renamed ${oldKey} → ${newKey}`);
    } else {
      console.log(`❌ Copy verification failed`);
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

testRenameSingleBlob().catch(console.error);
