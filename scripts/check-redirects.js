#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { URL } = require('url');

async function checkRedirect(url, maxRedirects = 5) {
  return new Promise((resolve) => {
    let redirectCount = 0;
    const redirectChain = [];
    
    function makeRequest(currentUrl) {
      const urlObj = new URL(currentUrl);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Redirect-Checker/1.0)'
        }
      };

      const req = client.request(options, (res) => {
        redirectChain.push({
          url: currentUrl,
          status: res.statusCode,
          location: res.headers.location
        });

        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          redirectCount++;
          if (redirectCount <= maxRedirects) {
            const nextUrl = res.headers.location.startsWith('http') 
              ? res.headers.location 
              : new URL(res.headers.location, currentUrl).href;
            makeRequest(nextUrl);
          } else {
            resolve({
              finalUrl: currentUrl,
              redirectChain,
              error: 'Max redirects exceeded'
            });
          }
        } else {
          resolve({
            finalUrl: currentUrl,
            redirectChain,
            status: res.statusCode,
            contentLength: res.headers['content-length'],
            contentType: res.headers['content-type']
          });
        }
      });

      req.on('error', (error) => {
        resolve({
          finalUrl: currentUrl,
          redirectChain,
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          finalUrl: currentUrl,
          redirectChain,
          error: 'Timeout'
        });
      });

      req.setTimeout(10000);
      req.end();
    }

    makeRequest(url);
  });
}

async function main() {
  const testUrls = [
    'https://check-for-flooding.service.gov.uk/station/4163?parameter=rainfall',
    'https://check-for-flooding.service.gov.uk/station/4103?parameter=rainfall',
    'https://check-for-flooding.service.gov.uk/rainfall-station/E7050',
    'https://check-for-flooding.service.gov.uk/rainfall-station/3014'
  ];

  console.log('Checking redirects for sample URLs...\n');

  for (const url of testUrls) {
    console.log(`Testing: ${url}`);
    const result = await checkRedirect(url);
    
    console.log(`Final URL: ${result.finalUrl}`);
    console.log(`Status: ${result.status || 'N/A'}`);
    console.log(`Content Type: ${result.contentType || 'N/A'}`);
    console.log(`Content Length: ${result.contentLength || 'N/A'}`);
    
    if (result.redirectChain.length > 0) {
      console.log('Redirect chain:');
      result.redirectChain.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step.status} -> ${step.location || 'Final destination'}`);
      });
    }
    
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
    
    console.log('---\n');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkRedirect };
