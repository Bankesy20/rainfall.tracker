#!/usr/bin/env node

const https = require('https');
const { URL } = require('url');

async function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : require('http');
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.setTimeout(15000);
    req.end();
  });
}

function testPatterns(html) {
  console.log('Testing patterns on actual HTML...\n');
  
  const patterns = [
    // Pattern 1: Title tag with multiline support - "Rainfall at Preston Capes gauge - GOV.UK"
    /<title[^>]*>\s*Rainfall at ([^-]+)\s*gauge[^<]*<\/title>/is,
    // Pattern 2: Title tag with multiline support - "Rainfall at Preston Capes - GOV.UK"
    /<title[^>]*>\s*Rainfall at ([^-]+)\s*-\s*GOV\.UK[^<]*<\/title>/is,
    // Pattern 3: Meta description
    /<meta[^>]*name="description"[^>]*content="[^"]*rainfall at ([^"]+)"[^>]*>/i,
    // Pattern 4: Meta og:title
    /<meta[^>]*property="og:title"[^>]*content="[^"]*rainfall at ([^"]+)"[^>]*>/i,
    // Pattern 5: H1 tag (if it exists)
    /<h1[^>]*>\s*Rainfall at ([^<]+)\s*<\/h1>/is,
    // Pattern 6: H1 tag with gauge
    /<h1[^>]*>\s*Rainfall at ([^<]+)\s*gauge\s*<\/h1>/is,
    // Pattern 7: Any h1 with rainfall
    /<h1[^>]*>\s*([^<]*rainfall[^<]*)\s*<\/h1>/is,
    // Pattern 8: Simple title pattern - just look for "Rainfall at" followed by text
    /Rainfall at ([^-]+?)\s*(?:gauge|station|-\s*GOV\.UK)/i
  ];

  patterns.forEach((pattern, index) => {
    const match = html.match(pattern);
    console.log(`Pattern ${index + 1}: ${match ? `✅ "${match[1]}"` : '❌ No match'}`);
    if (match) {
      console.log(`  Full match: "${match[0]}"`);
    }
  });

  // Show the actual title and meta sections
  console.log('\nActual HTML sections:');
  
  const titleMatch = html.match(/<title[^>]*>.*?<\/title>/is);
  if (titleMatch) {
    console.log('Title:', titleMatch[0]);
  }
  
  const metaDescMatch = html.match(/<meta[^>]*name="description"[^>]*>/i);
  if (metaDescMatch) {
    console.log('Meta description:', metaDescMatch[0]);
  }
  
  const metaOgMatch = html.match(/<meta[^>]*property="og:title"[^>]*>/i);
  if (metaOgMatch) {
    console.log('Meta og:title:', metaOgMatch[0]);
  }
}

async function main() {
  const url = 'https://check-for-flooding.service.gov.uk/rainfall-station/E7050';
  
  try {
    console.log(`Fetching: ${url}\n`);
    const html = await fetchHTML(url);
    
    testPatterns(html);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
