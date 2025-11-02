// geocodingService.ts
import * as Location from 'expo-location';

interface GeocodeResult {
  latitude: number;
  longitude: number;
  address?: string;
  confidence?: number;
}

interface HostelGeocodeResult extends GeocodeResult {
  hostelName: string;
  formattedAddress: string;
}

// Cache to store geocoded locations
const geocodeCache = new Map<string, HostelGeocodeResult>();

/**
 * Smart geocoding for hostel names with campus context
 */
export const geocodeHostelName = async (
  hostelName: string,
  campusName: string = "KNUST",
  city: string = "Kumasi"
): Promise<HostelGeocodeResult | null> => {
  const cacheKey = `${hostelName.toLowerCase()}-${campusName}-${city}`;
  
  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  try {
    console.log(`🔍 Geocoding: ${hostelName}`);
    
    // Strategy 1: Try with full campus context first
    const searchQueries = [
      `${hostelName}, ${campusName}, ${city}, Ghana`,
      `${hostelName}, ${campusName}, ${city}`,
      `${hostelName}, ${campusName}`,
      `${hostelName}, ${city}, Ghana`,
      `${hostelName} Hostel, ${campusName}`,
      `${hostelName} Hall, ${campusName}`,
    ];

    for (const query of searchQueries) {
      try {
        const results = await Location.geocodeAsync(query);
        
        if (results && results.length > 0) {
          const bestResult = findBestGeocodeResult(results, hostelName);
          
          if (bestResult) {
            const result: HostelGeocodeResult = {
              hostelName,
              latitude: bestResult.latitude,
              longitude: bestResult.longitude,
              formattedAddress: bestResult.formattedAddress || query,
              confidence: calculateConfidence(bestResult, hostelName),
            };

            console.log(`✅ Found ${hostelName}:`, {
              lat: result.latitude,
              lng: result.longitude,
              confidence: result.confidence,
            });

            // Cache the result
            geocodeCache.set(cacheKey, result);
            return result;
          }
        }
      } catch (error) {
        console.warn(`Query failed for "${query}":`, error);
        continue;
      }
    }

    console.warn(`❌ No results found for ${hostelName}`);
    return null;

  } catch (error) {
    console.error(`Error geocoding ${hostelName}:`, error);
    return null;
  }
};

/**
 * Find the best geocode result based on relevance
 */
const findBestGeocodeResult = (results: Location.LocationGeocodedLocation[], hostelName: string): Location.LocationGeocodedLocation | null => {
  if (results.length === 0) return null;
  
  // Score each result based on relevance
  const scoredResults = results.map(result => ({
    result,
    score: calculateRelevanceScore(result, hostelName)
  }));

  // Return the highest scored result
  scoredResults.sort((a, b) => b.score - a.score);
  return scoredResults[0].result;
};

/**
 * Calculate relevance score for geocode results
 */
const calculateRelevanceScore = (result: Location.LocationGeocodedLocation, hostelName: string): number => {
  let score = 0;
  const address = result.formattedAddress?.toLowerCase() || '';
  const hostelLower = hostelName.toLowerCase();

  // Boost score if hostel name appears in address
  if (address.includes(hostelLower)) score += 10;
  
  // Boost for campus-related terms
  if (address.includes('knust') || address.includes('campus') || address.includes('university')) {
    score += 5;
  }
  
  // Boost for Kumasi location
  if (address.includes('kumasi')) score += 3;
  
  // Penalize results that are too far from expected campus area
  const campusCenter = { latitude: 6.6752, longitude: -1.5672 };
  const distance = calculateDistance(
    result.latitude,
    result.longitude,
    campusCenter.latitude,
    campusCenter.longitude
  );
  
  if (distance > 10) { // More than 10km from campus
    score -= 20;
  } else if (distance > 5) { // 5-10km from campus
    score -= 10;
  } else if (distance > 2) { // 2-5km from campus
    score -= 5;
  } else { // Within 2km of campus
    score += 5;
  }

  return score;
};

/**
 * Calculate distance between two coordinates in kilometers
 */
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Calculate confidence level for geocode result
 */
const calculateConfidence = (result: Location.LocationGeocodedLocation, hostelName: string): number => {
  let confidence = 50; // Base confidence
  
  const address = result.formattedAddress?.toLowerCase() || '';
  const hostelLower = hostelName.toLowerCase();

  // Increase confidence based on matches
  if (address.includes(hostelLower)) confidence += 30;
  if (address.includes('knust') || address.includes('campus')) confidence += 20;
  if (address.includes('kumasi')) confidence += 10;

  return Math.min(confidence, 100);
};

/**
 * Batch geocode multiple hostels with progress tracking
 */
export const batchGeocodeHostels = async (
  hostels: string[],
  campusName?: string,
  city?: string,
  onProgress?: (progress: number) => void
): Promise<Map<string, HostelGeocodeResult>> => {
  const results = new Map<string, HostelGeocodeResult>();
  const total = hostels.length;

  for (let i = 0; i < hostels.length; i++) {
    const hostel = hostels[i];
    
    try {
      const result = await geocodeHostelName(hostel, campusName, city);
      if (result) {
        results.set(hostel, result);
      }
    } catch (error) {
      console.error(`Failed to geocode ${hostel}:`, error);
    }
    
    // Update progress
    if (onProgress) {
      onProgress(((i + 1) / total) * 100);
    }
    
    // Add delay to avoid rate limiting
    if (i < hostels.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
};

/**
 * Get all cached hostel locations
 */
export const getCachedHostelLocations = (): Map<string, HostelGeocodeResult> => {
  return new Map(geocodeCache);
};

/**
 * Clear geocoding cache
 */
export const clearGeocodeCache = (): void => {
  geocodeCache.clear();
};