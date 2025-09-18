#!/usr/bin/env node

/**
 * Check the actual content of uploaded blobs
 */

async function checkBlobContent() {
  try {
    const { getStore } = await import('@netlify/blobs');
    
    const store = getStore({
      name: 'rainfall-data',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN
    });
    
    console.log('🔍 Checking blob content...');
    console.log(`Site ID: ${process.env.NETLIFY_SITE_ID}`);
    console.log(`Token length: ${process.env.NETLIFY_AUTH_TOKEN ? process.env.NETLIFY_AUTH_TOKEN.length : 'not set'}`);
    
    // Check Miserden blob
    console.log('\n📊 Checking Miserden station blob...');
    try {
      const miserdenData = await store.get('stations/miserden1141.json');
      console.log(`Type: ${typeof miserdenData}`);
      console.log(`Length: ${miserdenData ? miserdenData.length : 'null'}`);
      
      if (miserdenData) {
        const preview = typeof miserdenData === 'string' 
          ? miserdenData.substring(0, 200)
          : JSON.stringify(miserdenData).substring(0, 200);
        console.log(`Preview: ${preview}...`);
        
        // Try to parse if it's a string
        if (typeof miserdenData === 'string') {
          try {
            const parsed = JSON.parse(miserdenData);
            console.log(`✅ Valid JSON with ${parsed.data ? parsed.data.length : 0} records`);
            console.log(`Last updated: ${parsed.lastUpdated}`);
          } catch (parseError) {
            console.log(`❌ Invalid JSON: ${parseError.message}`);
          }
        } else {
          console.log(`✅ Object with ${miserdenData.data ? miserdenData.data.length : 0} records`);
        }
      }
    } catch (error) {
      console.error(`❌ Error getting Miserden blob: ${error.message}`);
    }
    
    // List all blobs
    console.log('\n📦 Listing all blobs...');
    try {
      const { blobs } = await store.list();
      console.log(`Found ${blobs.length} blobs:`);
      for (const blob of blobs) {
        console.log(`  - ${blob.key}`);
      }
    } catch (error) {
      console.error(`❌ Error listing blobs: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to check blob content:', error.message);
    console.error('📋 Make sure NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID are set');
  }
}

checkBlobContent();
