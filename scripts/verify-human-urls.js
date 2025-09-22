#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration
const CONCURRENT_LIMIT = 10; // Number of concurrent requests
const TIMEOUT_MS = 10000; // 10 second timeout per request
const MIN_CONTENT_LENGTH = 100; // Minimum content length to consider valid

class URLVerifier {
  constructor() {
    this.results = [];
    this.queue = [];
    this.active = 0;
    this.processed = 0;
    this.total = 0;
  }

  async verifyURL(url) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'HEAD', // Use HEAD to check if page exists without downloading content
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; URL-Verifier/1.0)'
        }
      };

      const req = client.request(options, (res) => {
        const responseTime = Date.now() - startTime;
        const contentLength = parseInt(res.headers['content-length']) || 0;
        const statusCode = res.statusCode;
        
        // Check if it's a valid response
        const isValid = statusCode >= 200 && statusCode < 400;
        const hasContent = contentLength > MIN_CONTENT_LENGTH;
        
        resolve({
          url,
          status: statusCode,
          valid: isValid,
          hasContent: hasContent,
          contentLength,
          responseTime,
          error: null
        });
      });

      req.on('error', (error) => {
        const responseTime = Date.now() - startTime;
        resolve({
          url,
          status: null,
          valid: false,
          hasContent: false,
          contentLength: 0,
          responseTime,
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const responseTime = Date.now() - startTime;
        resolve({
          url,
          status: null,
          valid: false,
          hasContent: false,
          contentLength: 0,
          responseTime,
          error: 'Timeout'
        });
      });

      req.setTimeout(TIMEOUT_MS);
      req.end();
    });
  }

  async processQueue() {
    while (this.queue.length > 0 && this.active < CONCURRENT_LIMIT) {
      this.active++;
      const { station, url } = this.queue.shift();
      
      try {
        const result = await this.verifyURL(url);
        this.results.push({
          ...station,
          verification: result
        });
        
        this.processed++;
        if (this.processed % 10 === 0) {
          console.log(`Processed ${this.processed}/${this.total} URLs...`);
        }
      } catch (error) {
        this.results.push({
          ...station,
          verification: {
            url,
            status: null,
            valid: false,
            hasContent: false,
            contentLength: 0,
            responseTime: 0,
            error: error.message
          }
        });
        this.processed++;
      } finally {
        this.active--;
        // Process next item in queue
        setImmediate(() => this.processQueue());
      }
    }
  }

  async verifyStations(stations) {
    console.log(`Starting verification of ${stations.length} URLs...`);
    this.total = stations.length;
    
    // Add all stations to queue
    this.queue = stations.map(station => ({
      station,
      url: station.humanPage
    }));

    // Start processing
    await this.processQueue();
    
    // Wait for all to complete
    while (this.active > 0 || this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.results;
  }

  generateReport(results) {
    const valid = results.filter(r => r.verification.valid && r.verification.hasContent);
    const invalid = results.filter(r => !r.verification.valid || !r.verification.hasContent);
    const errors = results.filter(r => r.verification.error);
    const timeouts = results.filter(r => r.verification.error === 'Timeout');

    console.log('\n=== VERIFICATION REPORT ===');
    console.log(`Total URLs checked: ${results.length}`);
    console.log(`Valid URLs: ${valid.length} (${(valid.length/results.length*100).toFixed(1)}%)`);
    console.log(`Invalid URLs: ${invalid.length} (${(invalid.length/results.length*100).toFixed(1)}%)`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Timeouts: ${timeouts.length}`);

    if (invalid.length > 0) {
      console.log('\n=== INVALID URLs ===');
      invalid.forEach(result => {
        const v = result.verification;
        console.log(`${result.stationReference}: ${result.humanPage}`);
        console.log(`  Status: ${v.status || 'N/A'}`);
        console.log(`  Content Length: ${v.contentLength}`);
        console.log(`  Error: ${v.error || 'None'}`);
        console.log(`  Response Time: ${v.responseTime}ms`);
        console.log('');
      });
    }

    return {
      total: results.length,
      valid: valid.length,
      invalid: invalid.length,
      errors: errors.length,
      timeouts: timeouts.length,
      results
    };
  }
}

async function main() {
  try {
    // Load the stations data
    const dataPath = process.argv[2] || './data/processed/ea-england-stations.json';
    console.log(`Loading data from: ${dataPath}`);
    
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    if (!data.items || !Array.isArray(data.items)) {
      throw new Error('Invalid data format. Expected items array.');
    }

    console.log(`Found ${data.items.length} stations`);

    // Filter stations that have humanPage URLs
    const stationsWithUrls = data.items.filter(station => 
      station.humanPage && 
      typeof station.humanPage === 'string' && 
      station.humanPage.startsWith('http')
    );

    console.log(`${stationsWithUrls.length} stations have humanPage URLs`);

    if (stationsWithUrls.length === 0) {
      console.log('No stations with humanPage URLs found.');
      return;
    }

    // Verify URLs
    const verifier = new URLVerifier();
    const results = await verifier.verifyStations(stationsWithUrls);

    // Generate report
    const report = verifier.generateReport(results);

    // Save detailed results
    const outputPath = './data/processed/url-verification-results.json';
    fs.writeFileSync(outputPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: report.total,
        valid: report.valid,
        invalid: report.invalid,
        errors: report.errors,
        timeouts: report.timeouts
      },
      results: report.results
    }, null, 2));

    console.log(`\nDetailed results saved to: ${outputPath}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { URLVerifier };
