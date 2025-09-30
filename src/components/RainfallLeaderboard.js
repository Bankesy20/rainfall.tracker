import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

const RainfallLeaderboard = () => {
  const [leaderboards, setLeaderboards] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('total_rainfall');
  const [selectedPeriod, setSelectedPeriod] = useState('24h');
  const [expanded, setExpanded] = useState(true);

  const metrics = {
    'total_rainfall': { name: 'Total Rainfall', unit: 'mm', icon: '🌧️' },
    'max_hourly': { name: 'Max Hourly', unit: 'mm/h', icon: '⚡' },
    'max_15min': { name: 'Max 15min', unit: 'mm/15min', icon: '💨' },
    'rainy_days': { name: 'Rainy Days', unit: 'days', icon: '📅' }
  };

  const periods = {
    '24h': { name: '24 Hours', short: '24h' },
    '7d': { name: '7 Days', short: '7d' },
    '30d': { name: '30 Days', short: '30d' },
    'all-time': { name: 'All Time', short: '∞' }
  };

  useEffect(() => {
    const loadLeaderboards = async () => {
      try {
        setLoading(true);
        const loadedLeaderboards = {};
        
        // Load all leaderboard combinations
        for (const metric of Object.keys(metrics)) {
          for (const period of Object.keys(periods)) {
            try {
              const response = await fetch(`/data/processed/leaderboards/leaderboard-${metric}-${period}.json`);
              if (response.ok) {
                const data = await response.json();
                loadedLeaderboards[`${metric}-${period}`] = data;
              } else {
                console.warn(`Failed to load leaderboard ${metric}-${period}: HTTP ${response.status}`);
              }
            } catch (err) {
              console.warn(`Failed to load leaderboard ${metric}-${period}:`, err);
            }
          }
        }
        
        setLeaderboards(loadedLeaderboards);
      } catch (err) {
        setError('Failed to load leaderboards');
        console.error('Error loading leaderboards:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboards();
  }, []);

  const currentLeaderboard = leaderboards[`${selectedMetric}-${selectedPeriod}`];

  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
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

  if (error || !currentLeaderboard) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="p-6">
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📊</div>
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
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 sm:px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-lg"
      >
        <div className="flex items-center space-x-3">
          <span className="text-2xl">🏆</span>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            Rainfall Leaderboards
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {expanded ? 'Hide' : 'Show'}
          </span>
          <span className="text-gray-400 dark:text-gray-500">
            {expanded ? '▼' : '▶'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          {/* Current Selection Display */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-3xl">{metrics[selectedMetric].icon}</span>
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
                  {currentLeaderboard.rankings.length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Stations
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Metric Selector */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Metric
              </label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(metrics).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.icon} {config.name}
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(periods).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden shadow-inner">
            <div className="overflow-x-auto">
              <table className="leaderboard-table">
                <thead className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Station
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Region
                    </th>
                    <th className="px-4 py-4 text-right text-xs font-semibold text-white uppercase tracking-wider">
                      {metrics[selectedMetric].name}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800">
                  {currentLeaderboard.rankings.slice(0, 10).map((entry) => (
                    <tr key={entry.rank} className={`leaderboard-row ${entry.rank <= 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10' : ''}`}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={getRankBadgeClass(entry.rank)}>
                            {entry.rank <= 3 ? getRankIcon(entry.rank) : entry.rank}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {entry.stationName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Station {entry.station}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {entry.region}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatValue(entry.value, metrics[selectedMetric].unit)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {metrics[selectedMetric].unit}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-gray-500 dark:text-gray-400">
            <div>
              Showing top 10 of {currentLeaderboard.rankings.length} stations
            </div>
            <div>
              Updated: {dayjs(currentLeaderboard.generated_at).format('MMM DD, HH:mm')}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default RainfallLeaderboard;
