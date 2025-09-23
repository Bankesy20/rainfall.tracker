import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import utc from 'dayjs/plugin/utc';

dayjs.extend(weekOfYear);
dayjs.extend(utc);

const parseUtcDateMs = (dateStr) => {
  const ts = Date.parse(`${dateStr}T00:00:00Z`);
  return Number.isFinite(ts) ? ts : 0;
};
const parseUtcDateTimeMs = (dateStr, timeStr) => {
  const time = timeStr || '00:00';
  const ts = Date.parse(`${dateStr}T${time}:00Z`);
  return Number.isFinite(ts) ? ts : 0;
};

/**
 * Process raw rainfall data into a consistent format
 * @param {Array} rawData - Raw data from CSV
 * @returns {Array} Processed data in standard format
 */
export const processRainfallData = (rawData) => {
  if (!Array.isArray(rawData)) {
    return [];
  }

  return rawData.map(item => ({
    date: item.date || '',
    time: item.time || '',
    rainfall_mm: Number.isFinite(Number(item.rainfall_mm)) ? Math.max(0, Number(item.rainfall_mm)) : 0,
    total_mm: Number.isFinite(Number(item.total_mm)) ? Math.max(0, Number(item.total_mm)) : 0
  })).filter(item => item.date && item.date !== '');
};

/**
 * Calculate daily totals from hourly data
 * @param {Array} data - Hourly rainfall data
 * @returns {Array} Daily aggregated data
 */
export const aggregateDailyData = (data) => {
  const dailyMap = new Map();

  data.forEach(item => {
    const date = item.date;
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        total_rainfall: 0,
        readings_count: 0,
        max_hourly: 0,
        min_hourly: Infinity
      });
    }

    const daily = dailyMap.get(date);
    daily.total_rainfall += item.rainfall_mm;
    daily.readings_count += 1;
    daily.max_hourly = Math.max(daily.max_hourly, item.rainfall_mm);
    daily.min_hourly = Math.min(daily.min_hourly, item.rainfall_mm);
  });

  return Array.from(dailyMap.values())
    .map(daily => ({
      ...daily,
      min_hourly: daily.min_hourly === Infinity ? 0 : daily.min_hourly,
      average_hourly: daily.total_rainfall / daily.readings_count
    }))
    .sort((a, b) => parseUtcDateMs(a.date) - parseUtcDateMs(b.date));
};

/**
 * Calculate weekly totals from daily data
 * @param {Array} data - Daily rainfall data
 * @returns {Array} Weekly aggregated data
 */
export const aggregateWeeklyData = (data) => {
  const weeklyMap = new Map();

  data.forEach(item => {
    const date = new Date(item.date);
    const weekStart = dayjs(date).startOf('week').format('YYYY-MM-DD');
    const weekKey = `${weekStart}_${dayjs(date).year()}_${dayjs(date).week()}`;
    
    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, {
        date: weekStart,
        week: dayjs(date).week(),
        year: dayjs(date).year(),
        total_rainfall: 0,
        days_count: 0,
        max_daily: 0,
        min_daily: Infinity
      });
    }

    const weekly = weeklyMap.get(weekKey);
    const rainfallValue = item.total_rainfall || item.rainfall_mm || 0;
    weekly.total_rainfall += rainfallValue;
    weekly.days_count += 1;
    weekly.max_daily = Math.max(weekly.max_daily, rainfallValue);
    weekly.min_daily = Math.min(weekly.min_daily, rainfallValue);
  });

  return Array.from(weeklyMap.values())
    .map(weekly => ({
      ...weekly,
      min_daily: weekly.min_daily === Infinity ? 0 : weekly.min_daily,
      average_daily: weekly.total_rainfall / weekly.days_count
    }))
    .sort((a, b) => parseUtcDateMs(a.date) - parseUtcDateMs(b.date));
};

/**
 * Calculate monthly totals from daily data
 * @param {Array} data - Daily rainfall data
 * @returns {Array} Monthly aggregated data
 */
export const aggregateMonthlyData = (data) => {
  const monthlyMap = new Map();

  data.forEach(item => {
    const date = new Date(item.date);
    const monthKey = `${dayjs(date).year()}-${dayjs(date).month() + 1}`;
    
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, {
        date: dayjs(date).format('YYYY-MM'),
        year: dayjs(date).year(),
        month: dayjs(date).month() + 1,
        total_rainfall: 0,
        days_count: 0,
        max_daily: 0,
        min_daily: Infinity
      });
    }

    const monthly = monthlyMap.get(monthKey);
    monthly.total_rainfall += item.total_rainfall || item.rainfall_mm;
    monthly.days_count += 1;
    monthly.max_daily = Math.max(monthly.max_daily, item.total_rainfall || item.rainfall_mm);
    monthly.min_daily = Math.min(monthly.min_daily, item.total_rainfall || item.rainfall_mm);
  });

  return Array.from(monthlyMap.values())
    .map(monthly => ({
      ...monthly,
      min_daily: monthly.min_daily === Infinity ? 0 : monthly.min_daily,
      average_daily: monthly.total_rainfall / monthly.days_count
    }))
    .sort((a, b) => {
      const aTs = Date.parse(`${a.date}-01T00:00:00Z`);
      const bTs = Date.parse(`${b.date}-01T00:00:00Z`);
      return aTs - bTs;
    });
};

/**
 * Calculate yearly totals from daily data
 * @param {Array} data - Daily rainfall data
 * @returns {Array} Yearly aggregated data
 */
export const aggregateYearlyData = (data) => {
  const yearlyMap = new Map();

  data.forEach(item => {
    const date = new Date(item.date);
    const year = dayjs(date).year();
    
    if (!yearlyMap.has(year)) {
      yearlyMap.set(year, {
        date: year.toString(),
        year: year,
        total_rainfall: 0,
        days_count: 0,
        max_daily: 0,
        min_daily: Infinity
      });
    }

    const yearly = yearlyMap.get(year);
    yearly.total_rainfall += item.total_rainfall || item.rainfall_mm;
    yearly.days_count += 1;
    yearly.max_daily = Math.max(yearly.max_daily, item.total_rainfall || item.rainfall_mm);
    yearly.min_daily = Math.min(yearly.min_daily, item.total_rainfall || item.rainfall_mm);
  });

  return Array.from(yearlyMap.values())
    .map(yearly => ({
      ...yearly,
      min_daily: yearly.min_daily === Infinity ? 0 : yearly.min_daily,
      average_daily: yearly.total_rainfall / yearly.days_count
    }))
    .sort((a, b) => parseInt(a.date) - parseInt(b.date));
};

/**
 * Calculate statistics for a given date range
 * @param {Array} data - Rainfall data
 * @param {number} days - Number of days to analyze
 * @returns {Object} Statistics object
 */
export const calculateStatistics = (data, days = 30) => {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      total_rainfall: 0,
      average_daily: 0,
      max_daily: 0,
      min_daily: 0,
      days_with_rain: 0,
      total_days: 0
    };
  }

  // For demo purposes, if we have sample data from the past, use all available data
  // In production, this would filter by the actual cutoff date
  const cutoffDate = dayjs.utc().subtract(days, 'day');
  let recentData = data.filter(item => dayjs.utc(item.date).isAfter(cutoffDate));
  
  // If no recent data found, use all available data for demo
  if (recentData.length === 0 && data.length > 0) {
    console.log('No recent data found, using all available data for demo');
    recentData = data;
  }

  const dailyData = aggregateDailyData(recentData);
  
  if (dailyData.length === 0) {
    return {
      total_rainfall: 0,
      average_daily: 0,
      max_daily: 0,
      min_daily: 0,
      days_with_rain: 0,
      total_days: 0
    };
  }

  const totalRainfall = dailyData.reduce((sum, day) => sum + day.total_rainfall, 0);
  const daysWithRain = dailyData.filter(day => day.total_rainfall > 0).length;
  const maxDaily = Math.max(...dailyData.map(day => day.total_rainfall));
  const minDaily = Math.min(...dailyData.map(day => day.total_rainfall));

  return {
    total_rainfall: totalRainfall,
    average_daily: totalRainfall / dailyData.length,
    max_daily: maxDaily,
    min_daily: minDaily,
    days_with_rain: daysWithRain,
    total_days: dailyData.length
  };
};

/**
 * Get data for chart display
 * @param {Array} data - Raw rainfall data
 * @param {number} days - Number of days to show
 * @param {string} aggregation - 'hourly', 'daily', 'weekly', 'monthly', or 'yearly'
 * @returns {Array} Formatted data for charts
 */
export const getChartData = (data, days = 30, aggregation = 'daily') => {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  const cutoffDate = dayjs.utc().subtract(days, 'day');
  let recentData = data.filter(item => dayjs.utc(item.date).isAfter(cutoffDate));
  
  // If no recent data found, use all available data for demo
  if (recentData.length === 0 && data.length > 0) {
    console.log('No recent data found, using all available data for demo');
    recentData = data;
  }

  // Sort data chronologically first
  recentData.sort((a, b) => parseUtcDateTimeMs(a.date, a.time) - parseUtcDateTimeMs(b.date, b.time));

  if (aggregation === 'hourly') {
    // Hourly data
    return recentData.map(item => ({
      date: `${item.date} ${item.time}`,
      rainfall: item.rainfall_mm,
      total: item.total_mm
    }));
  } else if (aggregation === 'daily') {
    return aggregateDailyData(recentData).map(day => ({
      date: day.date,
      rainfall: day.total_rainfall,
      max_hourly: day.max_hourly,
      average_hourly: day.average_hourly
    }));
  } else if (aggregation === 'weekly') {
    const dailyData = aggregateDailyData(recentData);
    return aggregateWeeklyData(dailyData).map(week => ({
      date: week.date,
      rainfall: week.total_rainfall,
      max_daily: week.max_daily,
      average_daily: week.average_daily
    }));
  } else if (aggregation === 'monthly') {
    const dailyData = aggregateDailyData(recentData);
    return aggregateMonthlyData(dailyData).map(month => ({
      date: month.date,
      rainfall: month.total_rainfall,
      max_daily: month.max_daily,
      average_daily: month.average_daily
    }));
  } else if (aggregation === 'yearly') {
    const dailyData = aggregateDailyData(recentData);
    return aggregateYearlyData(dailyData).map(year => ({
      date: year.date,
      rainfall: year.total_rainfall,
      max_daily: year.max_daily,
      average_daily: year.average_daily
    }));
  } else {
    // Default to daily
    return aggregateDailyData(recentData).map(day => ({
      date: day.date,
      rainfall: day.total_rainfall,
      max_hourly: day.max_hourly,
      average_hourly: day.average_hourly
    }));
  }
};

/**
 * Format rainfall value for display
 * @param {number} value - Rainfall value in mm
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted value
 */
export const formatRainfall = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.0';
  }
  return parseFloat(value).toFixed(decimals);
};

/**
 * Get color for rainfall intensity
 * @param {number} rainfall - Rainfall value in mm
 * @returns {string} CSS color
 */
export const getRainfallColor = (rainfall) => {
  if (rainfall === 0) return '#e5e7eb'; // Light gray for no rain
  if (rainfall < 2.5) return '#60a5fa'; // Light blue for light rain
  if (rainfall < 7.5) return '#3b82f6'; // Blue for moderate rain
  if (rainfall < 15) return '#1d4ed8'; // Dark blue for heavy rain
  return '#1e40af'; // Very dark blue for very heavy rain
};

/**
 * Validate rainfall data
 * @param {Object} data - Data object to validate
 * @returns {boolean} True if valid
 */
export const validateRainfallData = (data) => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const requiredFields = ['lastUpdated', 'station', 'data'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      return false;
    }
  }

  if (!Array.isArray(data.data)) {
    return false;
  }

  return true;
};

/**
 * Get latest reading from data
 * @param {Array} data - Rainfall data array
 * @returns {Object|null} Latest reading or null
 */
export const getLatestReading = (data) => {
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  // Sort by date and time, get the latest
  const sorted = [...data].sort((a, b) => parseUtcDateTimeMs(b.date, b.time) - parseUtcDateTimeMs(a.date, a.time));

  return sorted[0];
};

/**
 * Check if data is stale (older than 24 hours)
 * @param {string} lastUpdated - ISO timestamp
 * @returns {boolean} True if data is stale
 */
export const isDataStale = (lastUpdated) => {
  if (!lastUpdated) return true;
  
  const lastUpdate = dayjs(lastUpdated);
  const now = dayjs();
  const hoursSinceUpdate = now.diff(lastUpdate, 'hour');
  
  return hoursSinceUpdate > 24;
}; 