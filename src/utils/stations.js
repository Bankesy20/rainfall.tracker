// Dynamic station loading from API

// Static fallback stations for offline/development
const fallbackStations = {
  miserden1141: {
    key: 'miserden1141',
    stationId: '1141',
    label: 'Miserden (1141)',
    provider: 'Environment Agency',
    country: 'England',
    staticPath: '/data/processed/rainfall-history.json',
    apiPath: '/.netlify/functions/rainfall-data'
  },
  maenclochog1099: {
    key: 'maenclochog1099',
    stationId: '1099',
    label: 'Maenclochog (1099)',
    provider: 'Natural Resources Wales',
    country: 'Wales',
    staticPath: '/data/processed/wales-1099.json',
    apiPath: '/.netlify/functions/rainfall-data?station=maenclochog1099'
  }
};

// Fetch available stations from API
export const fetchAvailableStations = async () => {
  try {
    const response = await fetch('/.netlify/functions/list-stations');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Convert to our expected format
    const stations = {};
    for (const station of data.stations) {
      stations[station.key] = {
        key: station.key,
        stationId: station.id,
        label: station.label,
        name: station.name,
        provider: station.provider,
        country: station.country,
        location: station.location,
        recordCount: station.recordCount,
        lastUpdated: station.lastUpdated,
        apiPath: `/.netlify/functions/rainfall-data?station=${station.key}`
      };
    }
    
    return stations;
  } catch (error) {
    console.warn('Failed to fetch stations from API, using fallback:', error);
    return fallbackStations;
  }
};

// For backward compatibility - export fallback as default
export default fallbackStations;


