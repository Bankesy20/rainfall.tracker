import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

const RainfallLeaderboard = React.memo(({ onStationSelect, availableStations = {} }) => {
  const [leaderboards, setLeaderboards] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('total_rainfall');
  const [selectedPeriod, setSelectedPeriod] = useState('24h');
  const [selectedCounty, setSelectedCounty] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const metrics = {
    'total_rainfall': { name: 'Total Rainfall', unit: 'mm' },
    'max_hourly': { name: 'Max Hourly', unit: 'mm/h' },
    'max_15min': { name: 'Max 15min', unit: 'mm/15min' },
    'rainy_days': { name: 'Rainy Days', unit: 'days' }
  };

  const periods = {
    '24h': { name: '24 Hours', short: '24h' },
    '7d': { name: '7 Days', short: '7d' },
    '30d': { name: '30 Days', short: '30d' },
    'all-time': { name: 'All Time', short: '∞' }
  };

  // Function to map station ID to station key
  const getStationKeyFromId = (stationId) => {
    // Look through available stations to find the one with matching stationId
    for (const [key, station] of Object.entries(availableStations)) {
      if (station.stationId === stationId || station.originalKey === stationId) {
        return key;
      }
    }
    return null;
  };

  // Load a specific leaderboard from Netlify Blobs
  const loadLeaderboard = async (metric, period) => {
    const key = `${metric}-${period}`;
    
    // Don't reload if already loaded (unless it's been more than 5 minutes)
    if (leaderboards[key] && leaderboards[key]._lastFetched) {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      if (leaderboards[key]._lastFetched > fiveMinutesAgo) {
        return leaderboards[key];
      }
    }
    
    try {
      // Try Netlify function first (always gets latest data from blobs)
      const netlifyUrl = `https://rainfalltracker.netlify.app/.netlify/functions/leaderboard-data/leaderboard-${metric}-${period}.json`;
      
      let response = await fetch(netlifyUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      // If Netlify Blobs fails, fallback to local file
      if (!response.ok) {
        console.warn(`Netlify Blobs failed for ${metric}-${period}, trying local fallback...`);
        const cacheBuster = `?t=${Date.now()}`;
        response = await fetch(`/data/processed/leaderboards/leaderboard-${metric}-${period}.json${cacheBuster}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
      
      if (response.ok) {
        const data = await response.json();
        // Add timestamp for cache management
        data._lastFetched = Date.now();
        data._source = response.url.includes('netlify.app') ? 'netlify' : 'local';
        
        setLeaderboards(prev => ({
          ...prev,
          [key]: data
        }));
        return data;
      } else {
        console.warn(`Failed to load leaderboard ${metric}-${period}: HTTP ${response.status}`);
        return null;
      }
    } catch (err) {
      console.warn(`Failed to load leaderboard ${metric}-${period}:`, err);
      return null;
    }
  };

  // Load initial leaderboard (24h total_rainfall)
  useEffect(() => {
    const loadInitialLeaderboard = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await loadLeaderboard('total_rainfall', '24h');
        if (data) {
          setLastRefresh(new Date());
        } else {
          setError('Failed to load initial leaderboard');
        }
      } catch (err) {
        setError('Failed to load initial leaderboard');
        console.error('Error loading initial leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialLeaderboard();
  }, []);

  // Load leaderboard when selection changes
  useEffect(() => {
    const loadSelectedLeaderboard = async () => {
      const key = `${selectedMetric}-${selectedPeriod}`;
      
      // Only load if not already loaded
      if (!leaderboards[key]) {
        setLoadingLeaderboard(true);
        try {
          await loadLeaderboard(selectedMetric, selectedPeriod);
        } catch (err) {
          console.error(`Error loading ${key}:`, err);
        } finally {
          setLoadingLeaderboard(false);
        }
      }
    };

    loadSelectedLeaderboard();
  }, [selectedMetric, selectedPeriod, leaderboards]);

  // Function to manually refresh current leaderboard
  const refreshLeaderboards = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Clear current leaderboard from cache to force reload
      const key = `${selectedMetric}-${selectedPeriod}`;
      setLeaderboards(prev => {
        const newLeaderboards = { ...prev };
        delete newLeaderboards[key];
        return newLeaderboards;
      });
      
      // Reload the current leaderboard
      const data = await loadLeaderboard(selectedMetric, selectedPeriod);
      if (data) {
        setLastRefresh(new Date());
      } else {
        setError('Failed to refresh leaderboard');
      }
    } catch (err) {
      setError('Failed to refresh leaderboard');
      console.error('Error refreshing leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentLeaderboard = leaderboards[`${selectedMetric}-${selectedPeriod}`];

  // Extract unique counties from current leaderboard
  const availableCounties = React.useMemo(() => {
    if (!currentLeaderboard?.rankings) return [];
    
    const counties = [...new Set(currentLeaderboard.rankings.map(entry => entry.county))];
    return counties.sort();
  }, [currentLeaderboard]);

  // Filter leaderboard by selected county
  const filteredRankings = React.useMemo(() => {
    if (!currentLeaderboard?.rankings) return [];
    
    if (selectedCounty === 'all') {
      return currentLeaderboard.rankings;
    }
    
    return currentLeaderboard.rankings.filter(entry => entry.county === selectedCounty);
  }, [currentLeaderboard, selectedCounty]);

  // Calculate percentage for filtered results
  const filteredStats = React.useMemo(() => {
    if (!filteredRankings.length) return { rainfallPercentage: 0, totalStations: 0, stationsWithRainfall: 0 };
    
    const stationsWithRainfall = filteredRankings.filter(entry => entry.value > 0).length;
    const totalStations = filteredRankings.length;
    const rainfallPercentage = Math.round((stationsWithRainfall / totalStations) * 100);
    
    return {
      rainfallPercentage,
      totalStations,
      stationsWithRainfall
    };
  }, [filteredRankings]);

  // Reset county filter when metric or period changes
  React.useEffect(() => {
    setSelectedCounty('all');
  }, [selectedMetric, selectedPeriod]);

  const getRankIcon = (rank) => {
    return `#${rank}`;
  };

  const getRankBadgeClass = (rank) => {
    if (rank === 1) return 'rank-badge rank-gold';
    if (rank === 2) return 'rank-badge rank-silver';
    if (rank === 3) return 'rank-badge rank-bronze';
    return 'rank-badge bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  };

  const formatValue = (value, unit) => {
    if (unit === 'days') return Math.round(value);
    return value.toFixed(1);
  };

  if (loading) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading leaderboards...</span>
          </div>
        </div>
      </section>
    );
  }

  if (loadingLeaderboard) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              Rainfall Leaderboards
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <span>{expanded ? 'Hide' : 'Show'}</span>
              <span className="text-gray-400 dark:text-gray-500">
                {expanded ? '▼' : '▶'}
              </span>
            </button>
          </div>
        </div>
        {expanded && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading {metrics[selectedMetric].name} for {periods[selectedPeriod].name}...</span>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (error || !currentLeaderboard) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="p-6">
          <div className="text-center py-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Leaderboards Unavailable
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {error || 'Leaderboard data is not available at the moment.'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              This feature is automatically updated every 6 hours.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            Rainfall Leaderboards
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          {expanded && (
            <button
              onClick={refreshLeaderboards}
              disabled={loading}
              className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh leaderboard data"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <span>{expanded ? 'Hide' : 'Show'}</span>
            <span className="text-gray-400 dark:text-gray-500">
              {expanded ? '▼' : '▶'}
            </span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          {/* Current Selection Display */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {metrics[selectedMetric].name} Leaderboard
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {periods[selectedPeriod].name} • {metrics[selectedMetric].unit}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {filteredStats.rainfallPercentage}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  of {selectedCounty === 'all' ? 'all' : selectedCounty} stations had rainfall
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
            {/* Metric Selector */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Metric
              </label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {Object.entries(metrics).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Period Selector */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time Period
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {Object.entries(periods).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.name}
                  </option>
                ))}
              </select>
            </div>

            {/* County Selector */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                County
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedCounty}
                  onChange={(e) => setSelectedCounty(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All Counties</option>
                  {availableCounties.map((county) => (
                    <option key={county} value={county}>
                      {county}
                    </option>
                  ))}
                </select>
                {selectedCounty !== 'all' && (
                  <button
                    onClick={() => setSelectedCounty('all')}
                    className="px-3 py-2 text-xs bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                    title="Clear county filter"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden shadow-inner">
            {filteredRankings.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-500 dark:text-gray-400 mb-2">
                  {selectedCounty === 'all' ? 'No stations with rainfall data' : `No stations in ${selectedCounty} with rainfall data`}
                </div>
                <div className="text-sm text-gray-400 dark:text-gray-500">
                  {selectedCounty === 'all' 
                    ? 'Try refreshing the data or check back later'
                    : 'Try selecting a different county or time period'
                  }
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                <thead className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700">
                  <tr>
                    <th className="px-2 sm:px-4 py-3 sm:py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-2 sm:px-4 py-3 sm:py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Station
                    </th>
                    <th className="px-2 sm:px-4 py-3 sm:py-4 text-left text-xs font-semibold text-white uppercase tracking-wider hidden sm:table-cell">
                      County
                    </th>
                    <th className="px-2 sm:px-4 py-3 sm:py-4 text-right text-xs font-semibold text-white uppercase tracking-wider">
                      {metrics[selectedMetric].name}
                    </th>
                    <th className="px-2 sm:px-4 py-3 sm:py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800">
                  {filteredRankings.slice(0, 10).map((entry) => (
                    <tr key={entry.rank} className={`leaderboard-row ${entry.rank <= 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10' : ''}`}>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={getRankBadgeClass(entry.rank)}>
                            {entry.rank <= 3 ? getRankIcon(entry.rank) : entry.rank}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {entry.stationName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Station {entry.station}
                        </div>
                        {/* Show county on mobile in station cell */}
                        <div className="sm:hidden mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {entry.county || entry.region}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {entry.county || entry.region}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-right">
                        <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                          {formatValue(entry.value, metrics[selectedMetric].unit)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {metrics[selectedMetric].unit}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-center">
                        {onStationSelect && (() => {
                          const stationKey = getStationKeyFromId(entry.station);
                          return stationKey ? (
                            <button
                              onClick={() => onStationSelect(stationKey)}
                              className="px-2 sm:px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                              title="View station history"
                            >
                              <span className="hidden sm:inline">View History</span>
                              <span className="sm:hidden">View</span>
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              N/A
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {/* Footer Info */}
          {filteredRankings.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-gray-500 dark:text-gray-400">
            <div>
              {selectedCounty === 'all' ? (
                <>
                  Showing top 10 of {filteredStats.stationsWithRainfall} stations with rainfall ({filteredStats.rainfallPercentage}% of all stations)
                </>
              ) : (
                <>
                  Showing top 10 of {filteredStats.stationsWithRainfall} stations in {selectedCounty} ({filteredStats.rainfallPercentage}% of {selectedCounty} stations)
                </>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
              <div>
                Data: {dayjs(currentLeaderboard.generated_at).format('MMM DD, HH:mm')}
              </div>
              {lastRefresh && (
                <div>
                  Refreshed: {dayjs(lastRefresh).format('HH:mm:ss')}
                  {currentLeaderboard._source && (
                    <span className="ml-2 text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      {currentLeaderboard._source === 'netlify' ? '🌐 Live' : '📁 Local'}
                    </span>
                  )}
                </div>
              )}
            </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
});

export default RainfallLeaderboard;
 