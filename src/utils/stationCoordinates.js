// Utility to get coordinates for stations that have actual data files
export const getStationCoordinates = () => {
  // Only include stations we actually have data for
  const coordinates = {
    'miserden1141': {
      lat: 51.8, // Miserden, Gloucestershire
      lng: -2.1,
      name: 'Miserden (1141)',
      provider: 'Environment Agency',
      stationId: '1141'
    },
    'maenclochog1099': {
      lat: 51.9, // Maenclochog, Pembrokeshire, Wales
      lng: -4.8,
      name: 'Maenclochog (1099)',
      provider: 'Natural Resources Wales',
      stationId: '1099'
    },
    'E7050': {
      lat: 52.186277, // Preston Capes
      lng: -1.171327,
      name: 'Preston Capes (E7050)',
      provider: 'Environment Agency',
      stationId: 'E7050'
    },
    'E13600': {
      lat: 50.880106, // Lyndhurst
      lng: -1.571327,
      name: 'Lyndhurst (E13600)',
      provider: 'Environment Agency',
      stationId: 'E13600'
    },
    'E19017': {
      lat: 52.058925, // Ashdon
      lng: 0.315167,
      name: 'Ashdon (E19017)',
      provider: 'Environment Agency',
      stationId: 'E19017'
    },
    'E23518': {
      lat: 52.603459, // Hethersett
      lng: 1.171327,
      name: 'Hethersett (E23518)',
      provider: 'Environment Agency',
      stationId: 'E23518'
    },
    'E24879': {
      lat: 51.616598, // Hullbridge Raine
      lng: 0.615167,
      name: 'Hullbridge Raine (E24879)',
      provider: 'Environment Agency',
      stationId: 'E24879'
    },
    'E24913': {
      lat: 51.815014, // Tiptree
      lng: 0.715167,
      name: 'Tiptree (E24913)',
      provider: 'Environment Agency',
      stationId: 'E24913'
    },
    'E5170': {
      lat: 51.117863, // Lower Standen
      lng: -0.515167,
      name: 'Lower Standen (E5170)',
      provider: 'Environment Agency',
      stationId: 'E5170'
    },
    'E8290': {
      lat: 51.434974, // Isfield Weir
      lng: 0.015167,
      name: 'Isfield Weir (E8290)',
      provider: 'Environment Agency',
      stationId: 'E8290'
    },
    '031555': {
      lat: 54.469846, // Easby
      lng: -1.215167,
      name: 'Easby (031555)',
      provider: 'Environment Agency',
      stationId: '031555'
    },
    '577271': {
      lat: 53.783353, // Red Br
      lng: -1.515167,
      name: 'Red Br (577271)',
      provider: 'Environment Agency',
      stationId: '577271'
    }
  };

  return coordinates;
};

// Get center point for map view
export const getMapCenter = () => {
  const coords = getStationCoordinates();
  const coordValues = Object.values(coords);
  
  if (coordValues.length === 0) {
    return { lat: 52.5, lng: -1.5 }; // Default UK center
  }

  const avgLat = coordValues.reduce((sum, coord) => sum + coord.lat, 0) / coordValues.length;
  const avgLng = coordValues.reduce((sum, coord) => sum + coord.lng, 0) / coordValues.length;
  
  return { lat: avgLat, lng: avgLng };
};

// Get bounds for all stations
export const getMapBounds = () => {
  const coords = getStationCoordinates();
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
