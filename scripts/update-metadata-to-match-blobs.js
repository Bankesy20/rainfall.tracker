#!/usr/bin/env node

/**
 * Update stations-metadata.json to use blob keys instead of station IDs
 * This matches your frontend to your existing blob storage structure
 */

const fs = require('fs').promises;
const path = require('path');

async function updateMetadataToMatchBlobs() {
  console.log('🔄 Updating stations-metadata.json to match blob storage...');
  
  // Read the blob filenames
  const blobFilenames = await fs.readFile('blob-filenames.txt', 'utf-8');
  const blobs = blobFilenames.split('\n').filter(line => line.trim()).map(line => line.trim());
  
  console.log(`📦 Found ${blobs.length} blob files`);
  
  // Create mapping from station ID to blob key
  const stationIdToBlobKey = {};
  const blobKeyToStationId = {};
  
  for (const blobFilename of blobs) {
    if (!blobFilename.endsWith('.json')) continue;
    
    const blobKey = blobFilename.replace('.json', '');
    
    // Extract station ID from blob filename
    // Pattern examples:
    // abbeystead-gardens-577794.json -> 577794
    // acle-e21234.json -> E21234  
    // abingdon-261021tp.json -> 261021TP
    // maenclochog1099.json -> 1099
    // miserden1141.json -> 1141
    
    let stationId = null;
    
    // Try to extract station ID from end of filename
    const lastPart = blobKey.split('-').pop();
    
    if (/^[0-9]+$/.test(lastPart)) {
      // Pure numbers: 577794, 1141, 1099
      stationId = lastPart;
    } else if (/^[eE][0-9]+$/i.test(lastPart)) {
      // E-prefixed: e21234 -> E21234
      stationId = lastPart.toUpperCase();
    } else if (/^[0-9]+[a-zA-Z]+$/i.test(lastPart)) {
      // Number with suffix: 261021tp -> 261021TP
      stationId = lastPart.toUpperCase();
    } else if (/^[a-zA-Z0-9]+$/i.test(lastPart)) {
      // Could be a direct station ID in various formats
      stationId = lastPart.toUpperCase();
    }
    
    // Special cases for known patterns
    if (blobKey === 'maenclochog1099') {
      stationId = '1099';
    } else if (blobKey === 'miserden1141') {
      stationId = '1141';
    } else if (blobKey.includes('preston-capes')) {
      stationId = 'E7050';
    } else if (blobKey.includes('ashdon')) {
      stationId = 'E19017';
    } else if (blobKey.includes('lyndhurst')) {
      stationId = 'E13600';
    } else if (blobKey.includes('hullbridge-raine')) {
      stationId = 'E24879';
    } else if (blobKey.includes('lower-standen')) {
      stationId = 'E5170';
    } else if (blobKey.includes('hethersett')) {
      stationId = 'E23518';
    } else if (blobKey.includes('tiptree')) {
      stationId = 'E24913';
    } else if (blobKey.includes('isfield-weir')) {
      stationId = 'E8290';
    } else if (blobKey.includes('red-br')) {
      stationId = '577271';
    }
    
    if (stationId) {
      stationIdToBlobKey[stationId] = blobKey;
      blobKeyToStationId[blobKey] = stationId;
      console.log(`🔗 ${stationId} -> ${blobKey}`);
    } else {
      console.log(`⚠️  Could not extract station ID from: ${blobKey}`);
    }
  }
  
  console.log(`\n📊 Created ${Object.keys(stationIdToBlobKey).length} mappings`);
  
  // Read current metadata
  const metadataPath = path.join(__dirname, '..', 'data', 'processed', 'stations-metadata.json');
  const metadataContent = await fs.readFile(metadataPath, 'utf-8');
  const metadata = JSON.parse(metadataContent);
  
  console.log(`📖 Current metadata has ${metadata.count} stations`);
  
  // Create new metadata structure using blob keys
  const newStations = {};
  let matchedCount = 0;
  let unmatchedCount = 0;
  
  for (const [currentKey, stationData] of Object.entries(metadata.stations)) {
    const stationId = stationData.stationId || currentKey;
    const blobKey = stationIdToBlobKey[stationId];
    
    if (blobKey) {
      // Use blob key as the new key
      newStations[blobKey] = {
        ...stationData,
        key: blobKey,
        blobKey: blobKey,
        originalKey: currentKey,
        matchedAt: new Date().toISOString()
      };
      matchedCount++;
      
      if (matchedCount <= 5) {
        console.log(`✅ ${currentKey} (${stationId}) -> ${blobKey}`);
      }
    } else {
      // Keep original key for stations without blob matches
      newStations[currentKey] = {
        ...stationData,
        hasBlob: false,
        note: 'No matching blob found'
      };
      unmatchedCount++;
      
      if (unmatchedCount <= 5) {
        console.log(`⚠️  ${currentKey} (${stationId}) -> no blob match`);
      }
    }
  }
  
  // Create updated metadata
  const updatedMetadata = {
    ...metadata,
    lastUpdated: new Date().toISOString(),
    description: "Metadata updated to match blob storage keys",
    count: Object.keys(newStations).length,
    blobMappingStats: {
      totalStations: Object.keys(newStations).length,
      matchedToBlobs: matchedCount,
      unmatchedToBlobs: unmatchedCount,
      totalBlobs: blobs.length,
      mappingDate: new Date().toISOString()
    },
    stations: newStations
  };
  
  // Save backup
  const backupPath = metadataPath.replace('.json', `.backup-${new Date().toISOString().split('T')[0]}.json`);
  await fs.writeFile(backupPath, metadataContent);
  console.log(`💾 Backup saved to: ${backupPath}`);
  
  // Save updated metadata
  await fs.writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2));
  
  // Also update the public copy
  const publicPath = path.join(__dirname, '..', 'public', 'data', 'processed', 'stations-metadata.json');
  await fs.writeFile(publicPath, JSON.stringify(updatedMetadata, null, 2));
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 METADATA UPDATE SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Matched to blobs: ${matchedCount} stations`);
  console.log(`⚠️  No blob match: ${unmatchedCount} stations`);
  console.log(`📦 Total blobs: ${blobs.length}`);
  console.log(`📋 Total stations: ${Object.keys(newStations).length}`);
  console.log(`💾 Backup saved: ${backupPath}`);
  console.log(`📝 Updated: ${metadataPath}`);
  console.log(`🌐 Updated: ${publicPath}`);
  
  if (matchedCount > 0) {
    console.log('\n🎉 Metadata updated successfully!');
    console.log('💡 Your frontend should now use blob keys directly');
    console.log('🧪 Test with your React app - station switching should work now');
  }
  
  if (unmatchedCount > 0) {
    console.log(`\n⚠️  ${unmatchedCount} stations couldn't be matched to blobs`);
    console.log('💡 These will fall back to GitHub data as before');
  }
}

updateMetadataToMatchBlobs().catch(error => {
  console.error('❌ Metadata update failed:', error);
  process.exit(1);
});
