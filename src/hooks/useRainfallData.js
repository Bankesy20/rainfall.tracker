import { useState, useEffect, useCallback, useRef } from 'react';
import { validateRainfallData } from '../utils/dataProcessor';
import stations from '../utils/stations';

const useRainfallData = (stationKey = 'miserden1141', availableStations = null) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refetchCount, setRefetchCount] = useState(0);
  
  const intervalRef = useRef(null);
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Use dynamic stations if available, otherwise fallback to static
  const stationsToUse = availableStations || stations;

  // Determine the API endpoint
  const getApiEndpoint = () => {
    const station = stationsToUse[stationKey];
    if (!station) return null;
    if (isDevelopment) {
      // In development, use the deployed Netlify function to test blob access
      return 'https://rainfalltracker.netlify.app/.netlify/functions/rainfall-data';
    }
    // In production, use the deployed function
    return station.apiPath || '/.netlify/functions/rainfall-data';
  };

  // Fallback to static file loading
  const loadStaticData = async () => {
    const station = stationsToUse[stationKey];
    if (!station) {
      // No station selected; return null to indicate no data
      return null;
    }
    try {
      const response = await fetch(station?.staticPath || '/data/processed/rainfall-history.json');
      if (!response.ok) {
        throw new Error(`Failed to load static data: ${response.status}`);
      }
      const staticData = await response.json();
      
      if (!validateRainfallData(staticData)) {
        throw new Error('Invalid static data format');
      }
      
      return staticData;
    } catch (err) {
      console.error('Static data fallback failed:', err);
      throw err;
    }
  };

  // Fetch data from API
  const fetchData = useCallback(async (isRetry = false) => {
    try {
      setLoading(true);
      setError(null);

      // If station unknown, clear data and exit early
      if (!stationsToUse[stationKey]) {
        setData(null);
        setLastUpdated(new Date().toISOString());
        setRefetchCount(prev => prev + 1);
        return;
      }

      const endpoint = getApiEndpoint();
      
      // If no endpoint (development mode), use static fallback
      if (!endpoint) {
        console.log('Development mode: Using static data fallback');
        const staticData = await loadStaticData();
        setData(staticData);
        setLastUpdated(new Date().toISOString());
        setRefetchCount(prev => prev + 1);
        return;
      }

      // Handle both absolute and relative URLs
      let fetchUrl;
      if (endpoint.startsWith('http')) {
        // Absolute URL - use URL constructor
        const url = new URL(endpoint);
        url.searchParams.set('station', stationKey);
        fetchUrl = url.toString();
      } else {
        // Relative URL - build manually
        const separator = endpoint.includes('?') ? '&' : '?';
        fetchUrl = `${endpoint}${separator}station=${encodeURIComponent(stationKey)}`;
      }
      
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📡 API response for station:', stationKey, {
        hasData: !!result.data,
        hasSuccess: !!result.success,
        stationInData: result.data?.station,
        dataLength: result.data?.data?.length,
        source: result.source
      });
      
      // Check if the API returned an error
      if (result.error) {
        throw new Error(result.error);
      }

      // Extract the actual rainfall data from the API response
      const rainfallData = result.data || result;
      console.log('📊 Extracted data for station:', stationKey, {
        station: rainfallData.station,
        dataLength: rainfallData.data?.length,
        firstRecord: rainfallData.data?.[0],
        lastRecord: rainfallData.data?.[rainfallData.data?.length - 1]
      });
      
      if (!validateRainfallData(rainfallData)) {
        console.error('❌ Data validation failed for station:', stationKey);
        throw new Error('Invalid data format from API');
      }

      console.log('✅ Setting data for station:', stationKey, 'with', rainfallData.data?.length, 'records');
      setData(rainfallData);
      setLastUpdated(new Date().toISOString());
      setRefetchCount(prev => prev + 1);

    } catch (err) {
      console.error('API fetch failed:', err);
      
      // If this is a retry or we're in development, try static fallback
      if (isRetry || isDevelopment) {
        try {
          console.log('Attempting static data fallback...');
          const staticData = await loadStaticData();
          setData(staticData);
          setLastUpdated(new Date().toISOString());
          setRefetchCount(prev => prev + 1);
          return;
        } catch (staticErr) {
          console.error('Static fallback also failed:', staticErr);
        }
      }
      
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isDevelopment, stationKey, stationsToUse]);

  // Manual refresh function
  const refetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Set up auto-refresh interval
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up new interval for auto-refresh (every 5 minutes)
    intervalRef.current = setInterval(() => {
      console.log('Auto-refreshing rainfall data...');
      fetchData();
    }, 5 * 60 * 1000); // 5 minutes

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch,
    refetchCount,
    isDevelopment
  };
};

export default useRainfallData; 