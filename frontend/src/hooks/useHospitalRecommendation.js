import { useState, useEffect, useMemo, useCallback } from 'react';
import { useHealth } from '../store/HealthContext';
import { getNearbyHospitals } from '../services/api';

// Fallback to Bhopal if location denied
const FALLBACK_LOCATION = { lat: 23.2599, lng: 77.4126 };

export const useHospitalRecommendation = () => {
  const { 
    selectedSymptoms, 
    setSelectedSymptoms, 
    triageResult, 
    runTriage,
    hospitals,
    setHospitals,
    userLocation,
    setUserLocation
  } = useHealth();

  const [isLoading, setIsLoading] = useState(!hospitals.length);
  const [error, setError] = useState(null);

  const fetchHospitals = useCallback(async (lat, lng) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getNearbyHospitals(lat, lng);
      if (result && result.data) {
        setHospitals(result.data);
        console.log("Hospital Results:", result.data);
      } else {
        setHospitals([]);
      }
    } catch (err) {
      console.error('Failed to fetch hospitals:', err);
      setError('Failed to load nearby hospitals.');
      setHospitals([]);
    } finally {
      setIsLoading(false);
    }
  }, [setHospitals]);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by your browser. Using fallback.');
      if (!userLocation) {
        setUserLocation(FALLBACK_LOCATION);
        fetchHospitals(FALLBACK_LOCATION.lat, FALLBACK_LOCATION.lng);
      }
      return;
    }

    const handlePosition = (position) => {
      const { latitude, longitude } = position.coords;
      console.log("User Location:", { lat: latitude, lng: longitude });
      
      setUserLocation(prev => {
        // Update only if distance changed significantly to avoid spamming the API
        if (!prev || Math.abs(prev.lat - latitude) > 0.0005 || Math.abs(prev.lng - longitude) > 0.0005) {
          fetchHospitals(latitude, longitude);
          return { lat: latitude, lng: longitude };
        }
        return prev;
      });
    };

    const handleError = (geoError) => {
      console.warn('Geolocation denied or failed. Using fallback location.', geoError);
      setUserLocation(prev => {
        if (!prev) {
          fetchHospitals(FALLBACK_LOCATION.lat, FALLBACK_LOCATION.lng);
          return FALLBACK_LOCATION;
        }
        return prev;
      });
    };

    // Initial fetch if location not already resolved
    if (!userLocation) {
      navigator.geolocation.getCurrentPosition(handlePosition, handleError, { enableHighAccuracy: true, timeout: 10000 });
    }

    // Watch for location changes
    const watchId = navigator.geolocation.watchPosition(handlePosition, handleError, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [fetchHospitals, userLocation, setUserLocation]);

  const recommendedHospitals = useMemo(() => {
    if (hospitals.length === 0) return [];
    if (selectedSymptoms.length === 0) return hospitals; 

    // Filter by category if available
    if (triageResult && triageResult.category) {
      const filtered = hospitals.filter(h => h.type.toLowerCase() === triageResult.category.toLowerCase());
      if (filtered.length > 0) return filtered;
    }

    return hospitals;
  }, [selectedSymptoms, triageResult, hospitals]);

  return {
    selectedSymptoms,
    setSelectedSymptoms,
    recommendedHospitals,
    triageResult,
    runTriage,
    isLoading,
    error,
    userLocation: userLocation || FALLBACK_LOCATION
  };
};
