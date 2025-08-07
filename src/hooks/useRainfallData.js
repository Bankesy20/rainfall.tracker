import { useState, useEffect, useCallback, useRef } from 'react';
import { validateRainfallData } from '../utils/dataProcessor';

const useRainfallData = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refetchCount, setRefetchCount] = useState(0);
  
  const intervalRef = useRef(null);
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Determine the API endpoint
  const getApiEndpoint = () => {
    if (isDevelopment) {
      // In development, use static file fallback to avoid WebSocket issues
      // The API will be available in production
      return null; // This will trigger the static fallback
    }
    // In production, use the deployed function
    return '/.netlify/functions/rainfall-data';
  };

  // Fallback to static file loading
  const loadStaticData = async () => {
    try {
      const response = await fetch('/data/processed/rainfall-history.json');
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

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      // Check if the API returned an error
      if (result.error) {
        throw new Error(result.error);
      }

      // Extract the actual rainfall data from the API response
      const rainfallData = result.data || result;
      
      if (!validateRainfallData(rainfallData)) {
        throw new Error('Invalid data format from API');
      }

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
  }, [isDevelopment]);

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