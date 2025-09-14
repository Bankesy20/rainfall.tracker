const fs = require('fs').promises;
const path = require('path');

async function selectTrialStations() {
  const stationsPath = path.join(__dirname, '..', 'data', 'processed', 'ea-rainfall-stations.checked.json');
  const raw = await fs.readFile(stationsPath, 'utf8');
  const data = JSON.parse(raw);
  const stations = data.items || [];
  
  // Select 10 random stations with different characteristics
  const selected = [];
  
  // Mix of station types and regions
  const patterns = [
    { prefix: 'E', count: 4 },      // E-prefixed stations
    { prefix: '', count: 3 },       // Numeric-only stations  
    { prefix: 'random', count: 3 }  // Random selection
  ];
  
  for (const pattern of patterns) {
    let candidates = stations;
    
    if (pattern.prefix === 'E') {
      candidates = stations.filter(s => s.stationReference.startsWith('E'));
    } else if (pattern.prefix === '') {
      candidates = stations.filter(s => /^\d+$/.test(s.stationReference));
    }
    
    // Shuffle and take random samples
    const shuffled = candidates.sort(() => Math.random() - 0.5);
    selected.push(...shuffled.slice(0, pattern.count));
  }
  
  // Remove duplicates and limit to 10
  const unique = selected.filter((s, i, arr) => 
    arr.findIndex(other => other.stationReference === s.stationReference) === i
  ).slice(0, 10);
  
  console.log('Selected trial stations:');
  unique.forEach((s, i) => {
    console.log(`${i + 1}. ${s.stationReference} - ${s.label} (${s.gridReference})`);
  });
  
  return unique.map(s => s.stationReference);
}

if (require.main === module) {
  selectTrialStations().catch(console.error);
}

module.exports = selectTrialStations;
