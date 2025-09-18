#!/usr/bin/env node

/**
 * Select 10 high-quality EA stations for the rainfall dashboard
 * Prioritizes: good names, geographic distribution, and data reliability
 */

const fs = require('fs');
const path = require('path');

// Function to calculate distance between two coordinates (rough approximation)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Function to ensure geographic distribution
function selectGeographicallyDistributed(stations, maxStations = 10, minDistance = 50) {
  if (stations.length <= maxStations) {
    return stations;
  }
  
  const selected = [];
  const remaining = [...stations];
  
  // Start with the first station
  selected.push(remaining.shift());
  
  while (selected.length < maxStations && remaining.length > 0) {
    let bestStation = null;
    let maxMinDistance = 0;
    let bestIndex = -1;
    
    // Find the station that is furthest from all selected stations
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      let minDistanceToSelected = Infinity;
      
      for (const selectedStation of selected) {
        const distance = calculateDistance(
          candidate.lat, candidate.long,
          selectedStation.lat, selectedStation.long
        );
        minDistanceToSelected = Math.min(minDistanceToSelected, distance);
      }
      
      if (minDistanceToSelected > maxMinDistance) {
        maxMinDistance = minDistanceToSelected;
        bestStation = candidate;
        bestIndex = i;
      }
    }
    
    if (bestStation) {
      selected.push(bestStation);
      remaining.splice(bestIndex, 1);
    } else {
      // If no station meets minimum distance, just add the next one
      selected.push(remaining.shift());
    }
  }
  
  return selected;
}

// Function to score station quality
function scoreStation(station) {
  let score = 0;
  
  // Good name (not generic)
  if (station.extractedName || (station.label && station.label !== 'Rainfall station')) {
    score += 10;
  }
  
  // Has extracted name (better than original)
  if (station.extractedName && station.extractedName !== station.originalLabel) {
    score += 5;
  }
  
  // Name length and quality
  const name = station.extractedName || station.label || '';
  if (name.length > 3 && name.length < 30) {
    score += 5;
  }
  
  // Not too many special characters or numbers
  if (!/[0-9]{3,}/.test(name) && !/[,]{2,}/.test(name)) {
    score += 3;
  }
  
  // Has grid reference (indicates more established station)
  if (station.gridReference) {
    score += 2;
  }
  
  // Has proper CSV URL
  if (station.csvUrl) {
    score += 3;
  }
  
  return score;
}

async function main() {
  console.log('🎯 Selecting high-quality EA stations for dashboard...');
  
  // Load the original England stations data
  const englandStationsPath = path.join(__dirname, '..', 'data', 'processed', 'ea-england-stations.json');
  const englandStationsData = JSON.parse(fs.readFileSync(englandStationsPath, 'utf8'));
  
  // Load extracted names data
  const extractedNamesPath = path.join(__dirname, '..', 'data', 'processed', 'ea-stations-with-extracted-names.json');
  let extractedNames = {};
  
  try {
    const extractedData = JSON.parse(fs.readFileSync(extractedNamesPath, 'utf8'));
    extractedNames = extractedData.stations.reduce((acc, station) => {
      acc[station.stationReference] = station.extractedName;
      return acc;
    }, {});
    console.log(`📊 Loaded ${Object.keys(extractedNames).length} extracted station names`);
  } catch (error) {
    console.log('⚠️  No extracted names file found, using original labels only');
  }
  
  // Get all stations with humanPage URLs (these are the legitimate ones)
  const stationsWithPages = englandStationsData.items.filter(station => 
    station.humanPage && station.humanPage.trim() !== ''
  );
  
  console.log(`📊 Found ${stationsWithPages.length} stations with humanPage URLs`);
  
  // Enhance stations with extracted names and quality scores
  const enhancedStations = stationsWithPages.map(station => {
    const extractedName = extractedNames[station.stationReference];
    const enhancedStation = {
      ...station,
      extractedName: extractedName,
      finalName: extractedName || station.label || `Station ${station.stationReference}`,
      originalLabel: station.label
    };
    
    enhancedStation.qualityScore = scoreStation(enhancedStation);
    return enhancedStation;
  });
  
  // Sort by quality score (highest first)
  enhancedStations.sort((a, b) => b.qualityScore - a.qualityScore);
  
  console.log('\n🌟 Top quality stations (by score):');
  enhancedStations.slice(0, 20).forEach((station, i) => {
    console.log(`  ${i + 1}. ${station.stationReference} - "${station.finalName}" (score: ${station.qualityScore})`);
  });
  
  // Select high-quality candidates (top 50% or minimum 50 stations)
  const qualityCandidates = enhancedStations.slice(0, Math.max(50, Math.floor(enhancedStations.length * 0.5)));
  console.log(`\n🎯 Selected ${qualityCandidates.length} high-quality candidates`);
  
  // Apply geographic distribution to select final 10
  const selectedStations = selectGeographicallyDistributed(qualityCandidates, 10);
  
  console.log('\n✅ Final selected 10 stations:');
  selectedStations.forEach((station, i) => {
    console.log(`  ${i + 1}. ${station.stationReference} - "${station.finalName}"`);
    console.log(`     Location: ${station.lat.toFixed(3)}°N, ${Math.abs(station.long).toFixed(3)}°${station.long < 0 ? 'W' : 'E'}`);
    console.log(`     Quality Score: ${station.qualityScore}`);
    console.log(`     URL: ${station.humanPage}`);
    console.log('');
  });
  
  // Create the configuration object for use in your scripts
  const stationConfig = {
    selectedAt: new Date().toISOString(),
    selectionCriteria: {
      maxStations: 10,
      minQualityScore: Math.min(...selectedStations.map(s => s.qualityScore)),
      geographicDistribution: true,
      requireHumanPage: true
    },
    totalCandidates: enhancedStations.length,
    highQualityCandidates: qualityCandidates.length,
    stations: selectedStations.map(station => ({
      id: station.stationReference,
      name: station.finalName,
      originalLabel: station.originalLabel,
      extractedName: station.extractedName,
      lat: station.lat,
      long: station.long,
      humanPage: station.humanPage,
      csvUrl: station.readings?.csv || `http://environment.data.gov.uk/flood-monitoring/id/measures/${station.stationReference}-rainfall-tipping_bucket_raingauge-t-15_min-mm/readings.csv`,
      gridReference: station.gridReference,
      qualityScore: station.qualityScore,
      mapUrl: station.mapUrl
    }))
  };
  
  // Save the configuration
  const outputPath = path.join(__dirname, '..', 'data', 'processed', 'selected-ea-stations.json');
  fs.writeFileSync(outputPath, JSON.stringify(stationConfig, null, 2));
  
  console.log(`💾 Saved station configuration to:`);
  console.log(`   ${outputPath}`);
  
  // Also create a simple array format for the download script
  const simpleStations = stationConfig.stations.map(station => ({
    id: station.id,
    name: station.name,
    lat: station.lat,
    long: station.long,
    humanPage: station.humanPage,
    csvUrl: station.csvUrl
  }));
  
  const simpleOutputPath = path.join(__dirname, '..', 'data', 'processed', 'selected-ea-stations-simple.json');
  fs.writeFileSync(simpleOutputPath, JSON.stringify(simpleStations, null, 2));
  
  console.log(`📋 Saved simple station list to:`);
  console.log(`   ${simpleOutputPath}`);
  
  // Geographic distribution analysis
  console.log('\n🗺️  Geographic Distribution:');
  const latitudes = selectedStations.map(s => s.lat);
  const longitudes = selectedStations.map(s => s.long);
  
  console.log(`   Latitude range: ${Math.min(...latitudes).toFixed(2)}° to ${Math.max(...latitudes).toFixed(2)}°`);
  console.log(`   Longitude range: ${Math.min(...longitudes).toFixed(2)}° to ${Math.max(...longitudes).toFixed(2)}°`);
  
  // Calculate average distances between stations
  let totalDistance = 0;
  let pairCount = 0;
  
  for (let i = 0; i < selectedStations.length; i++) {
    for (let j = i + 1; j < selectedStations.length; j++) {
      const distance = calculateDistance(
        selectedStations[i].lat, selectedStations[i].long,
        selectedStations[j].lat, selectedStations[j].long
      );
      totalDistance += distance;
      pairCount++;
    }
  }
  
  const avgDistance = totalDistance / pairCount;
  console.log(`   Average distance between stations: ${avgDistance.toFixed(1)} km`);
  
  console.log('\n🎉 Station selection completed!');
  console.log('\n📋 Next steps:');
  console.log('   1. Test these stations with: node scripts/test-selected-stations.js');
  console.log('   2. Update download-ea-batch.js to use these stations');
  console.log('   3. Test with GitHub Actions workflow');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Station selection failed:', error.message);
    process.exit(1);
  });
}

module.exports = { scoreStation, selectGeographicallyDistributed, calculateDistance };
