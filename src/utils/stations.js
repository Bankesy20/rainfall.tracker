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
  },
  E7050: {
    key: 'E7050',
    stationId: 'E7050',
    label: 'Preston Capes (E7050)',
    provider: 'Environment Agency',
    country: 'England',
    staticPath: '/data/processed/ea-E7050.json',
    apiPath: '/.netlify/functions/rainfall-data?station=E7050'
  },
  E13600: {
    key: 'E13600',
    stationId: 'E13600',
    label: 'Lyndhurst (E13600)',
    provider: 'Environment Agency',
    country: 'England',
    staticPath: '/data/processed/ea-E13600.json',
    apiPath: '/.netlify/functions/rainfall-data?station=E13600'
  },
  E19017: {
    key: 'E19017',
    stationId: 'E19017',
    label: 'Ashdon (E19017)',
    provider: 'Environment Agency',
    country: 'England',
    staticPath: '/data/processed/ea-E19017.json',
    apiPath: '/.netlify/functions/rainfall-data?station=E19017'
  },
  E23518: {
    key: 'E23518',
    stationId: 'E23518',
    label: 'Hethersett (E23518)',
    provider: 'Environment Agency',
    country: 'England',
    staticPath: '/data/processed/ea-E23518.json',
    apiPath: '/.netlify/functions/rainfall-data?station=E23518'
  },
  E24879: {
    key: 'E24879',
    stationId: 'E24879',
    label: 'Hullbridge Raine (E24879)',
    provider: 'Environment Agency',
    country: 'England',
    staticPath: '/data/processed/ea-E24879.json',
    apiPath: '/.netlify/functions/rainfall-data?station=E24879'
  },
  E24913: {
    key: 'E24913',
    stationId: 'E24913',
    label: 'Tiptree (E24913)',
    provider: 'Environment Agency',
    country: 'England',
    staticPath: '/data/processed/ea-E24913.json',
    apiPath: '/.netlify/functions/rainfall-data?station=E24913'
  },
  E5170: {
    key: 'E5170',
    stationId: 'E5170',
    label: 'Lower Standen (E5170)',
    provider: 'Environment Agency',
    country: 'England',
    staticPath: '/data/processed/ea-E5170.json',
    apiPath: '/.netlify/functions/rainfall-data?station=E5170'
  },
  E8290: {
    key: 'E8290',
    stationId: 'E8290',
    label: 'Isfield Weir (E8290)',
    provider: 'Environment Agency',
    country: 'England',
    staticPath: '/data/processed/ea-E8290.json',
    apiPath: '/.netlify/functions/rainfall-data?station=E8290'
  },
  '031555': {
    key: '031555',
    stationId: '031555',
    label: 'Easby (031555)',
    provider: 'Environment Agency',
    country: 'England',
    staticPath: '/data/processed/ea-031555.json',
    apiPath: '/.netlify/functions/rainfall-data?station=031555'
  },
  '577271': {
    key: '577271',
    stationId: '577271',
    label: 'Red Br (577271)',
    provider: 'Environment Agency',
    country: 'England',
    staticPath: '/data/processed/ea-577271.json',
    apiPath: '/.netlify/functions/rainfall-data?station=577271'
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


