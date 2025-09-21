#!/usr/bin/env node

/**
 * Extract actual station names from EA England stations by scraping their human pages
 * This script will get the real station names from the <h1> tags on each station's page
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Function to extract station name from HTML content
function extractStationNameFromHtml(html) {
  // Look for the specific pattern - FIXED to handle the actual HTML structure
  // The HTML shows: <h1 class="govuk-heading-xl govuk-!-margin-bottom-0">\n      Rainfall at Preston Capes gauge\n  </div>
  const h1Match = html.match(/<h1[^>]*class="[^"]*govuk-heading-xl[^"]*"[^>]*>\s*Rainfall at (.+?)\s*gauge\s*<\/div>/i);
  if (h1Match) {
    return h1Match[1].trim();
  }
  
  // Alternative pattern for cases where it's just "Name gauge" without "Rainfall at"
  const h1Match2 = html.match(/<h1[^>]*class="[^"]*govuk-heading-xl[^"]*"[^>]*>\s*(.+?)\s*gauge\s*<\/div>/i);
  if (h1Match2) {
    return h1Match2[1].trim();
  }
  
  // More flexible pattern that looks for the content between h1 and the next closing tag
  const h1Match3 = html.match(/<h1[^>]*class="[^"]*govuk-heading-xl[^"]*"[^>]*>\s*(?:Rainfall at\s+)?(.+?)\s*gauge\s*<\/div>/i);
  if (h1Match3) {
    return h1Match3[1].trim();
  }
  
  return null;
}

// Function to fetch page content from URL
async function fetchPageContent(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      }
    }, (response) => {
      let data = '';
      
      // Handle gzipped content
      if (response.headers['content-encoding'] === 'gzip') {
        const zlib = require('zlib');
        const gunzip = zlib.createGunzip();
        response.pipe(gunzip);
        gunzip.on('data', chunk => data += chunk.toString());
        gunzip.on('end', () => resolve(data));
        gunzip.on('error', reject);
      } else {
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      }
    });
    
    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Function to add delay between requests
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🔍 Extracting actual station names from EA England stations...');
  
  // Load the England stations data
  const englandStationsPath = path.join(__dirname, '..', 'data', 'processed', 'ea-england-stations.json');
  const englandStationsData = JSON.parse(fs.readFileSync(englandStationsPath, 'utf8'));
  
  console.log(`📊 Found ${englandStationsData.items.length} EA England stations`);
  
  // Filter stations with humanPage URLs
  const stationsWithPages = englandStationsData.items.filter(station => 
    station.humanPage && station.humanPage.trim() !== ''
  );
  
  console.log(`🌐 ${stationsWithPages.length} stations have humanPage URLs`);
  
  // For testing, let's start with a smaller subset
  const testLimit = process.argv.includes('--full') ? stationsWithPages.length : 50;
  const stationsToProcess = stationsWithPages.slice(0, testLimit);
  
  console.log(`🚀 Processing ${stationsToProcess.length} stations (use --full for all stations)`);
  
  const results = [];
  const errors = [];
  
  // Process stations with delay to be respectful to the server
  for (let i = 0; i < stationsToProcess.length; i++) {
    const station = stationsToProcess[i];
    
    console.log(`\n📍 [${i + 1}/${stationsToProcess.length}] Processing ${station.stationReference}...`);
    console.log(`  URL: ${station.humanPage}`);
    console.log(`  Current label: "${station.label}"`);
    
    try {
      const html = await fetchPageContent(station.humanPage);
      const extractedName = extractStationNameFromHtml(html);
      
      if (extractedName) {
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
        console.log(`  ⚠️  No station name found in HTML`);
        errors.push({
          stationReference: station.stationReference,
          error: 'No station name found in HTML',
          humanPage: station.humanPage
        });
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
    const outputPath = path.join(__dirname, '..', 'data', 'processed', 'ea-stations-with-actual-names.json');
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
  
  if (errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    errors.slice(0, 10).forEach(error => {
      console.log(`  ${error.stationReference}: ${error.error}`);
    });
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more errors`);
    }
  }
  
  // Show some examples of extracted names
  if (results.length > 0) {
    console.log('\n🌟 Examples of extracted names:');
    results.slice(0, 10).forEach(result => {
      console.log(`  ${result.stationReference}: "${result.extractedName}"`);
    });
  }
  
  console.log('\n🎯 Next steps:');
  console.log('1. Review the extracted names in the output file');
  console.log('2. Update your station configuration with the actual names');
  console.log('3. Run with --full to extract all station names');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { extractStationNameFromHtml, fetchPageContent };
