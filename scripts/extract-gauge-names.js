#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { URL } = require('url');

class GaugeNameExtractor {
  constructor() {
    this.results = [];
    this.concurrency = 5; // Limit concurrent requests
    this.active = 0;
    this.queue = [];
  }

  async fetchHTML(url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
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
        let stream = res;
        
        // Handle gzip/deflate compression
        if (res.headers['content-encoding'] === 'gzip') {
          stream = res.pipe(zlib.createGunzip());
        } else if (res.headers['content-encoding'] === 'deflate') {
          stream = res.pipe(zlib.createInflate());
        } else if (res.headers['content-encoding'] === 'br') {
          stream = res.pipe(zlib.createBrotliDecompress());
        }
        
        stream.on('data', (chunk) => {
          data += chunk;
        });
        
        stream.on('end', () => {
          resolve({
            html: data,
            status: res.statusCode,
            contentType: res.headers['content-type']
          });
        });
        
        stream.on('error', (error) => {
          reject(error);
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

  extractGaugeName(html) {
    try {
      // Look for the gauge name in various places - handle multiline HTML
      const patterns = [
        // Pattern 1: Simple and reliable - just look for "Rainfall at" followed by text
        /Rainfall at ([^-]+?)\s*(?:gauge|station|-\s*GOV\.UK)/i,
        // Pattern 2: Title tag with multiline support - "Rainfall at Preston Capes gauge - GOV.UK"
        /<title[^>]*>\s*Rainfall at ([^-]+)\s*gauge[^<]*<\/title>/is,
        // Pattern 3: Title tag with multiline support - "Rainfall at Preston Capes - GOV.UK"
        /<title[^>]*>\s*Rainfall at ([^-]+)\s*-\s*GOV\.UK[^<]*<\/title>/is,
        // Pattern 4: Meta description
        /<meta[^>]*name="description"[^>]*content="[^"]*rainfall at ([^"]+)"[^>]*>/i,
        // Pattern 5: Meta og:title
        /<meta[^>]*property="og:title"[^>]*content="[^"]*rainfall at ([^"]+)"[^>]*>/i,
        // Pattern 6: H1 tag (if it exists)
        /<h1[^>]*>\s*Rainfall at ([^<]+)\s*<\/h1>/is,
        // Pattern 7: H1 tag with gauge
        /<h1[^>]*>\s*Rainfall at ([^<]+)\s*gauge\s*<\/h1>/is,
        // Pattern 8: Any h1 with rainfall
        /<h1[^>]*>\s*([^<]*rainfall[^<]*)\s*<\/h1>/is
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          let name = match[1].trim();
          // Clean up the name - remove extra whitespace and common suffixes
          name = name.replace(/\s+/g, ' ').replace(/\s+(gauge|station)$/i, '').trim();
          // Remove any remaining "at" prefix
          name = name.replace(/^at\s+/i, '').trim();
          return name;
        }
      }

      return null;
    } catch (error) {
      console.error('Error extracting gauge name:', error.message);
      return null;
    }
  }

  async processStation(station) {
    try {
      console.log(`Processing ${station.stationReference}...`);
      
      const response = await this.fetchHTML(station.humanPage);
      
      if (response.status !== 200) {
        console.log(`  ❌ HTTP ${response.status} for ${station.stationReference}`);
        return {
          ...station,
          gaugeName: null,
          error: `HTTP ${response.status}`
        };
      }

      // Debug: Check if HTML contains the expected text
      const containsRainfall = response.html.includes('Rainfall at');
      console.log(`  HTML length: ${response.html.length}, contains "Rainfall at": ${containsRainfall}`);

      const gaugeName = this.extractGaugeName(response.html);
      
      if (gaugeName) {
        console.log(`  ✅ Found: "${gaugeName}"`);
        return {
          ...station,
          gaugeName: gaugeName,
          label: gaugeName, // Update the label field
          error: null
        };
      } else {
        console.log(`  ⚠️  No gauge name found for ${station.stationReference}`);
        // Debug: Show a snippet of the HTML
        const snippet = response.html.substring(0, 500).replace(/\n/g, ' ');
        console.log(`  HTML snippet: ${snippet}...`);
        return {
          ...station,
          gaugeName: null,
          error: 'No gauge name found in HTML'
        };
      }

    } catch (error) {
      console.log(`  ❌ Error processing ${station.stationReference}: ${error.message}`);
      return {
        ...station,
        gaugeName: null,
        error: error.message
      };
    }
  }

  async processQueue() {
    while (this.queue.length > 0 && this.active < this.concurrency) {
      this.active++;
      const station = this.queue.shift();
      
      try {
        const result = await this.processStation(station);
        this.results.push(result);
      } catch (error) {
        this.results.push({
          ...station,
          gaugeName: null,
          error: error.message
        });
      } finally {
        this.active--;
        // Process next item
        setImmediate(() => this.processQueue());
      }
    }
  }

  async extractNames(stations) {
    console.log(`Starting name extraction for ${stations.length} stations...`);
    console.log(`Using ${this.concurrency} concurrent requests\n`);

    // Add all stations to queue
    this.queue = [...stations];

    // Start processing
    await this.processQueue();
    
    // Wait for all to complete
    while (this.active > 0 || this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.results;
  }

  generateReport(results) {
    const successful = results.filter(r => r.gaugeName && !r.error);
    const failed = results.filter(r => !r.gaugeName || r.error);

    console.log('\n=== GAUGE NAME EXTRACTION REPORT ===');
    console.log(`Total stations processed: ${results.length}`);
    console.log(`Successful extractions: ${successful.length} (${(successful.length/results.length*100).toFixed(1)}%)`);
    console.log(`Failed extractions: ${failed.length} (${(failed.length/results.length*100).toFixed(1)}%)`);

    if (successful.length > 0) {
      console.log('\nSample successful extractions:');
      successful.slice(0, 10).forEach(result => {
        console.log(`  ${result.stationReference}: "${result.gaugeName}"`);
      });
    }

    if (failed.length > 0) {
      console.log('\nFailed extractions:');
      failed.slice(0, 10).forEach(result => {
        console.log(`  ${result.stationReference}: ${result.error || 'Unknown error'}`);
      });
    }

    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      results
    };
  }
}

async function main() {
  try {
    const dataPath = process.argv[2] || './data/processed/ea-england-stations-only.json';
    const outputPath = process.argv[3] || './data/processed/ea-england-stations-with-names.json';
    
    console.log(`Loading data from: ${dataPath}`);
    
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    if (!data.items || !Array.isArray(data.items)) {
      throw new Error('Invalid data format. Expected items array.');
    }

    console.log(`Found ${data.items.length} stations`);

    // Test with first 10 stations if no limit specified
    const testMode = process.argv.includes('--test');
    const stationsToProcess = testMode ? data.items.slice(0, 10) : data.items;

    if (testMode) {
      console.log(`🧪 TEST MODE: Processing only first 10 stations`);
    }

    const extractor = new GaugeNameExtractor();
    const results = await extractor.extractNames(stationsToProcess);
    const report = extractor.generateReport(results);

    // Create updated data structure
    const updatedData = {
      ...data,
      lastUpdated: new Date().toISOString(),
      nameExtraction: {
        totalProcessed: report.total,
        successful: report.successful,
        failed: report.failed,
        successRate: `${(report.successful/report.total*100).toFixed(1)}%`
      },
      items: results
    };

    // Save results
    fs.writeFileSync(outputPath, JSON.stringify(updatedData, null, 2));
    console.log(`\nUpdated data saved to: ${outputPath}`);

    // Save summary report
    const summaryPath = './data/processed/gauge-name-extraction-summary.json';
    fs.writeFileSync(summaryPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      inputFile: dataPath,
      outputFile: outputPath,
      report
    }, null, 2));

    console.log(`Summary report saved to: ${summaryPath}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { GaugeNameExtractor };
