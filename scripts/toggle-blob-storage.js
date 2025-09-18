#!/usr/bin/env node

/**
 * Toggle blob storage on/off for safe testing
 * This script helps you safely switch between blob storage and file-based storage
 */

const fs = require('fs').promises;
const path = require('path');

const NETLIFY_TOML_PATH = path.join(__dirname, '..', 'netlify.toml');

async function getCurrentConfig() {
  try {
    const content = await fs.readFile(NETLIFY_TOML_PATH, 'utf-8');
    
    const useBlobMatch = content.match(/USE_BLOB_STORAGE = "([^"]+)"/);
    const fallbackMatch = content.match(/BLOB_FALLBACK_ENABLED = "([^"]+)"/);
    
    return {
      useBlobStorage: useBlobMatch ? useBlobMatch[1] === 'true' : false,
      fallbackEnabled: fallbackMatch ? fallbackMatch[1] === 'true' : true
    };
  } catch (error) {
    console.error('❌ Error reading netlify.toml:', error.message);
    return null;
  }
}

async function updateConfig(useBlobStorage, fallbackEnabled = true) {
  try {
    const content = await fs.readFile(NETLIFY_TOML_PATH, 'utf-8');
    
    let newContent = content
      .replace(/USE_BLOB_STORAGE = "[^"]+"/g, `USE_BLOB_STORAGE = "${useBlobStorage}"`)
      .replace(/BLOB_FALLBACK_ENABLED = "[^"]+"/g, `BLOB_FALLBACK_ENABLED = "${fallbackEnabled}"`);
    
    await fs.writeFile(NETLIFY_TOML_PATH, newContent);
    
    return true;
  } catch (error) {
    console.error('❌ Error updating netlify.toml:', error.message);
    return false;
  }
}

async function showStatus() {
  console.log('🔍 Current Configuration Status');
  console.log('='.repeat(40));
  
  const config = await getCurrentConfig();
  if (!config) return;
  
  console.log(`📊 Blob Storage: ${config.useBlobStorage ? '✅ ENABLED' : '❌ DISABLED'}`);
  console.log(`🛡️  Fallback: ${config.fallbackEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
  
  if (config.useBlobStorage && config.fallbackEnabled) {
    console.log('\n💡 Mode: SAFE TESTING - Blob storage with file fallbacks');
  } else if (config.useBlobStorage && !config.fallbackEnabled) {
    console.log('\n💡 Mode: PRODUCTION - Blob storage only (risky)');
  } else {
    console.log('\n💡 Mode: TRADITIONAL - File-based storage only');
  }
  
  return config;
}

async function enableBlobStorage(safeMode = true) {
  console.log('🚀 Enabling blob storage...');
  
  const success = await updateConfig('true', safeMode);
  if (success) {
    console.log('✅ Blob storage ENABLED');
    if (safeMode) {
      console.log('🛡️  Fallbacks remain enabled for safety');
    }
    console.log('\n💡 Next steps:');
    console.log('   1. Test locally: npm run dev:netlify');
    console.log('   2. Test with: curl "http://localhost:8888/.netlify/functions/rainfall-data?debug=1"');
    console.log('   3. Deploy when ready: git commit && git push');
  }
}

async function disableBlobStorage() {
  console.log('🔙 Disabling blob storage (reverting to files)...');
  
  const success = await updateConfig('false', 'true');
  if (success) {
    console.log('✅ Blob storage DISABLED - back to file-based storage');
    console.log('🛡️  Your existing JSON files will be used');
  }
}

async function enableProductionMode() {
  console.log('⚠️  WARNING: Enabling production mode (no fallbacks)');
  console.log('📋 This will disable file-based fallbacks');
  
  // Add a safety check
  const config = await getCurrentConfig();
  if (!config || !config.useBlobStorage) {
    console.log('❌ Cannot enable production mode: blob storage is not enabled');
    console.log('💡 Run: node scripts/toggle-blob-storage.js enable');
    return;
  }
  
  const success = await updateConfig('true', 'false');
  if (success) {
    console.log('✅ Production mode ENABLED');
    console.log('⚠️  Only blob storage will be used (no file fallbacks)');
  }
}

// Command line interface
const command = process.argv[2];

async function main() {
  console.log('🔧 Blob Storage Configuration Tool\n');
  
  switch (command) {
    case 'status':
    case undefined:
      await showStatus();
      break;
      
    case 'enable':
      await enableBlobStorage(true);
      break;
      
    case 'disable':
      await disableBlobStorage();
      break;
      
    case 'production':
      await enableProductionMode();
      break;
      
    case 'help':
      console.log('Available commands:');
      console.log('  status      Show current configuration (default)');
      console.log('  enable      Enable blob storage with file fallbacks (SAFE)');
      console.log('  disable     Disable blob storage, use files only');
      console.log('  production  Enable blob storage without fallbacks (RISKY)');
      console.log('  help        Show this help');
      break;
      
    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log('💡 Run with "help" to see available commands');
  }
}

main().catch(console.error);
