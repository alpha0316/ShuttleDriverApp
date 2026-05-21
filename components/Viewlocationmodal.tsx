/**
 * ViewLocationModal.tsx
 *
 * Bottom-sheet map modal shown when a driver taps "View Direction".
 * - MapView fills the upper portion of the sheet
 * - Markers: rider's current GPS location + customer delivery location
 * - Polyline drawn between the two points (straight-line proxy; swap for
 *   a Directions API call to get road-following route)
 * - Bottom bar: pin icon · distance · location name · full address
 *
 * Dependencies:
 *   npm install react-native-maps expo-location
 *   (or: @react-native-community/geolocation if not using Expo)
 */

import type { OrderData } from '@/components/DriverOrderCard';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import Svg, { Path } from 'react-native-svg';

/* ─── Types ──────────────────────────────────────────────── */
interface Coords {
  latitude: number;
  longitude: number;
}

interface ViewLocationModalProps {
  visible: boolean;
  order: OrderData | null;
  onClose: () => void;
}

/* ─── Helpers ────────────────────────────────────────────── */

/** Haversine distance between two GPS coords, returns metres */
const haversineMetres = (a: Coords, b: Coords): number => {
  const R = 6_371_000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
    Math.cos(toRad(b.latitude)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
};

/** "167m" or "1.3 km" */
const formatDistance = (metres: number): string => {
  if (metres < 1000) return `${Math.round(metres)}m`;
  return `${(metres / 1000).toFixed(1)} km`;
};

/** Compute a region that fits both markers with 25% padding */
const fitRegion = (a: Coords, b: Coords): Region => {
  const minLat = Math.min(a.latitude, b.latitude);
  const maxLat = Math.max(a.latitude, b.latitude);
  const minLng = Math.min(a.longitude, b.longitude);
  const maxLng = Math.max(a.longitude, b.longitude);
  const latDelta = Math.max((maxLat - minLat) * 1.5, 0.01);
  const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.01);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
};

/* ─── Marker styles ──────────────────────────────────────── */
const customerPinStyle = {
  width: 16,
  height: 16,
  borderRadius: 8,
  backgroundColor: '#34A853',
  borderWidth: 2,
  borderColor: '#FFFFFF',
  opacity: 0.8,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 4,
};

const riderPinOuter = {
  width: 26,
  height: 26,
  borderRadius: 13,
  backgroundColor: 'rgba(30,136,229,0.25)',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const riderPinInner = {
  width: 14,
  height: 14,
  borderRadius: 7,
  backgroundColor: '#1E88E5',
  borderWidth: 3,
  borderColor: '#FFFFFF',
};

/* ─── Main Component ─────────────────────────────────────── */
const ViewLocationModal: React.FC<ViewLocationModalProps> = ({
  visible,
  order,
  onClose,
}) => {
  const mapRef = useRef<MapView>(null);
  const [riderCoords, setRiderCoords]   = useState<Coords | null>(null);
  const [routeCoords, setRouteCoords]   = useState<Coords[]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  /* Derived values */
  const customerCoords: Coords | null = order?.location
    ? { latitude: order.location.latitude, longitude: order.location.longitude }
    : null;

  /* Fetch rider's current GPS position when modal opens */
  useEffect(() => {
    if (!visible) return;

    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      setLocationError('');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied.');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setRiderCoords({
        latitude:  pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    })();

    return () => { subscription?.remove(); };
  }, [visible]);

  /* Fetch driving route from OSRM when both coords are known */
  useEffect(() => {
    if (!riderCoords || !customerCoords) {
      setRouteCoords([]);
      setRouteDistance(null);
      return;
    }

    const fetchRoute = async () => {
      setRouteLoading(true);
      try {
        const { longitude: lng1, latitude: lat1 } = riderCoords;
        const { longitude: lng2, latitude: lat2 } = customerCoords;
        const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?geometries=geojson&overview=full`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.code === 'Ok' && data.routes?.length > 0) {
          const route = data.routes[0];
          const coords: Coords[] = route.geometry.coordinates.map(
            ([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng })
          );
          setRouteCoords(coords);
          setRouteDistance(route.distance);
        }
      } catch {
        setRouteCoords([]);
        setRouteDistance(null);
      } finally {
        setRouteLoading(false);
      }
    };

    fetchRoute();
  }, [riderCoords, customerCoords]);

  /* Once both coords are known, animate map to fit both markers */
  useEffect(() => {
    if (!riderCoords || !order?.location || !mapRef.current) return;
    const customer: Coords = {
      latitude:  order.location.latitude,
      longitude: order.location.longitude,
    };
    const region = fitRegion(riderCoords, customer);
    mapRef.current.animateToRegion(region, 600);
  }, [riderCoords, order]);

  /* Derived values */
  const distance =
    riderCoords && customerCoords
      ? formatDistance(routeDistance ?? haversineMetres(riderCoords, customerCoords))
      : null;

  const locationName = order?.location?.label ?? order?.locationTag ?? '—';
  // Full address = label + ", Kumasi" fallback
  const fullAddress = order?.location?.label
    ? `${order.location.label}, KNUST, Oforikrom - Kumasi`
    : 'KNUST, Oforikrom - Kumasi';

  const initialRegion: Region = customerCoords
    ? {
      latitude: customerCoords.latitude,
      longitude: customerCoords.longitude,
      latitudeDelta: 0.018,
      longitudeDelta: 0.018,
    }
    : {
      // KNUST default
      latitude: 6.6745,
      longitude: -1.5716,
      latitudeDelta: 0.018,
      longitudeDelta: 0.018,
    };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Frosted glass backdrop */}
      <View style={styles.scrim}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </View>

      {/* Sheet */}
      <View style={styles.sheet}>

        {/* Handle */}


        {/* ── Map ── */}
        <View style={styles.mapWrapper}>
          {customerCoords ? (
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              provider={PROVIDER_DEFAULT}
              initialRegion={initialRegion}
              showsUserLocation={false}   // we draw our own rider marker
              showsCompass={false}
              showsScale={false}
              toolbarEnabled={false}
            >
              {/* Customer delivery pin */}
              <Marker
                coordinate={customerCoords}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={false}
              >
                <View style={customerPinStyle} />
              </Marker>

              {/* Rider current location */}
              {riderCoords && (
                <Marker
                  coordinate={riderCoords}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View style={riderPinOuter}>
                    <View style={riderPinInner} />
                  </View>
                </Marker>
              )}

              {/* Route line (road network when available, straight-line fallback) */}
              {riderCoords && (
                <Polyline
                  coordinates={routeCoords.length > 0 ? routeCoords : [riderCoords, customerCoords]}
                  strokeColor="#22A45D"
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
              {routeLoading && (
                <View style={styles.routeLoader}>
                  <ActivityIndicator size="small" color="#22A45D" />
                </View>
              )}
            </MapView>
          ) : (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator color="#22A45D" size="large" />
              <Text style={styles.loadingText}>Loading map…</Text>
            </View>
          )}

          {locationError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{locationError}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Bottom info bar ── */}
        <View style={styles.infoBar}>
          {/* Pin + distance column */}
          <View style={styles.distanceCol}>
            <Svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <Path d="M12.0286 4.92918C11.4161 2.23418 9.06529 1.02084 7.00029 1.02084C7.00029 1.02084 7.00029 1.02084 6.99446 1.02084C4.9353 1.02084 2.57863 2.22834 1.96613 4.92334C1.28363 7.93334 3.12697 10.4825 4.7953 12.0867C5.41363 12.6817 6.20695 12.9792 7.00029 12.9792C7.79362 12.9792 8.58695 12.6817 9.19945 12.0867C10.8678 10.4825 12.7111 7.93918 12.0286 4.92918Z" fill="black" fill-opacity="0.5" />
              <Path d="M6.9996 7.85178C8.01443 7.85178 8.8371 7.02911 8.8371 6.01428C8.8371 4.99943 8.01443 4.17676 6.9996 4.17676C5.98478 4.17676 5.16211 4.99943 5.16211 6.01428C5.16211 7.02911 5.98478 7.85178 6.9996 7.85178Z" fill="white" />
            </Svg>
            {distance ? (
              <Text style={styles.distanceText}>{distance}</Text>
            ) : (
              <ActivityIndicator size="small" color="#22A45D" style={{ marginTop: 2 }} />
            )}
          </View>

          {/* Divider */}
          <View style={styles.barDivider} />

          {/* Name + address */}
          <View style={styles.addressCol}>
            <Text style={styles.locationName} numberOfLines={1}>
              {locationName}
            </Text>
            <Text style={styles.locationAddress} numberOfLines={1}>
              {fullAddress}
            </Text>
          </View>
        </View>

        {/* iOS safe-area spacer */}
        {Platform.OS === 'ios' && <View style={{ height: 20 }} />}
      </View>
    </Modal>
  );
};

/* ─── Sheet styles ───────────────────────────────────────── */
const PinIcon = () => (
  <View style={{
    width: 20, height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(34,164,93,0.12)',
    alignItems: 'center', justifyContent: 'center',
  }}>
    {/* Simple drawn pin */}
    <View style={{
      width: 8, height: 10,
      borderRadius: 4,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      backgroundColor: '#22A45D',
    }} />
  </View>
);

/* ─── Sheet styles ───────────────────────────────────────── */
const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 20,
    marginHorizontal: 12,
    marginBottom: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginTop: 12,
    marginBottom: 8,
  },

  /* Map */
  mapWrapper: {
    height: 300,
    // marginHorizontal: 16,
    // borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E8EFE8',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.4)',
  },
  routeLoader: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 6,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(220,38,38,0.85)',
    padding: 10,
  },
  errorText: {
    color: '#FFF',
    fontSize: 12,
    textAlign: 'center',
  },

  /* Bottom info bar */
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  distanceCol: {
    alignItems: 'center',
    gap: 3,
    minWidth: 36,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.55)',
    letterSpacing: -0.1,
  },
  barDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  addressCol: {
    flex: 1,
    gap: 2,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.2,
  },
  locationAddress: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.45)',
  },
});

export default ViewLocationModal;