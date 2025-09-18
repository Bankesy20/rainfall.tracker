#!/usr/bin/env node

/**
 * Extract proper station names from humanPage URLs for EA stations
 * This script scrapes the title from gov.uk pages to get descriptive names
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Function to extract title from HTML content
function extractTitleFromHtml(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    let title = titleMatch[1].trim();
    
    // Clean up the title
    title = title.replace(/\s+/g, ' '); // Normalize whitespace
    title = title.replace(' - Check for flooding - GOV.UK', ''); // Remove suffix
    title = title.replace(' - GOV.UK', ''); // Remove other suffix
    
    // Extract the gauge name from titles like "Rainfall at Quinton gauge"
    const rainfallMatch = title.match(/^Rainfall at (.+?)(?:\s+gauge)?$/i);
    if (rainfallMatch) {
      return rainfallMatch[1].trim();
    }
    
    return title;
  }
  return null;
}

// Function to fetch page title from URL
async function fetchPageTitle(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    };
    
    const request = https.request(options, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        if (response.statusCode === 200) {
          const title = extractTitleFromHtml(data);
          resolve(title);
        } else {
          reject(new Error(`HTTP ${response.statusCode}`));
        }
      });
    });
    
    request.on('error', (err) => {
      reject(err);
    });
    
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
    
    request.end();
  });
}

// Function to add delay between requests
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🔍 Extracting proper station names from humanPage URLs...');
  
  // Load the England-only stations data
  const englandStationsPath = path.join(__dirname, '..', 'data', 'processed', 'ea-england-stations.json');
  const englandStationsData = JSON.parse(fs.readFileSync(englandStationsPath, 'utf8'));
  
  // Filter stations with humanPage URLs
  const stationsWithPages = englandStationsData.items.filter(station => 
    station.humanPage && station.humanPage.trim() !== ''
  );
  
  console.log(`📊 Found ${stationsWithPages.length} stations with humanPage URLs`);
  
  // Find stations with generic labels that need name extraction
  const stationsNeedingNames = stationsWithPages.filter(station => 
    !station.label || station.label === 'Rainfall station' || station.label.includes('Rainfall station')
  );
  
  console.log(`🏷️  ${stationsNeedingNames.length} stations have generic labels and need name extraction`);
  
  // Sample a subset for testing (you can increase this for full extraction)
  const testLimit = process.argv.includes('--full') ? stationsNeedingNames.length : 20;
  const stationsToTest = stationsNeedingNames.slice(0, testLimit);
  
  console.log(`🧪 Testing ${stationsToTest.length} stations...`);
  
  const results = [];
  const errors = [];
  
  // Process stations with delay to be respectful to the server
  for (let i = 0; i < stationsToTest.length; i++) {
    const station = stationsToTest[i];
    
    console.log(`\n📍 [${i + 1}/${stationsToTest.length}] Processing ${station.stationReference}...`);
    console.log(`  URL: ${station.humanPage}`);
    console.log(`  Current label: "${station.label}"`);
    
    try {
      const extractedName = await fetchPageTitle(station.humanPage);
      
      if (extractedName && extractedName !== station.label) {
        console.log(`  ✅ Extracted: "${extractedName}"`);
        
        results.push({
          stationReference: station.stationReference,
          originalLabel: station.label,
          extractedName: extractedName,
          lat: station.lat,
          long: station.long,
          humanPage: station.humanPage,
          csvUrl: station.readings?.csv,
          gridReference: station.gridReference
        });
      } else {
        console.log(`  ⚠️  No better name found`);
      }
      
      // Add delay between requests (be respectful to gov.uk)
      await delay(2000);
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      errors.push({
        stationReference: station.stationReference,
        error: error.message,
        humanPage: station.humanPage
      });
    }
  }
  
  // Save results
  if (results.length > 0) {
    const outputPath = path.join(__dirname, '..', 'data', 'processed', 'ea-stations-with-extracted-names.json');
    const outputData = {
      extractedAt: new Date().toISOString(),
      totalExtracted: results.length,
      totalErrors: errors.length,
      stations: results
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`\n💾 Saved ${results.length} stations with extracted names to:`);
    console.log(`   ${outputPath}`);
  }
  
  // Summary
  console.log('\n📊 Extraction Summary:');
  console.log(`✅ Successfully extracted: ${results.length} names`);
  console.log(`❌ Errors: ${errors.length}`);
  
  if (results.length > 0) {
    console.log('\n🏷️  Sample of extracted names:');
    results.slice(0, 10).forEach(result => {
      console.log(`  ${result.stationReference}: "${result.originalLabel}" → "${result.extractedName}"`);
    });
  }
  
  if (errors.length > 0) {
    console.log('\n❌ Errors occurred for:');
    errors.slice(0, 5).forEach(error => {
      console.log(`  ${error.stationReference}: ${error.error}`);
    });
  }
  
  console.log('\n🎉 Name extraction completed!');
  
  // Show some well-named stations that don't need extraction
  const wellNamedStations = stationsWithPages.filter(station => 
    station.label && 
    station.label !== 'Rainfall station' && 
    !station.label.includes('Rainfall station') &&
    station.label.length > 3
  );
  
  console.log(`\n🌟 Found ${wellNamedStations.length} stations that already have good names:`);
  wellNamedStations.slice(0, 15).forEach(station => {
    console.log(`  ${station.stationReference}: "${station.label}"`);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Name extraction failed:', error.message);
    process.exit(1);
  });
}

module.exports = { extractTitleFromHtml, fetchPageTitle };
