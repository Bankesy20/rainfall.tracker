#!/usr/bin/env node

/**
 * Clean up duplicate EA station blobs from Netlify storage
 * This script removes old/duplicate EA station files while preserving production data
 */

async function cleanupDuplicateBlobs() {
  console.log('🧹 Cleaning up duplicate EA station blobs...');
  
  try {
    // Dynamic import for @netlify/blobs
    const { getStore } = await import('@netlify/blobs');
    
    const store = getStore({
      name: 'rainfall-data',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN
    });
    
    console.log(`🔑 Using site: ${process.env.NETLIFY_SITE_ID}`);
    console.log(`🔑 Token length: ${process.env.NETLIFY_AUTH_TOKEN ? process.env.NETLIFY_AUTH_TOKEN.length : 'not set'}`);
    
    // Files to delete (all the duplicates and old formats)
    const filesToDelete = [
      // Old format EA stations (without hyphens)
      'stations/ea3014.json',
      'stations/ea3167.json', 
      'stations/ea3275.json',
      'stations/ea3307.json',
      'stations/ea3404.json',
      'stations/ea3680.json',
      'stations/ea3901.json',
      'stations/ea3999.json',
      
      // Old format with different naming
      'stations/eaE6380.json',
      'stations/eaE7050.json',
      
      // Current format duplicates (if any exist from multiple runs)
      'stations/ea-3014.json',
      'stations/ea-3167.json',
      'stations/ea-3275.json', 
      'stations/ea-3307.json',
      'stations/ea-3404.json',
      'stations/ea-3680.json',
      'stations/ea-3901.json',
      'stations/ea-3999.json',
      'stations/ea-E13600.json',
      'stations/ea-E7050.json',
      
      // Clean up any existing name-based files from previous attempts
      'stations/preston-capes.json',
      'stations/brooksby.json',
      'stations/walsall-wood.json',
      'stations/frankley.json',
      'stations/hollinsclough.json',
      'stations/barbrook.json',
      'stations/stone.json',
      'stations/worksop.json',
      'stations/littlethorpe.json',
      'stations/lyndhurst.json'
    ];
    
    console.log(`🗑️  Attempting to delete ${filesToDelete.length} blob files...`);
    
    let deletedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    
    for (const blobKey of filesToDelete) {
      try {
        console.log(`  🗑️  Deleting: ${blobKey}`);
        
        // Check if blob exists first
        const exists = await store.get(blobKey);
        if (!exists) {
          console.log(`    ⏭️  Not found, skipping`);
          notFoundCount++;
          continue;
        }
        
        // Delete the blob
        await store.delete(blobKey);
        console.log(`    ✅ Deleted successfully`);
        deletedCount++;
        
        // Small delay to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        if (error.message.includes('not found') || error.message.includes('404')) {
          console.log(`    ⏭️  Not found, skipping`);
          notFoundCount++;
        } else {
          console.error(`    ❌ Error deleting ${blobKey}:`, error.message);
          errorCount++;
        }
      }
    }
    
    console.log('\n📊 Cleanup Summary:');
    console.log(`✅ Deleted: ${deletedCount} files`);
    console.log(`⏭️  Not found: ${notFoundCount} files`);
    console.log(`❌ Errors: ${errorCount} files`);
    
    // List remaining files in stations folder
    console.log('\n📋 Remaining files in stations/ folder:');
    try {
      const { blobs } = await store.list({ prefix: 'stations/' });
      if (blobs.length === 0) {
        console.log('  (no files found)');
      } else {
        for (const blob of blobs) {
          console.log(`  📄 ${blob.key}`);
        }
      }
    } catch (error) {
      console.log('  ⚠️  Could not list remaining files:', error.message);
    }
    
    if (errorCount > 0) {
      console.log('\n⚠️  Some files could not be deleted. You may need to clean them manually.');
      process.exit(1);
    } else {
      console.log('\n🎉 Cleanup completed successfully!');
      console.log('📋 Next steps:');
      console.log('  1. Re-run the "Test EA Stations" GitHub Actions workflow');
      console.log('  2. Check your frontend - should show stations with proper names');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    console.log('\n💡 Make sure you have:');
    console.log('  - NETLIFY_AUTH_TOKEN environment variable set');
    console.log('  - NETLIFY_SITE_ID environment variable set');
    console.log('  - Correct permissions for blob storage');
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
  cleanupDuplicateBlobs().catch((error) => {
    console.error('❌ Blob cleanup failed:', error.message);
    process.exit(1);
  });
}

module.exports = { cleanupDuplicateBlobs };
