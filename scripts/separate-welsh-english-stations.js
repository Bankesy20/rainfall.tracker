#!/usr/bin/env node

const fs = require('fs');
const { URL } = require('url');

class StationSeparator {
  constructor() {
    this.welshStations = [];
    this.englishStations = [];
    this.unknownStations = [];
  }

  isWelshStation(station) {
    // Check if the humanPage URL follows the Welsh pattern
    if (!station.humanPage) return false;
    
    try {
      const url = new URL(station.humanPage);
      
      // Welsh pattern: /station/{id}?parameter=rainfall
      if (url.pathname.startsWith('/station/') && url.search.includes('parameter=rainfall')) {
        return true;
      }
      
      // Also check if it redirects to Natural Resources Wales (we know some do)
      // This is a backup check for stations that might have different patterns
      return false;
    } catch (error) {
      return false;
    }
  }

  separateStations(stations) {
    console.log(`Separating ${stations.length} stations...`);

    stations.forEach((station, index) => {
      if (this.isWelshStation(station)) {
        this.welshStations.push(station);
      } else if (station.humanPage) {
        // Has a humanPage but not Welsh pattern = English
        this.englishStations.push(station);
      } else {
        // No humanPage = unknown/other
        this.unknownStations.push(station);
      }

      if ((index + 1) % 100 === 0) {
        console.log(`Processed ${index + 1}/${stations.length} stations...`);
      }
    });
  }

  generateReport() {
    const total = this.welshStations.length + this.englishStations.length + this.unknownStations.length;
    
    console.log('\n=== STATION SEPARATION REPORT ===');
    console.log(`Total stations: ${total}`);
    console.log(`Welsh stations: ${this.welshStations.length} (${(this.welshStations.length/total*100).toFixed(1)}%)`);
    console.log(`English stations: ${this.englishStations.length} (${(this.englishStations.length/total*100).toFixed(1)}%)`);
    console.log(`Unknown/Other stations: ${this.unknownStations.length} (${(this.unknownStations.length/total*100).toFixed(1)}%)`);

    // Show some examples
    if (this.welshStations.length > 0) {
      console.log('\nSample Welsh stations:');
      this.welshStations.slice(0, 5).forEach(station => {
        console.log(`  ${station.stationReference}: ${station.humanPage}`);
      });
    }

    if (this.englishStations.length > 0) {
      console.log('\nSample English stations:');
      this.englishStations.slice(0, 5).forEach(station => {
        console.log(`  ${station.stationReference}: ${station.humanPage}`);
      });
    }

    return {
      total,
      welsh: this.welshStations.length,
      english: this.englishStations.length,
      unknown: this.unknownStations.length
    };
  }

  saveSeparatedData() {
    const timestamp = new Date().toISOString();
    
    // Welsh stations
    const welshData = {
      lastVerified: timestamp,
      count: this.welshStations.length,
      region: "Wales",
      description: "Welsh rainfall stations that redirect to Natural Resources Wales",
      items: this.welshStations
    };

    // English stations  
    const englishData = {
      lastVerified: timestamp,
      count: this.englishStations.length,
      region: "England",
      description: "English rainfall stations served by Environment Agency",
      items: this.englishStations
    };

    // Unknown/Other stations
    const unknownData = {
      lastVerified: timestamp,
      count: this.unknownStations.length,
      region: "Unknown",
      description: "Stations without humanPage URLs or with unknown patterns",
      items: this.unknownStations
    };

    // Save files
    const welshPath = './data/processed/ea-wales-stations.json';
    const englishPath = './data/processed/ea-england-stations-only.json';
    const unknownPath = './data/processed/ea-unknown-stations.json';

    fs.writeFileSync(welshPath, JSON.stringify(welshData, null, 2));
    fs.writeFileSync(englishPath, JSON.stringify(englishData, null, 2));
    fs.writeFileSync(unknownPath, JSON.stringify(unknownData, null, 2));

    console.log(`\nFiles saved:`);
    console.log(`  Welsh stations: ${welshPath}`);
    console.log(`  English stations: ${englishPath}`);
    console.log(`  Unknown stations: ${unknownPath}`);

    return {
      welshPath,
      englishPath,
      unknownPath
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

    const separator = new StationSeparator();
    separator.separateStations(data.items);
    const report = separator.generateReport();
    const filePaths = separator.saveSeparatedData();

    // Save summary report
    const summaryPath = './data/processed/separation-summary.json';
    fs.writeFileSync(summaryPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      originalFile: dataPath,
      report,
      filePaths
    }, null, 2));

    console.log(`\nSeparation summary saved to: ${summaryPath}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { StationSeparator };
