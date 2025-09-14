import React, { useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);
import { 
  calculateStatistics, 
  getLatestReading, 
  formatRainfall
} from '../utils/dataProcessor';

const DataSummary = ({ data, lastUpdated, compareData = null, labelA = 'A', labelB = 'B' }) => {
  const [timeRange, setTimeRange] = useState(30);
  const stats = calculateStatistics(data, timeRange);
  const compareStats = compareData ? calculateStatistics(compareData, timeRange) : null;
  const latestReading = getLatestReading(data);

  const timeRangeOptions = [
    { value: 1, label: '1 Day' },
    { value: 7, label: '7 Days' },
    { value: 30, label: '30 Days' },
    { value: 90, label: '90 Days' },
    { value: 365, label: '1 Year' },
    { value: 'all', label: 'All Time' }
  ];

  const StatCard = ({ title, value, unit, subtitle, color = 'blue', valueB, unitB, labelA: labelAOverride, labelB: labelBOverride }) => {
    const borderClass = `border-${color}-500`;
    const aLabel = labelAOverride || labelA;
    const bLabel = labelBOverride || labelB;
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border-l-4 ${borderClass}`}>
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate">{title}</p>
            {valueB === undefined ? (
              <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {value} {unit}
              </p>
            ) : (
              <div className="mt-1 space-y-1">
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-200">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{aLabel}:</span> {value} {unit}
                </p>
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-200">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{bLabel}:</span> {valueB} {unitB || unit}
                </p>
              </div>
            )}
            {subtitle && (
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const LatestReadingCard = () => {
    if (!latestReading) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border-l-4 border-gray-500">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Latest Reading</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">No data available</p>
            </div>

          </div>
        </div>
      );
    }

    const readingTime = dayjs(`${latestReading.date} ${latestReading.time}`);
    const timeAgo = readingTime.fromNow();

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 border-l-4 border-green-500">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Latest Reading</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {formatRainfall(latestReading.rainfall_mm)} mm
            </p>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              {readingTime.format('MMM DD, YYYY HH:mm')} ({timeAgo})
            </p>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Latest Reading */}
      <LatestReadingCard />

      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          Statistics
        </h3>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {timeRangeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Rainfall"
          value={formatRainfall(stats.total_rainfall)}
          unit="mm"
          subtitle={`${stats.days_with_rain} days with rain`}
          color="blue"
          {...(compareStats ? { valueB: formatRainfall(compareStats.total_rainfall), unitB: 'mm' } : {})}
        />
        <StatCard
          title="Average Daily"
          value={formatRainfall(stats.average_daily)}
          unit="mm"
          subtitle={`Over ${stats.total_days} days`}
          color="green"
          {...(compareStats ? { valueB: formatRainfall(compareStats.average_daily), unitB: 'mm' } : {})}
        />
        <StatCard
          title="Maximum Daily"
          value={formatRainfall(stats.max_daily)}
          unit="mm"
          subtitle="Highest single day"
          color="yellow"
          {...(compareStats ? { valueB: formatRainfall(compareStats.max_daily), unitB: 'mm' } : {})}
        />
        <StatCard
          title="Days with Rain"
          value={stats.days_with_rain}
          unit="days"
          subtitle={`${((stats.days_with_rain / (stats.total_days || 1)) * 100).toFixed(1)}% of days`}
          color="purple"
          {...(compareStats ? { valueB: compareStats.days_with_rain, unitB: 'days' } : {})}
        />
      </div>

      {/* Last Updated Info */}
      <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center">
        Last updated: {dayjs(lastUpdated).format('MMM DD, YYYY HH:mm')}
      </div>
    </div>
  );
};

export default DataSummary; 