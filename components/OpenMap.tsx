// MapScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  Dimensions, 
  Text, 
  TouchableOpacity, 
  StatusBar,
  ActivityIndicator,
  Alert
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { batchGeocodeHostels, geocodeHostelName, getCachedHostelLocations } from '../app/data/geocodingService';

const { width, height } = Dimensions.get('window');

interface Order {
  id: string;
  customerName: string;
  phone: string;
  hostel: string;
  size: string;
  price: string;
  status: string;
}

interface HostelLocation {
  hostelName: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  confidence?: number;
  orders: Order[];
}

interface MapScreenProps {
  orders?: Order[];
  selectedHostel?: string | null;
  campusName?: string;
  city?: string;
  onHostelPress?: (hostel: HostelLocation) => void;
}

const MapScreen: React.FC<MapScreenProps> = ({ 
  orders = [], 
  selectedHostel = null,
  campusName = "KNUST",
  city = "Kumasi",
  onHostelPress
}) => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'terrain' | 'hybrid'>('standard');
  const [region, setRegion] = useState<Region>({
    latitude: 6.6752,
    longitude: -1.5672,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [loading, setLoading] = useState(true);
  const [hostelLocations, setHostelLocations] = useState<HostelLocation[]>([]);
  const [geocodingProgress, setGeocodingProgress] = useState(0);
  const [geocodingStatus, setGeocodingStatus] = useState('Preparing...');
  
  const mapRef = useRef<MapView>(null);

  /**
   * FIND HOSTELS FROM TABLE DATA AND GEOCODE THEM
   */
  const findAndGeocodeHostels = useCallback(async (orders: Order[]) => {
    if (orders.length === 0) {
      setHostelLocations([]);
      setLoading(false);
      return;
    }

    try {
      setGeocodingStatus('Finding unique hostels...');
      
      // Get unique hostel names from orders
      const uniqueHostels = Array.from(new Set(orders.map(order => order.hostel)));
      console.log(`📊 Found ${uniqueHostels.length} unique hostels:`, uniqueHostels);

      setGeocodingStatus('Geocoding hostel locations...');
      
      // Geocode all hostels
      const geocodedHostels = await batchGeocodeHostels(
        uniqueHostels,
        campusName,
        city,
        (progress) => {
          setGeocodingProgress(progress);
          setGeocodingStatus(`Geocoding... ${Math.round(progress)}%`);
        }
      );

      console.log(`✅ Geocoded ${geocodedHostels.size} hostels`);

      // Create hostel locations with orders
      const locations: HostelLocation[] = [];
      
      geocodedHostels.forEach((geocodeResult, hostelName) => {
        const hostelOrders = orders.filter(order => order.hostel === hostelName);
        
        locations.push({
          hostelName,
          latitude: geocodeResult.latitude,
          longitude: geocodeResult.longitude,
          formattedAddress: geocodeResult.formattedAddress,
          confidence: geocodeResult.confidence,
          orders: hostelOrders,
        });
      });

      setHostelLocations(locations);
      
      // Log results
      locations.forEach(hostel => {
        console.log(`📍 ${hostel.hostelName}:`, {
          orders: hostel.orders.length,
          confidence: hostel.confidence,
          address: hostel.formattedAddress
        });
      });

    } catch (error) {
      console.error('Error in findAndGeocodeHostels:', error);
      Alert.alert('Geocoding Error', 'Failed to find hostel locations. Please check your internet connection.');
    } finally {
      setLoading(false);
      setGeocodingStatus('Complete');
    }
  }, [campusName, city]);

  /**
   * GET USER LOCATION
   */
  const getUserLocation = useCallback(async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      setLocation(location);
      
      // Center map on user location if we have hostels, otherwise use campus center
      if (hostelLocations.length === 0) {
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setErrorMsg('Failed to get current location');
    }
  }, [hostelLocations.length]);

  // Initialize
  useEffect(() => {
    const initialize = async () => {
      await getUserLocation();
      await findAndGeocodeHostels(orders);
    };

    initialize();
  }, [getUserLocation, findAndGeocodeHostels, orders]);

  // Focus on selected hostel
  useEffect(() => {
    if (selectedHostel) {
      const hostel = hostelLocations.find(h => h.hostelName === selectedHostel);
      if (hostel) {
        mapRef.current?.animateToRegion({
          latitude: hostel.latitude,
          longitude: hostel.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 1000);
      }
    }
  }, [selectedHostel, hostelLocations]);

  const goToMyLocation = useCallback(async () => {
    if (location) {
      mapRef.current?.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    } else {
      await getUserLocation();
    }
  }, [location, getUserLocation]);

  const changeMapType = useCallback(() => {
    const types: Array<'standard' | 'satellite' | 'terrain' | 'hybrid'> = [
      'standard', 'satellite', 'terrain', 'hybrid'
    ];
    const currentIndex = types.indexOf(mapType);
    const nextIndex = (currentIndex + 1) % types.length;
    setMapType(types[nextIndex]);
  }, [mapType]);

  const handleHostelPress = useCallback((hostel: HostelLocation) => {
    if (onHostelPress) {
      onHostelPress(hostel);
    }
  }, [onHostelPress]);

  const getMarkerColor = (confidence?: number) => {
    if (!confidence) return '#FF9933'; // Default orange
    
    if (confidence >= 80) return '#4CAF50'; // High confidence - green
    if (confidence >= 60) return '#FF9800'; // Medium confidence - orange
    return '#F44336'; // Low confidence - red
  };

  const getMarkerIcon = (ordersCount: number) => {
    if (ordersCount === 1) return '🏠';
    if (ordersCount <= 3) return '🏢';
    return '🏫';
  };

  const renderHostelMarkers = () => {
    return hostelLocations.map((hostel) => (
      <Marker
        key={hostel.hostelName}
        coordinate={{
          latitude: hostel.latitude,
          longitude: hostel.longitude,
        }}
        title={hostel.hostelName}
        description={`${hostel.orders.length} order(s)`}
        onPress={() => handleHostelPress(hostel)}
        pinColor={getMarkerColor(hostel.confidence)}
      >
        <Callout tooltip>
          <View style={styles.calloutContainer}>
            <Text style={styles.calloutTitle}>
              {getMarkerIcon(hostel.orders.length)} {hostel.hostelName}
            </Text>
            <Text style={styles.calloutSubtitle}>
              {hostel.orders.length} order{hostel.orders.length !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.calloutAddress}>
              {hostel.formattedAddress}
            </Text>
            {hostel.confidence && (
              <Text style={[
                styles.confidenceText,
                { color: getMarkerColor(hostel.confidence) }
              ]}>
                Location confidence: {hostel.confidence}%
              </Text>
            )}
            <View style={styles.ordersPreview}>
              {hostel.orders.slice(0, 2).map((order) => (
                <Text key={order.id} style={styles.orderPreview}>
                  • {order.customerName} - {order.size}
                </Text>
              ))}
              {hostel.orders.length > 2 && (
                <Text style={styles.moreOrders}>
                  +{hostel.orders.length - 2} more orders
                </Text>
              )}
            </View>
          </View>
        </Callout>
      </Marker>
    ));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>{geocodingStatus}</Text>
        <Text style={styles.progressText}>
          {Math.round(geocodingProgress)}% complete
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        showsCompass={true}
        zoomEnabled={true}
        scrollEnabled={true}
        showsMyLocationButton={false}
      >
        {renderHostelMarkers()}
      </MapView>

      {/* Custom Location Button */}
      <TouchableOpacity 
        style={styles.customLocationButton}
        onPress={goToMyLocation}
      >
        <Icon name="my-location" size={24} color="#007AFF" />
      </TouchableOpacity>

      {/* Map Type Toggle Button */}
      <TouchableOpacity 
        style={styles.mapTypeButton}
        onPress={changeMapType}
      >
        <Icon name="layers" size={24} color="#007AFF" />
      </TouchableOpacity>

      {/* Status Info */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          📍 {hostelLocations.length} hostels mapped
        </Text>
        {errorMsg && (
          <Text style={styles.errorText}>{errorMsg}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  map: {
    width: width,
    height: height,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  customLocationButton: {
    position: 'absolute',
    top: 70,
    right: 20,
    backgroundColor: 'white',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mapTypeButton: {
    position: 'absolute',
    top: 130,
    right: 20,
    backgroundColor: 'white',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    textAlign: 'center',
    marginTop: 4,
  },
  calloutContainer: {
    width: 250,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  calloutSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  calloutAddress: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  ordersPreview: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 6,
  },
  orderPreview: {
    fontSize: 12,
    color: '#555',
    marginBottom: 2,
  },
  moreOrders: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 2,
  },
});

export default MapScreen;