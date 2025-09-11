// Registry of available rainfall stations

const stations = {
  miserden1141: {
    key: 'miserden1141',
    stationId: '1141',
    label: 'Miserden (1141)',
    source: 'UK GOV',
    staticPath: '/data/processed/rainfall-history.json',
    apiPath: '/.netlify/functions/rainfall-data'
  },
  maenclochog1099: {
    key: 'maenclochog1099',
    stationId: '1099',
    label: 'Maenclochog (1099)',
    source: 'NRW',
    staticPath: '/data/processed/wales-1099.json',
    apiPath: '/.netlify/functions/rainfall-data?station=maenclochog1099'
  }
};

export default stations;


