#!/usr/bin/env node

const https = require('https');

async function test() {
  const url = 'https://check-for-flooding.service.gov.uk/rainfall-station/E7050';
  
  const req = https.request(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('HTML length:', data.length);
      console.log('Contains "Rainfall at":', data.includes('Rainfall at'));
      console.log('Contains "Preston Capes":', data.includes('Preston Capes'));
      
      // Test simple pattern
      const match = data.match(/Rainfall at ([^-]+?)\s*(?:gauge|station|-\s*GOV\.UK)/i);
      console.log('Simple pattern match:', match ? `"${match[1]}"` : 'No match');
      
      // Show first 500 chars
      console.log('\nFirst 500 chars:');
      console.log(data.substring(0, 500));
    });
  });
  
  req.on('error', console.error);
  req.end();
}

test();
