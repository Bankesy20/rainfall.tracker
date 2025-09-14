import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import dayjs from 'dayjs';
import { getChartData, formatRainfall, getRainfallColor } from '../utils/dataProcessor';

const RainfallChart = ({ data, compareData = null, compareLabel = null, primaryLabel = 'Station A', height = 400 }) => {
  const [chartType, setChartType] = useState('bar');
  const [aggregation, setAggregation] = useState('daily');
  const [timeRange, setTimeRange] = useState('30');

  const chartData = useMemo(() => {
    const rangeDays = timeRange === 'all' ? 365 * 10 : parseInt(timeRange);
    const primary = getChartData(data, rangeDays, aggregation);
    if (!compareData || compareData.length === 0) return primary;
    const secondary = getChartData(compareData, rangeDays, aggregation);
    // Align by date key
    const map = new Map(primary.map(d => [d.date, { ...d, rainfallA: d.rainfall }]));
    for (const s of secondary) {
      const existing = map.get(s.date);
      if (existing) {
        existing.rainfallB = s.rainfall;
      } else {
        map.set(s.date, { date: s.date, rainfallB: s.rainfall });
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [data, compareData, timeRange, aggregation]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const row = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 dark:text-white">
            {aggregation === 'hourly' 
              ? dayjs(label).format('MMM DD, YYYY HH:mm')
              : aggregation === 'daily'
              ? dayjs(label).format('MMM DD, YYYY')
              : aggregation === 'weekly'
              ? `Week of ${dayjs(label).format('MMM DD, YYYY')}`
              : aggregation === 'monthly'
              ? dayjs(label).format('MMM YYYY')
              : aggregation === 'yearly'
              ? dayjs(label).format('YYYY')
              : dayjs(label).format('MMM DD, YYYY')
            }
          </p>
          {row.rainfall !== undefined && (
            <p className="text-blue-600 dark:text-blue-400">
              Rainfall: {formatRainfall(row.rainfall)} mm
            </p>
          )}
          {row.rainfallA !== undefined && (
            <p className="text-blue-600 dark:text-blue-400">
              A: {formatRainfall(row.rainfallA)} mm
            </p>
          )}
          {row.rainfallB !== undefined && (
            <p className="text-emerald-600 dark:text-emerald-400">
              B: {formatRainfall(row.rainfallB)} mm
            </p>
          )}
          {aggregation === 'daily' && row.max_hourly !== undefined && (
            <p className="text-gray-600 dark:text-gray-400">
              Max hourly: {formatRainfall(row.max_hourly)} mm
            </p>
          )}
          {(aggregation === 'weekly' || aggregation === 'monthly' || aggregation === 'yearly') && row.max_daily !== undefined && (
            <p className="text-gray-600 dark:text-gray-400">
              Max daily: {formatRainfall(row.max_daily)} mm
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomBar = (props) => {
    const { x, y, width, height, payload } = props;
    const rainfall = payload.rainfall || 0;
    const color = getRainfallColor(rainfall);
    
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        stroke="none"
        rx={2}
      />
    );
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">No rainfall data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6">
      {/* Chart Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
              Type:
            </label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="px-2 sm:px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-xs sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="area">Area</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
              View:
            </label>
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value)}
              className="px-2 sm:px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-xs sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
              Range:
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-2 sm:px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-xs sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>

        <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          {timeRange === 'all' ? 'All data' : `${timeRange} days`}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => {
                  if (aggregation === 'hourly') {
                    return dayjs(value).format('MMM DD HH:mm');
                  } else if (aggregation === 'daily') {
                    return dayjs(value).format('MMM DD');
                  } else if (aggregation === 'weekly') {
                    return dayjs(value).format('MMM DD');
                  } else if (aggregation === 'monthly') {
                    return dayjs(value).format('MMM YYYY');
                  } else if (aggregation === 'yearly') {
                    return dayjs(value).format('YYYY');
                  } else {
                    return dayjs(value).format('MMM DD');
                  }
                }}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={12}
                tickFormatter={(value) => `${value}mm`}
              />
              <Tooltip content={<CustomTooltip />} />
              {compareData ? (
                <>
                  <Bar dataKey="rainfallA" name="Station A" fill="#3b82f6" radius={[2,2,0,0]} />
                  <Bar dataKey="rainfallB" name={compareLabel || 'Station B'} fill="#10b981" radius={[2,2,0,0]} />
                </>
              ) : (
                <Bar
                  dataKey="rainfall"
                  name="Rainfall"
                  shape={<CustomBar />}
                  radius={[2, 2, 0, 0]}
                />
              )}
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => {
                  if (aggregation === 'hourly') {
                    return dayjs(value).format('MMM DD HH:mm');
                  } else if (aggregation === 'daily') {
                    return dayjs(value).format('MMM DD');
                  } else if (aggregation === 'weekly') {
                    return dayjs(value).format('MMM DD');
                  } else if (aggregation === 'monthly') {
                    return dayjs(value).format('MMM YYYY');
                  } else if (aggregation === 'yearly') {
                    return dayjs(value).format('YYYY');
                  } else {
                    return dayjs(value).format('MMM DD');
                  }
                }}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={12}
                tickFormatter={(value) => `${value}mm`}
              />
              <Tooltip content={<CustomTooltip />} />
              {compareData ? (
                <>
                  <Line type="monotone" dataKey="rainfallA" name="Station A" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }} activeDot={{ r: 5, stroke: '#1d4ed8', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="rainfallB" name={compareLabel || 'Station B'} stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }} activeDot={{ r: 5, stroke: '#065f46', strokeWidth: 2 }} />
                </>
              ) : (
                <Line
                  type="monotone"
                  dataKey="rainfall"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#1d4ed8', strokeWidth: 2 }}
                />
              )}
            </LineChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => {
                  if (aggregation === 'hourly') {
                    return dayjs(value).format('MMM DD HH:mm');
                  } else if (aggregation === 'daily') {
                    return dayjs(value).format('MMM DD');
                  } else if (aggregation === 'weekly') {
                    return dayjs(value).format('MMM DD');
                  } else if (aggregation === 'monthly') {
                    return dayjs(value).format('MMM YYYY');
                  } else if (aggregation === 'yearly') {
                    return dayjs(value).format('YYYY');
                  } else {
                    return dayjs(value).format('MMM DD');
                  }
                }}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={12}
                tickFormatter={(value) => `${value}mm`}
              />
              <Tooltip content={<CustomTooltip />} />
              {compareData ? (
                <>
                  <Area type="monotone" dataKey="rainfallA" name="Station A" stroke="#3b82f6" strokeWidth={2} fill="#3b82f6" fillOpacity={0.25} />
                  <Area type="monotone" dataKey="rainfallB" name={compareLabel || 'Station B'} stroke="#10b981" strokeWidth={2} fill="#10b981" fillOpacity={0.25} />
                </>
              ) : (
                <Area
                  type="monotone"
                  dataKey="rainfall"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="#3b82f6"
                  fillOpacity={0.3}
                />
              )}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Station Legend (only in compare mode) */}
      {compareData && (
        <div className="mt-3 flex items-center justify-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
            <span className="text-gray-700 dark:text-gray-300">{primaryLabel || 'Station A'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
            <span className="text-gray-700 dark:text-gray-300">{compareLabel || 'Station B'}</span>
          </div>
        </div>
      )}

      {/* Chart Legend */}
      <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-200 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">No Rain (0mm)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-300 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Light Rain (&lt;2.5mm)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Moderate Rain (2.5-7.5mm)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-700 rounded"></div>
          <span className="text-gray-600 dark:text-gray-400">Heavy Rain (&gt;7.5mm)</span>
        </div>
      </div>
    </div>
  );
};

export default RainfallChart; 