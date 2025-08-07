import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import RainfallChart from './components/RainfallChart';
import DataSummary from './components/DataSummary';
import { validateRainfallData } from './utils/dataProcessor';

// Extend dayjs with relative time plugin
dayjs.extend(relativeTime);

function App() {
  const [rainfallData, setRainfallData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(true);

  // Load data from the processed JSON file
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Try to load from the public data directory
        const response = await fetch('/data/processed/rainfall-history.json');
        
        if (!response.ok) {
          throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!validateRainfallData(data)) {
          throw new Error('Invalid data format');
        }
        
        setRainfallData(data);
      } catch (err) {
        console.error('Error loading rainfall data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle theme toggle
  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  // Apply dark mode to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading rainfall data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Error Loading Data
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2 sm:space-x-4">
                              <div>
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                    UK Rainfall Tracker
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Miserden Gauge - Station 1141
                  </p>
                </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-label="Toggle dark mode"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {rainfallData ? (
          <div className="space-y-6 sm:space-y-8">
            {/* Collapsible Statistics */}
            <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
              <button
                onClick={() => setStatsExpanded(!statsExpanded)}
                className="w-full px-4 sm:px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-lg"
              >
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                  Rainfall Statistics
                </h2>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {statsExpanded ? 'Hide' : 'Show'}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500">
                    {statsExpanded ? '▼' : '▶'}
                  </span>
                </div>
              </button>
              
              {statsExpanded && (
                <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                  <DataSummary 
                    data={rainfallData.data} 
                    lastUpdated={rainfallData.lastUpdated}
                  />
                </div>
              )}
            </section>

            {/* Rainfall Chart */}
            <section>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
                Rainfall Trends
              </h2>
              <RainfallChart 
                data={rainfallData.data} 
                height={400}
              />
            </section>

            {/* Data Source Info */}
            <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                Data Source
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div>
                  <p><strong>Location:</strong> Miserden Gauge (Station {rainfallData.station})</p>
                  <p><strong>Source:</strong> UK Government Flood Information Service</p>
                  <p><strong>Updated:</strong> {dayjs(rainfallData.lastUpdated).format('MMM DD, YYYY HH:mm')}</p>
                </div>
                <div>
                  <p><strong>Records:</strong> {rainfallData.data.length.toLocaleString()}</p>
                  <p><strong>Collection:</strong> Automated scraping</p>
                  <p><strong>Frequency:</strong> Every 4 hours</p>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Data Available
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Rainfall data is not currently available. Please check back later.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p>
              Data sourced from{' '}
              <a 
                href="https://check-for-flooding.service.gov.uk/rainfall-station/1141" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                UK Government Flood Information Service
              </a>
            </p>
            <p className="mt-2">
              This dashboard is automatically updated every 24 hours via GitHub Actions
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App; 