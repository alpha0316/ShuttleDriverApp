import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, StatusBar } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Icon from 'react-native-vector-icons/MaterialIcons'; // or any icon library


const { width, height } = Dimensions.get('window');


  const MapScreen = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'terrain' | 'hybrid'>('standard');
  const [region, setRegion] = useState({
      latitude: location?.coords?.latitude ? location.coords.latitude - 0.005 : 0,
      longitude: location?.coords?.longitude ?? 0,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
  });
  const mapRef = React.useRef<MapView>(null);

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
        latitude: location.coords.latitude ,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    })();
  }, []);

  const changeMapType = () => {
    const types: Array<'standard' | 'satellite' | 'terrain' | 'hybrid'> = ['standard', 'satellite', 'terrain', 'hybrid'];
    const currentIndex = types.indexOf(mapType);
    const nextIndex = (currentIndex + 1) % types.length;
    setMapType(types[nextIndex]);
  };

  const goToMyLocation = async () => {
  if (location) {
    // You'll need a ref to your MapView
    mapRef.current?.animateToRegion({
      latitude: location.coords.latitude  - 0.005,
      longitude: location.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  }
};

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        // showsMyLocationButton={true}
        showsCompass={true}
        zoomEnabled={true}
        scrollEnabled={true}

      >
      
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="Your Location"
            description="You are here"
          />
        )}
      </MapView>

      <TouchableOpacity 
        style={styles.customLocationButton}
        onPress={goToMyLocation}
        >
        <Icon name="my-location" size={24} color="#007AFF" />
    </TouchableOpacity>

    </View>
  );
}

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
  controls: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    top: 10,
  },
  buttonText: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 10,
  },
  infoText: {
    color: '#2c3e50',
    fontSize: 12,
  },
  customLocationButton: {
  position: 'absolute',
  top: 70, // Position it exactly where you want
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
});