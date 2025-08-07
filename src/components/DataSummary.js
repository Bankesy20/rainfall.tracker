import React from 'react';
import dayjs from 'dayjs';
import { 
  calculateStatistics, 
  getLatestReading, 
  formatRainfall, 
  isDataStale 
} from '../utils/dataProcessor';

const DataSummary = ({ data, lastUpdated }) => {
  const stats30 = calculateStatistics(data, 30);
  const stats7 = calculateStatistics(data, 7);
  const latestReading = getLatestReading(data);
  const isStale = isDataStale(lastUpdated);

  const StatCard = ({ title, value, unit, subtitle, color = 'blue' }) => (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-${color}-500`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value} {unit}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`text-${color}-500 text-3xl`}>
          {title.includes('Rainfall') ? '🌧️' : 
           title.includes('Days') ? '📅' : 
           title.includes('Average') ? '📊' : '📈'}
        </div>
      </div>
    </div>
  );

  const LatestReadingCard = () => {
    if (!latestReading) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-gray-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Latest Reading</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">No data available</p>
            </div>
            <div className="text-gray-500 text-3xl">❓</div>
          </div>
        </div>
      );
    }

    const readingTime = dayjs(`${latestReading.date} ${latestReading.time}`);
    const timeAgo = readingTime.fromNow();

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-green-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Latest Reading</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatRainfall(latestReading.rainfall_mm)} mm
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {readingTime.format('MMM DD, YYYY HH:mm')} ({timeAgo})
            </p>
          </div>
          <div className="text-green-500 text-3xl">💧</div>
        </div>
      </div>
    );
  };

  const DataStatusCard = () => {
    const statusColor = isStale ? 'red' : 'green';
    const statusText = isStale ? 'Data may be outdated' : 'Data is current';
    const statusIcon = isStale ? '⚠️' : '✅';

    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-${statusColor}-500`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Data Status</p>
            <p className={`text-lg font-bold text-${statusColor}-600 dark:text-${statusColor}-400`}>
              {statusText}
            </p>
            {lastUpdated && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Last updated: {dayjs(lastUpdated).format('MMM DD, YYYY HH:mm')}
              </p>
            )}
          </div>
          <div className="text-2xl">{statusIcon}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Latest Reading and Status Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LatestReadingCard />
        <DataStatusCard />
      </div>

      {/* 30-Day Statistics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          30-Day Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Rainfall"
            value={formatRainfall(stats30.total_rainfall)}
            unit="mm"
            subtitle={`${stats30.days_with_rain} days with rain`}
            color="blue"
          />
          <StatCard
            title="Average Daily"
            value={formatRainfall(stats30.average_daily)}
            unit="mm"
            subtitle={`Over ${stats30.total_days} days`}
            color="green"
          />
          <StatCard
            title="Maximum Daily"
            value={formatRainfall(stats30.max_daily)}
            unit="mm"
            subtitle="Highest single day"
            color="yellow"
          />
          <StatCard
            title="Days with Rain"
            value={stats30.days_with_rain}
            unit="days"
            subtitle={`${((stats30.days_with_rain / stats30.total_days) * 100).toFixed(1)}% of days`}
            color="purple"
          />
        </div>
      </div>

      {/* 7-Day Statistics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          7-Day Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Rainfall"
            value={formatRainfall(stats7.total_rainfall)}
            unit="mm"
            subtitle={`${stats7.days_with_rain} days with rain`}
            color="blue"
          />
          <StatCard
            title="Average Daily"
            value={formatRainfall(stats7.average_daily)}
            unit="mm"
            subtitle={`Over ${stats7.total_days} days`}
            color="green"
          />
          <StatCard
            title="Maximum Daily"
            value={formatRainfall(stats7.max_daily)}
            unit="mm"
            subtitle="Highest single day"
            color="yellow"
          />
          <StatCard
            title="Days with Rain"
            value={stats7.days_with_rain}
            unit="days"
            subtitle={`${((stats7.days_with_rain / stats7.total_days) * 100).toFixed(1)}% of days`}
            color="purple"
          />
        </div>
      </div>

      {/* Data Quality Indicators */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Data Quality
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${data && data.length > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Data Available: {data && data.length > 0 ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${!isStale ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Data Freshness: {!isStale ? 'Current' : 'Stale'}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${data && data.length > 100 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Data Volume: {data ? data.length : 0} records
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataSummary; 