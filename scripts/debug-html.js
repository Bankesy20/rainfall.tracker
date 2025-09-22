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
        resolve({
          html: data,
          status: res.statusCode,
          contentType: res.headers['content-type']
        });
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
  const patterns = [
    /<h1[^>]*class="[^"]*govuk-heading-xl[^"]*"[^>]*>\s*Rainfall at ([^<]+)\s*<\/h1>/i,
    /<h1[^>]*class="[^"]*govuk-heading-xl[^"]*"[^>]*>\s*Rainfall at ([^<]+)\s*<\/div>/i,
    /<h1[^>]*>\s*Rainfall at ([^<]+)\s*<\/h1>/i,
    /<h1[^>]*>\s*Rainfall at ([^<]+)\s*<\/div>/i,
    /<h1[^>]*>\s*([^<]*gauge[^<]*)\s*<\/h1>/i,
    /<h1[^>]*>\s*([^<]*gauge[^<]*)\s*<\/div>/i,
    /<h1[^>]*>\s*([^<]*station[^<]*)\s*<\/h1>/i,
    /<title[^>]*>\s*([^<]*rainfall[^<]*)\s*<\/title>/i
  ];

  console.log('Testing patterns:');
  patterns.forEach((pattern, index) => {
    const match = html.match(pattern);
    console.log(`Pattern ${index + 1}: ${match ? `✅ "${match[1]}"` : '❌ No match'}`);
  });

  // Also show the raw h1 content
  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
  if (h1Match) {
    console.log(`\nRaw h1 content: "${h1Match[1]}"`);
  }

  // Show h1 with div closing
  const h1DivMatch = html.match(/<h1[^>]*>([^<]*)<\/div>/i);
  if (h1DivMatch) {
    console.log(`\nH1 with div closing: "${h1DivMatch[1]}"`);
  }
}

async function main() {
  const url = 'https://check-for-flooding.service.gov.uk/rainfall-station/E7050';
  
  try {
    console.log(`Fetching: ${url}`);
    const response = await fetchHTML(url);
    
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.contentType}`);
    console.log(`HTML length: ${response.html.length} characters\n`);
    
    // Show the h1 section
    const h1Section = response.html.match(/<h1[^>]*>.*?<\/div>/is);
    if (h1Section) {
      console.log('H1 section:');
      console.log(h1Section[0]);
      console.log('\n');
    } else {
      console.log('No h1 section found. Looking for h1 tags...');
      const h1Matches = response.html.match(/<h1[^>]*>.*?<\/h1>/gi);
      if (h1Matches) {
        h1Matches.forEach((match, index) => {
          console.log(`H1 ${index + 1}: ${match}`);
        });
      } else {
        console.log('No h1 tags found at all');
      }
    }
    
    testPatterns(response.html);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
