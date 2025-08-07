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

const RainfallChart = ({ data, days = 30, height = 400 }) => {
  const [chartType, setChartType] = useState('bar');
  const [aggregation, setAggregation] = useState('daily');
  const [timeRange, setTimeRange] = useState('30');

  const chartData = useMemo(() => {
    const rangeDays = timeRange === 'all' ? 365 * 10 : parseInt(timeRange); // 10 years for all-time
    return getChartData(data, rangeDays, aggregation);
  }, [data, timeRange, aggregation]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
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
          <p className="text-blue-600 dark:text-blue-400">
            Rainfall: {formatRainfall(data.rainfall)} mm
          </p>
          {aggregation === 'daily' && data.max_hourly !== undefined && (
            <p className="text-gray-600 dark:text-gray-400">
              Max hourly: {formatRainfall(data.max_hourly)} mm
            </p>
          )}
          {(aggregation === 'weekly' || aggregation === 'monthly' || aggregation === 'yearly') && data.max_daily !== undefined && (
            <p className="text-gray-600 dark:text-gray-400">
              Max daily: {formatRainfall(data.max_daily)} mm
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
          <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">🌧️</div>
          <p className="text-gray-500 dark:text-gray-400">No rainfall data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* Chart Controls */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Chart Type:
            </label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
              <option value="area">Area Chart</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Aggregation:
            </label>
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Time Range:
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {timeRange === 'all' ? 'all available data' : `last ${timeRange} days`}
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
              <Bar
                dataKey="rainfall"
                name="Rainfall"
                shape={<CustomBar />}
                radius={[2, 2, 0, 0]}
              />
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
              <Line
                type="monotone"
                dataKey="rainfall"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#1d4ed8', strokeWidth: 2 }}
              />
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
              <Area
                type="monotone"
                dataKey="rainfall"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="#3b82f6"
                fillOpacity={0.3}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

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