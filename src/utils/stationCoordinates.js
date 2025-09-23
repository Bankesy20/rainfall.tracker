// Utility to get coordinates for stations that have actual data files
let stationsMetadataCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for mapping stationId -> stationKey used by API/dropdown
let idToKeyCache = null;
let idToKeyLastFetchTime = 0;

// Fetch and cache station key map (id -> key) for CACHE_DURATION
const fetchStationKeyMap = async () => {
  const now = Date.now();
  if (idToKeyCache && (now - idToKeyLastFetchTime) < CACHE_DURATION) {
    return idToKeyCache;
  }

  try {
    const res = await fetch('/.netlify/functions/list-stations');
    if (res.ok) {
      const payload = await res.json();
      const map = new Map();
      if (payload && Array.isArray(payload.stations)) {
        for (const s of payload.stations) {
          if (s && s.id && s.key) {
            map.set(String(s.id), String(s.key));
          }
        }
      }
      idToKeyCache = map;
      idToKeyLastFetchTime = now;
      return map;
    }
  } catch (e) {
    // Ignore and fall back to empty map
  }

  return new Map();
};

// Fetch stations metadata from GitHub
const fetchStationsMetadata = async () => {
  const now = Date.now();
  
  // Return cached data if still fresh
  if (stationsMetadataCache && (now - lastFetchTime) < CACHE_DURATION) {
    return stationsMetadataCache;
  }

  // Try local file first (works in production and dev)
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

  // Then try CDN mirror (no preflight headers)
  try {
    const cdnUrl = 'https://cdn.jsdelivr.net/gh/Bankesy20/rainfall.tracker@main/data/processed/stations-metadata.json';
    const cdnResponse = await fetch(cdnUrl, { cache: 'no-store' });
    if (cdnResponse.ok) {
      const data = await cdnResponse.json();
      stationsMetadataCache = data;
      lastFetchTime = now;
      return data;
    }
  } catch (error) {
    console.warn('Failed to fetch stations metadata from CDN:', error);
  }

  // Finally try GitHub raw (avoid custom headers to prevent preflight)
  try {
    const githubUrl = 'https://raw.githubusercontent.com/Bankesy20/rainfall.tracker/main/data/processed/stations-metadata.json';
    const response = await fetch(githubUrl, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      stationsMetadataCache = data;
      lastFetchTime = now;
      return data;
    }
  } catch (error) {
    console.warn('Failed to fetch stations metadata from GitHub:', error);
  }

  // Final fallback to hardcoded coordinates
  console.warn('Using fallback hardcoded coordinates');
  return {
    stations: {
      'E19017': {
        key: 'E19017',
        stationId: 'E19017',
        name: 'Ashdon',
        label: 'Ashdon (E19017)',
        provider: 'Environment Agency',
        country: 'England',
        coordinates: { lat: 52.058925, lng: 0.296651 }
      },
      'E23518': {
        key: 'E23518',
        stationId: 'E23518',
        name: 'Hethersett',
        label: 'Hethersett (E23518)',
        provider: 'Environment Agency',
        country: 'England',
        coordinates: { lat: 52.603459, lng: 1.16988 }
      },
      'E24879': {
        key: 'E24879',
        stationId: 'E24879',
        name: 'Hullbridge Raine',
        label: 'Hullbridge Raine (E24879)',
        provider: 'Environment Agency',
        country: 'England',
        coordinates: { lat: 51.616598, lng: 0.593505 }
      },
      'E24913': {
        key: 'E24913',
        stationId: 'E24913',
        name: 'Tiptree',
        label: 'Tiptree (E24913)',
        provider: 'Environment Agency',
        country: 'England',
        coordinates: { lat: 51.815014, lng: 0.765948 }
      },
      'E5170': {
        key: 'E5170',
        stationId: 'E5170',
        name: 'Lower Standen',
        label: 'Lower Standen (E5170)',
        provider: 'Environment Agency',
        country: 'England',
        coordinates: { lat: 51.117863, lng: 1.194265 }
      },
      'E8290': {
        key: 'E8290',
        stationId: 'E8290',
        name: 'Isfield Weir',
        label: 'Isfield Weir (E8290)',
        provider: 'Environment Agency',
        country: 'England',
        coordinates: { lat: 51.434974, lng: -0.353451 }
      },
      'E7050': {
        key: 'E7050',
        stationId: 'E7050',
        name: 'Preston Capes',
        label: 'Preston Capes (E7050)',
        provider: 'Environment Agency',
        country: 'England',
        coordinates: { lat: 52.186277, lng: -1.171327 }
      },
      'E13600': {
        key: 'E13600',
        stationId: 'E13600',
        name: 'Lyndhurst',
        label: 'Lyndhurst (E13600)',
        provider: 'Environment Agency',
        country: 'England',
        coordinates: { lat: 50.880106, lng: -1.558591 }
      },
      '031555': {
        key: '031555',
        stationId: '031555',
        name: 'Easby',
        label: 'Easby (031555)',
        provider: 'Environment Agency',
        country: 'England',
        coordinates: { lat: 54.469846, lng: -1.099639 }
      },
      '577271': {
        key: '577271',
        stationId: '577271',
        name: 'Red Br',
        label: 'Red Br (577271)',
        provider: 'Environment Agency',
        country: 'England',
        coordinates: { lat: 53.783353, lng: -2.991754 }
      },
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

  // Build a mapping from stationId -> stationKey as used by API/dropdown (cached)
  const idToKey = await fetchStationKeyMap();

  // Convert metadata to coordinates format expected by map
  Object.values(metadata.stations).forEach(station => {
    if (station.coordinates && station.coordinates.lat && station.coordinates.lng) {
      const preferredKey = idToKey.get(String(station.stationId)) || station.key || station.stationId;
      coordinates[preferredKey] = {
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
