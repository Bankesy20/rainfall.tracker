#!/usr/bin/env node

const fs = require('fs');
const { URL } = require('url');

class DomainAnalyzer {
  constructor() {
    this.domainStats = {};
    this.welshSites = [];
    this.urlPatterns = {};
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return 'invalid-url';
    }
  }

  isWelshSite(station) {
    // Check various indicators that might suggest a Welsh site
    const indicators = [
      // Check if station reference starts with Welsh prefixes
      station.stationReference?.startsWith('W'),
      station.stationReference?.startsWith('N'),
      
      // Check if label contains Welsh place names or indicators
      station.label?.toLowerCase().includes('wales'),
      station.label?.toLowerCase().includes('cymru'),
      station.label?.toLowerCase().includes('welsh'),
      
      // Check if grid reference suggests Wales (roughly SW quadrant)
      this.isWelshGridReference(station.gridReference),
      
      // Check if coordinates are in Wales
      this.isWelshCoordinates(station.lat, station.long)
    ];

    return indicators.some(indicator => indicator === true);
  }

  isWelshGridReference(gridRef) {
    if (!gridRef) return false;
    
    // Welsh grid references typically start with certain letters
    const welshPrefixes = ['SH', 'SJ', 'SN', 'SO', 'SR', 'SS', 'ST', 'SU', 'SV', 'SW', 'SX', 'SY', 'SZ'];
    return welshPrefixes.some(prefix => gridRef.startsWith(prefix));
  }

  isWelshCoordinates(lat, long) {
    if (!lat || !long) return false;
    
    // Rough bounding box for Wales
    // This is approximate - Wales is roughly between:
    // Lat: 51.4 to 53.5
    // Long: -5.7 to -2.6
    return lat >= 51.4 && lat <= 53.5 && long >= -5.7 && long <= -2.6;
  }

  analyzeStations(stations) {
    console.log(`Analyzing ${stations.length} stations...`);

    stations.forEach((station, index) => {
      // Analyze humanPage URL
      if (station.humanPage) {
        const domain = this.extractDomain(station.humanPage);
        this.domainStats[domain] = (this.domainStats[domain] || 0) + 1;
        
        // Track URL patterns
        if (station.humanPage.includes('check-for-flooding.service.gov.uk')) {
          this.urlPatterns['check-for-flooding'] = (this.urlPatterns['check-for-flooding'] || 0) + 1;
        }
        if (station.humanPage.includes('environment.data.gov.uk')) {
          this.urlPatterns['environment-data'] = (this.urlPatterns['environment-data'] || 0) + 1;
        }
      }

      // Check for Welsh sites
      if (this.isWelshSite(station)) {
        this.welshSites.push({
          ...station,
          welshIndicators: {
            stationRef: station.stationReference?.startsWith('W') || station.stationReference?.startsWith('N'),
            label: station.label?.toLowerCase().includes('wales') || 
                   station.label?.toLowerCase().includes('cymru') || 
                   station.label?.toLowerCase().includes('welsh'),
            gridRef: this.isWelshGridReference(station.gridReference),
            coordinates: this.isWelshCoordinates(station.lat, station.long)
          }
        });
      }

      if ((index + 1) % 100 === 0) {
        console.log(`Processed ${index + 1}/${stations.length} stations...`);
      }
    });
  }

  generateReport() {
    console.log('\n=== DOMAIN ANALYSIS ===');
    
    // Sort domains by count
    const sortedDomains = Object.entries(this.domainStats)
      .sort(([,a], [,b]) => b - a);

    console.log('\nTop domains by count:');
    sortedDomains.forEach(([domain, count]) => {
      console.log(`  ${domain}: ${count} URLs`);
    });

    console.log('\nUK.gov domain breakdown:');
    const ukGovDomains = sortedDomains.filter(([domain]) => 
      domain.includes('.gov.uk') || domain.includes('.service.gov.uk')
    );
    
    ukGovDomains.forEach(([domain, count]) => {
      console.log(`  ${domain}: ${count} URLs`);
    });

    console.log('\nURL pattern analysis:');
    Object.entries(this.urlPatterns).forEach(([pattern, count]) => {
      console.log(`  ${pattern}: ${count} URLs`);
    });

    console.log('\n=== WELSH SITES ANALYSIS ===');
    console.log(`Total Welsh sites found: ${this.welshSites.length}`);
    console.log(`Percentage of total: ${(this.welshSites.length / Object.keys(this.domainStats).length * 100).toFixed(1)}%`);

    if (this.welshSites.length > 0) {
      console.log('\nWelsh sites breakdown by indicator:');
      const indicators = {
        stationRef: this.welshSites.filter(s => s.welshIndicators.stationRef).length,
        label: this.welshSites.filter(s => s.welshIndicators.label).length,
        gridRef: this.welshSites.filter(s => s.welshIndicators.gridRef).length,
        coordinates: this.welshSites.filter(s => s.welshIndicators.coordinates).length
      };

      Object.entries(indicators).forEach(([indicator, count]) => {
        console.log(`  ${indicator}: ${count} sites`);
      });

      console.log('\nFirst 10 Welsh sites:');
      this.welshSites.slice(0, 10).forEach(site => {
        console.log(`  ${site.stationReference}: ${site.label}`);
        console.log(`    Grid Ref: ${site.gridReference}`);
        console.log(`    Coordinates: ${site.lat}, ${site.long}`);
        console.log(`    Human Page: ${site.humanPage}`);
        console.log('');
      });
    }

    return {
      domainStats: this.domainStats,
      welshSites: this.welshSites,
      urlPatterns: this.urlPatterns,
      summary: {
        totalStations: Object.keys(this.domainStats).length,
        totalWelshSites: this.welshSites.length,
        ukGovDomains: ukGovDomains.length,
        topDomain: sortedDomains[0]?.[0] || 'none',
        topDomainCount: sortedDomains[0]?.[1] || 0
      }
    };
  }
}

async function main() {
  try {
    const dataPath = process.argv[2] || './data/processed/ea-england-stations.json';
    console.log(`Loading data from: ${dataPath}`);
    
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    if (!data.items || !Array.isArray(data.items)) {
      throw new Error('Invalid data format. Expected items array.');
    }

    console.log(`Found ${data.items.length} stations`);

    const analyzer = new DomainAnalyzer();
    analyzer.analyzeStations(data.items);
    const report = analyzer.generateReport();

    // Save detailed results
    const outputPath = './data/processed/domain-and-welsh-analysis.json';
    fs.writeFileSync(outputPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      report,
      welshSites: analyzer.welshSites,
      domainStats: analyzer.domainStats
    }, null, 2));

    console.log(`\nDetailed analysis saved to: ${outputPath}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { DomainAnalyzer };
