import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, StatusBar, Image } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Svg, { Path } from "react-native-svg";
import { locations } from './../app/data/locations';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Custom marker component
const CustomMarker = ({ locationName, waitingCount, isCurrentLocation = false }: { locationName: string, waitingCount: number, isCurrentLocation?: boolean }) => (
  <View
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8
    }}
  >
    <View style={{
      width: 50,
      height: 50,
      borderRadius: 100,
      backgroundColor: isCurrentLocation ? 'rgba(52, 168, 83, 0.10)' : 'rgba(234, 67, 53, 0.10)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <View style={{
        width: 16,
        height: 16,
        borderRadius: 24,
        backgroundColor: isCurrentLocation ? '#34A853' : '#EA4335',
      }} />
    </View>

    <View style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      padding: 4,
      backgroundColor: '#fafafa',
      borderRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    }}>
      <Svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <Path 
          fillRule="evenodd" 
          clipRule="evenodd" 
          d="M13.6533 5.01266C14.4627 3.31266 12.688 1.53732 10.9873 2.34665L3.21466 6.04799C1.62133 6.80665 1.71999 9.10732 3.37266 9.72665L5.19866 10.4113C5.28773 10.4447 5.36861 10.4968 5.43588 10.5641C5.50315 10.6314 5.55524 10.7123 5.58866 10.8013L6.27333 12.628C6.89333 14.28 9.19333 14.3787 9.95199 12.7853L13.6533 5.01266Z" 
          fill="#34A853" 
        />
      </Svg>

      <View style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexDirection: 'row',
      }}>
        <Text style={{
          fontSize: 12,
          color: 'rgba(0,0,0,0.6)',
          fontWeight: '500',
        }}>
          {waitingCount}+ waiting
        </Text>
      </View>
    </View>

    <Text style={{
      fontSize: 12,
      color: '#00000080',
      fontWeight: '600',
      backgroundColor: 'white',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    }}>
      {locationName}
    </Text>
  </View>
);

const MapScreen = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'terrain' | 'hybrid'>('standard');
  const [region, setRegion] = useState({
    latitude: 6.6745,
    longitude: -1.5705,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const mapRef = React.useRef<MapView>(null);

  const BASE_CUSTOMER_URL = "https://shuttle-backend-0.onrender.com/api/v1";
  const [busRoute, setBusRoute] = useState<string[]>([]);
  const [driverID, setDriverID] = useState<string>("");
  const [busID, setBusID] = useState<string>("");
  const [filteredLocations, setFilteredLocations] = useState<any[]>([]);
  const [waitingCounts, setWaitingCounts] = useState<{ [key: string]: number }>({});

  // Get user data from AsyncStorage first
  useEffect(() => {
    const retrieveUserData = async () => {
      try {
        const userDataString = await AsyncStorage.getItem("userData");
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          console.log("Retrieved User Data:", userData);

          if (userData.driver?.id) {
            setDriverID(userData.driver.id);
            setBusID(userData.driver.id); // Use driver ID as bus ID for matching
            console.log("Set driverID:", userData.driver.id);
          }
        } else {
          console.log("No user data found in AsyncStorage.");
        }
      } catch (error) {
        console.error("Error retrieving user data:", error);
      }
    };

    retrieveUserData();
  }, []);

  // Filter locations based on bus route
  useEffect(() => {
    if (busRoute.length > 0) {
      const matchedLocations = locations.filter(loc => {
        const normalizedLocName = loc.name.toLowerCase().trim();
        return busRoute.some(routeName => 
          routeName.toLowerCase().trim() === normalizedLocName
        );
      });
      setFilteredLocations(matchedLocations);
      console.log("Matched locations on map:", matchedLocations.map(loc => loc.name));
    } else {
      setFilteredLocations([]);
    }
  }, [busRoute]);

  // Fetch drivers data when busID is available
  useEffect(() => {
    if (!busID) return; // Don't fetch until we have the busID from AsyncStorage

    const fetchDrivers = async () => {
      try {
        console.log(
          "Attempting to fetch drivers with driver ID:",
          busID
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${BASE_CUSTOMER_URL}/drivers/drivers`, {
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("All drivers:", data.drivers);
        console.log("Looking for driver with ID:", busID);

        // Find the driver that matches our driverID from AsyncStorage
        const matchingDriver = data.drivers.find((driver: any) => driver.driverID === busID);
        console.log("Matching Driver Found:", matchingDriver);

        if (!matchingDriver) {
          console.warn("No matching driver found with ID:", busID);
          setBusRoute([]);
          return;
        }

        if (matchingDriver.busRoute && matchingDriver.busRoute.length > 0) {
          const stops = matchingDriver.busRoute[0].stops;
          setBusRoute(stops);
          console.log("Bus routes set:", stops);
        } else {
          console.log("No bus routes found for driver");
          setBusRoute([]);
        }

      } catch (err: any) {
        if (err.name === "AbortError") {
          console.error("Request timed out after 10 seconds");
        } else if (err.message?.includes("Network request failed")) {
          console.error(
            "Network error - check internet connection and server status"
          );
        } else {
          console.error("Error fetching drivers:", err.message || err);
        }
      }
    };
    
    fetchDrivers();
  }, [busID]); // This will run when busID is set from AsyncStorage

  // Simulate waiting students count for filtered locations
  useEffect(() => {
    const counts: { [key: string]: number } = {};
    filteredLocations.forEach(loc => {
      counts[loc.id] = Math.floor(Math.random() * 20) + 5;
    });
    setWaitingCounts(counts);
  }, [filteredLocations]);

  // Location permissions and initial location
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    })();
  }, []);

  const goToMyLocation = async () => {
    if (location) {
      mapRef.current?.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  // Fit map to show all markers including user location and bus stops
  const fitToMarkers = () => {
    if (mapRef.current && (filteredLocations.length > 0 || location)) {
      const coordinates = [];
      
      // Add user location
      if (location) {
        coordinates.push({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
      
      // Add all filtered locations
      filteredLocations.forEach(loc => {
        coordinates.push({
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
      });

      if (coordinates.length > 0) {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }
  };

  // Auto-fit markers when filtered locations change
  useEffect(() => {
    if (filteredLocations.length > 0) {
      setTimeout(fitToMarkers, 1000);
    }
  }, [filteredLocations]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        showsCompass={true}
        zoomEnabled={true}
        scrollEnabled={true}
      >
        {/* User's current location marker */}
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="Your Location"
            description="You are here"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <CustomMarker 
              locationName="Your Location" 
              waitingCount={0}
              isCurrentLocation={true}
            />
          </Marker>
        )}

        {/* Filtered location markers from bus route */}
        {filteredLocations.map((loc) => (
          <Marker
            key={loc.id}
            coordinate={{
              latitude: loc.latitude,
              longitude: loc.longitude,
            }}
            title={loc.name}
            description={loc.description}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <CustomMarker 
              locationName={loc.name} 
              waitingCount={waitingCounts[loc.id] || 0}
            />
          </Marker>
        ))}
      </MapView>

      {/* My Location Button */}
      <TouchableOpacity
        style={styles.customLocationButton}
        onPress={goToMyLocation}
      >
        <Icon name="my-location" size={24} color="#007AFF" />
      </TouchableOpacity>

      {/* Fit to Markers Button */}
      {filteredLocations.length > 0 && (
        <TouchableOpacity
          style={[styles.customLocationButton, { top: 130 }]}
          onPress={fitToMarkers}
        >
          <Icon name="zoom-out-map" size={24} color="#007AFF" />
        </TouchableOpacity>
      )}

    

      {/* Error message */}
      {errorMsg && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}
    </View>
  );
};

export default MapScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  map: {
    width: width,
    height: height,
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
  errorContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#ff4444',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  errorText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  infoPanel: {
    position: 'absolute',
    top: 70,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoPanelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  infoPanelSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  driverIdText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
});