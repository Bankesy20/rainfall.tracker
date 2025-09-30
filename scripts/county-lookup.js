/**
 * County Lookup Utility
 * 
 * Maps coordinates to UK counties using a simplified approach
 * Based on approximate county boundaries
 */

// Simplified county boundaries (lat/long ranges)
const COUNTY_BOUNDARIES = {
  // England Counties
  'Bedfordshire': { minLat: 51.8, maxLat: 52.3, minLng: -0.8, maxLng: -0.2 },
  'Berkshire': { minLat: 51.3, maxLat: 51.7, minLng: -1.3, maxLng: -0.5 },
  'Buckinghamshire': { minLat: 51.5, maxLat: 52.1, minLng: -1.1, maxLng: -0.4 },
  'Cambridgeshire': { minLat: 52.0, maxLat: 52.7, minLng: -0.5, maxLng: 0.5 },
  'Cheshire': { minLat: 53.0, maxLat: 53.5, minLng: -3.0, maxLng: -2.0 },
  'Cornwall': { minLat: 49.9, maxLat: 50.8, minLng: -5.8, maxLng: -4.2 },
  'Cumbria': { minLat: 54.0, maxLat: 55.0, minLng: -3.5, maxLng: -2.0 },
  'Derbyshire': { minLat: 52.7, maxLat: 53.5, minLng: -2.0, maxLng: -1.0 },
  'Devon': { minLat: 50.2, maxLat: 51.2, minLng: -4.8, maxLng: -3.0 },
  'Dorset': { minLat: 50.5, maxLat: 51.0, minLng: -2.8, maxLng: -1.8 },
  'Durham': { minLat: 54.5, maxLat: 55.0, minLng: -2.0, maxLng: -1.0 },
  'East Sussex': { minLat: 50.7, maxLat: 51.1, minLng: 0.0, maxLng: 0.8 },
  'Essex': { minLat: 51.5, maxLat: 52.0, minLng: 0.0, maxLng: 1.5 },
  'Gloucestershire': { minLat: 51.5, maxLat: 52.2, minLng: -2.8, maxLng: -1.5 },
  'Hampshire': { minLat: 50.7, maxLat: 51.4, minLng: -1.8, maxLng: -0.5 },
  'Isle of Wight': { minLat: 50.5, maxLat: 50.8, minLng: -1.6, maxLng: -1.0 },
  'Herefordshire': { minLat: 51.8, maxLat: 52.3, minLng: -3.0, maxLng: -2.3 },
  'Hertfordshire': { minLat: 51.6, maxLat: 52.0, minLng: -0.8, maxLng: 0.0 },
  'Kent': { minLat: 51.0, maxLat: 51.5, minLng: 0.0, maxLng: 1.5 },
  'Lancashire': { minLat: 53.5, maxLat: 54.5, minLng: -3.0, maxLng: -1.5 },
  'Leicestershire': { minLat: 52.4, maxLat: 53.0, minLng: -1.5, maxLng: -0.5 },
  'Lincolnshire': { minLat: 52.7, maxLat: 53.7, minLng: -1.0, maxLng: 0.5 },
  'Norfolk': { minLat: 52.4, maxLat: 53.0, minLng: 0.0, maxLng: 1.8 },
  'Northamptonshire': { minLat: 52.0, maxLat: 52.7, minLng: -1.2, maxLng: -0.3 },
  'Northumberland': { minLat: 54.8, maxLat: 55.8, minLng: -2.5, maxLng: -1.0 },
  'Nottinghamshire': { minLat: 52.7, maxLat: 53.5, minLng: -1.5, maxLng: -0.5 },
  'Oxfordshire': { minLat: 51.5, maxLat: 52.2, minLng: -1.8, maxLng: -0.8 },
  'Somerset': { minLat: 50.8, maxLat: 51.5, minLng: -3.5, maxLng: -2.0 },
  'Staffordshire': { minLat: 52.5, maxLat: 53.2, minLng: -2.5, maxLng: -1.5 },
  'Suffolk': { minLat: 52.0, maxLat: 52.5, minLng: 0.5, maxLng: 1.8 },
  'Surrey': { minLat: 51.0, maxLat: 51.5, minLng: -0.8, maxLng: 0.0 },
  'Warwickshire': { minLat: 52.0, maxLat: 52.7, minLng: -1.8, maxLng: -1.0 },
  'West Sussex': { minLat: 50.7, maxLat: 51.2, minLng: -0.8, maxLng: 0.5 },
  'Wiltshire': { minLat: 51.0, maxLat: 51.7, minLng: -2.5, maxLng: -1.5 },
  'Worcestershire': { minLat: 52.0, maxLat: 52.5, minLng: -2.5, maxLng: -1.8 },
  'Yorkshire': { minLat: 53.0, maxLat: 54.5, minLng: -2.5, maxLng: -0.5 },
  
  // Wales Counties
  'Anglesey': { minLat: 53.0, maxLat: 53.5, minLng: -4.8, maxLng: -4.0 },
  'Gwynedd': { minLat: 52.5, maxLat: 53.5, minLng: -4.5, maxLng: -3.0 },
  'Conwy': { minLat: 53.0, maxLat: 53.5, minLng: -4.0, maxLng: -3.5 },
  'Denbighshire': { minLat: 52.8, maxLat: 53.2, minLng: -3.5, maxLng: -3.0 },
  'Flintshire': { minLat: 53.0, maxLat: 53.5, minLng: -3.5, maxLng: -2.8 },
  'Wrexham': { minLat: 52.8, maxLat: 53.2, minLng: -3.2, maxLng: -2.8 },
  'Powys': { minLat: 51.8, maxLat: 53.0, minLng: -4.0, maxLng: -2.8 },
  'Ceredigion': { minLat: 52.0, maxLat: 52.8, minLng: -4.5, maxLng: -3.5 },
  'Pembrokeshire': { minLat: 51.5, maxLat: 52.2, minLng: -5.5, maxLng: -4.5 },
  'Carmarthenshire': { minLat: 51.5, maxLat: 52.2, minLng: -4.8, maxLng: -3.5 },
  'Swansea': { minLat: 51.5, maxLat: 51.8, minLng: -4.2, maxLng: -3.8 },
  'Neath Port Talbot': { minLat: 51.5, maxLat: 51.8, minLng: -4.0, maxLng: -3.5 },
  'Bridgend': { minLat: 51.4, maxLat: 51.6, minLng: -3.8, maxLng: -3.2 },
  'Vale of Glamorgan': { minLat: 51.4, maxLat: 51.6, minLng: -3.5, maxLng: -3.0 },
  'Cardiff': { minLat: 51.4, maxLat: 51.6, minLng: -3.3, maxLng: -3.0 },
  'Rhondda Cynon Taf': { minLat: 51.5, maxLat: 51.8, minLng: -3.8, maxLng: -3.2 },
  'Merthyr Tydfil': { minLat: 51.6, maxLat: 51.8, minLng: -3.5, maxLng: -3.2 },
  'Caerphilly': { minLat: 51.5, maxLat: 51.8, minLng: -3.5, maxLng: -3.0 },
  'Blaenau Gwent': { minLat: 51.6, maxLat: 51.8, minLng: -3.3, maxLng: -3.0 },
  'Torfaen': { minLat: 51.6, maxLat: 51.8, minLng: -3.2, maxLng: -2.8 },
  'Monmouthshire': { minLat: 51.5, maxLat: 52.0, minLng: -3.2, maxLng: -2.5 },
  'Newport': { minLat: 51.5, maxLat: 51.7, minLng: -3.2, maxLng: -2.8 }
};

/**
 * Get county name from coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} County name or 'Unknown'
 */
function getCountyFromCoordinates(lat, lng) {
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return 'Unknown';
  }

  // Check each county boundary
  for (const [county, bounds] of Object.entries(COUNTY_BOUNDARIES)) {
    if (lat >= bounds.minLat && lat <= bounds.maxLat && 
        lng >= bounds.minLng && lng <= bounds.maxLng) {
      return county;
    }
  }

  return 'Unknown';
}

/**
 * Get county from station data
 * @param {Object} station - Station data object
 * @returns {string} County name
 */
function getCountyFromStation(station) {
  // Try to get from location data first
  if (station.location && station.location.lat && station.location.long) {
    return getCountyFromCoordinates(station.location.lat, station.location.long);
  }

  // Try to get from station data directly
  if (station.lat && station.lng) {
    return getCountyFromCoordinates(station.lat, station.lng);
  }

  // Try to get from station data with different property names
  if (station.latitude && station.longitude) {
    return getCountyFromCoordinates(station.latitude, station.longitude);
  }

  return 'Unknown';
}

module.exports = {
  getCountyFromCoordinates,
  getCountyFromStation,
  COUNTY_BOUNDARIES
};
