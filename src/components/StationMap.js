import React, { useState, useCallback } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/maplibre';
import { getStationCoordinates, getMapCenter, getMapBounds } from '../utils/stationCoordinates';

const StationMap = ({ 
  isOpen, 
  onClose, 
  onStationSelect, 
  currentStation, 
  compareStation,
  title = "Select Station"
}) => {
  const [selectedStation, setSelectedStation] = useState(null);
  const stationCoords = getStationCoordinates();
  const mapCenter = getMapCenter();
  const mapBounds = getMapBounds();


  const handleMarkerClick = useCallback((stationKey) => {
    setSelectedStation(stationKey);
  }, []);

  const handleStationSelect = useCallback((stationKey) => {
    onStationSelect(stationKey);
    onClose();
  }, [onStationSelect, onClose]);

  const getMarkerColor = (stationKey) => {
    if (stationKey === currentStation) return '#3b82f6'; // Blue for current
    if (stationKey === compareStation) return '#10b981'; // Green for compare
    return '#6b7280'; // Gray for others
  };

  const getMarkerSize = (stationKey) => {
    if (stationKey === currentStation || stationKey === compareStation) return 20;
    return 15;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-96 sm:h-[500px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <Map
            initialViewState={{
              longitude: mapCenter.lng,
              latitude: mapCenter.lat,
              zoom: 6
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle={{
              version: 8,
              sources: {
                'osm': {
                  type: 'raster',
                  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                  tileSize: 256,
                  attribution: '© OpenStreetMap contributors'
                }
              },
              layers: [
                {
                  id: 'osm',
                  type: 'raster',
                  source: 'osm'
                }
              ]
            }}
          >
            {Object.entries(stationCoords).map(([stationKey, coord]) => (
                <Marker
                  key={stationKey}
                  longitude={coord.lng}
                  latitude={coord.lat}
                  onClick={() => handleMarkerClick(stationKey)}
                >
                  <div
                    className="cursor-pointer transform transition-transform hover:scale-110"
                    style={{
                      width: getMarkerSize(stationKey),
                      height: getMarkerSize(stationKey),
                      backgroundColor: getMarkerColor(stationKey),
                      borderRadius: '50%',
                      border: '2px solid white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      color: 'white',
                      fontWeight: 'bold'
                    }}
                    title={coord.name}
                  >
                    {stationKey === currentStation ? 'A' : stationKey === compareStation ? 'B' : '•'}
                  </div>
                </Marker>
            ))}

            {/* Popup for selected station */}
            {selectedStation && stationCoords[selectedStation] && (
              <Popup
                longitude={stationCoords[selectedStation].lng}
                latitude={stationCoords[selectedStation].lat}
                onClose={() => setSelectedStation(null)}
                closeButton={false}
                closeOnClick={false}
              >
                <div className="p-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                    {stationCoords[selectedStation].name}
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {stationCoords[selectedStation].provider}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Station ID: {stationCoords[selectedStation].stationId}
                  </p>
                  <button
                    onClick={() => handleStationSelect(selectedStation)}
                    className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded transition-colors"
                  >
                    Select This Station
                  </button>
                </div>
              </Popup>
            )}
          </Map>
        </div>

        {/* Legend */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white"></div>
              <span className="text-gray-700 dark:text-gray-300">Current Station</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
              <span className="text-gray-700 dark:text-gray-300">Compare Station</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-gray-500 border-2 border-white"></div>
              <span className="text-gray-700 dark:text-gray-300">Available Stations</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StationMap;
