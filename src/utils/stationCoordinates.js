// Utility to get coordinates for stations that have actual data files
let stationsMetadataCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fetch stations metadata from GitHub
const fetchStationsMetadata = async () => {
  const now = Date.now();
  
  // Return cached data if still fresh
  if (stationsMetadataCache && (now - lastFetchTime) < CACHE_DURATION) {
    return stationsMetadataCache;
  }

  try {
    // Try GitHub first (production)
    const githubUrl = 'https://raw.githubusercontent.com/Bankesy20/rainfall.tracker/main/data/processed/stations-metadata.json';
    const response = await fetch(githubUrl, {
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (response.ok) {
      const data = await response.json();
      stationsMetadataCache = data;
      lastFetchTime = now;
      return data;
    }
  } catch (error) {
    console.warn('Failed to fetch stations metadata from GitHub:', error);
  }

  // Fallback to local file (development)
  try {
    const localResponse = await fetch('/data/processed/stations-metadata.json');
    if (localResponse.ok) {
      const data = await localResponse.json();
      stationsMetadataCache = data;
      lastFetchTime = now;
      return data;
    }
  } catch (error) {
    console.warn('Failed to fetch local stations metadata:', error);
  }

  // Final fallback to hardcoded coordinates
  console.warn('Using fallback hardcoded coordinates');
  return {
    stations: {
      'miserden1141': {
        key: 'miserden1141',
        stationId: '1141',
        name: 'Miserden',
        label: 'Miserden (1141)',
        provider: 'Environment Agency',
        country: 'England',
        coordinates: { lat: 51.777374, lng: -2.093434 }
      },
      'maenclochog1099': {
        key: 'maenclochog1099',
        stationId: '1099',
        name: 'Maenclochog',
        label: 'Maenclochog (1099)',
        provider: 'Natural Resources Wales',
        country: 'Wales',
        coordinates: { lat: 51.9, lng: -4.8 }
      }
    }
  };
};

export const getStationCoordinates = async () => {
  const metadata = await fetchStationsMetadata();
  const coordinates = {};

  // Convert metadata to coordinates format expected by map
  Object.values(metadata.stations).forEach(station => {
    if (station.coordinates && station.coordinates.lat && station.coordinates.lng) {
      coordinates[station.key] = {
        lat: station.coordinates.lat,
        lng: station.coordinates.lng,
        name: station.label,
        provider: station.provider,
        stationId: station.stationId
      };
    }
  });

  return coordinates;
};

// Get center point for map view
export const getMapCenter = async () => {
  const coords = await getStationCoordinates();
  const coordValues = Object.values(coords);
  
  if (coordValues.length === 0) {
    return { lat: 52.5, lng: -1.5 }; // Default UK center
  }

  const avgLat = coordValues.reduce((sum, coord) => sum + coord.lat, 0) / coordValues.length;
  const avgLng = coordValues.reduce((sum, coord) => sum + coord.lng, 0) / coordValues.length;
  
  return { lat: avgLat, lng: avgLng };
};

// Get bounds for all stations
export const getMapBounds = async () => {
  const coords = await getStationCoordinates();
  const coordValues = Object.values(coords);
  
  if (coordValues.length === 0) {
    return {
      north: 55,
      south: 50,
      east: 2,
      west: -6
    };
  }

  const lats = coordValues.map(coord => coord.lat);
  const lngs = coordValues.map(coord => coord.lng);
  
  return {
    north: Math.max(...lats) + 0.5,
    south: Math.min(...lats) - 0.5,
    east: Math.max(...lngs) + 0.5,
    west: Math.min(...lngs) - 0.5
  };
};
