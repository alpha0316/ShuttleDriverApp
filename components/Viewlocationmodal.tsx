/**
 * ViewLocationModal.tsx
 *
 * Bottom-sheet map modal shown when a driver taps "View Location".
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

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import type { OrderData } from '@/components/DriverOrderCard';

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
  const dLat = toRad(b.latitude  - a.latitude);
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
  const minLat = Math.min(a.latitude,  b.latitude);
  const maxLat = Math.max(a.latitude,  b.latitude);
  const minLng = Math.min(a.longitude, b.longitude);
  const maxLng = Math.max(a.longitude, b.longitude);
  const latDelta = Math.max((maxLat - minLat) * 1.5, 0.01);
  const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.01);
  return {
    latitude:  (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta:  latDelta,
    longitudeDelta: lngDelta,
  };
};

/* ─── Sub-component: Rider pin ─────────────────────────── */
const RiderMarker = () => (
  <View style={markerStyles.riderOuter}>
    <View style={markerStyles.riderInner} />
  </View>
);

/* ─── Sub-component: Customer pin ─────────────────────── */
const CustomerMarker = () => (
  <View style={markerStyles.customerPin}>
    <View style={markerStyles.customerDot} />
  </View>
);

/* ─── Main Component ─────────────────────────────────────── */
const ViewLocationModal: React.FC<ViewLocationModalProps> = ({
  visible,
  order,
  onClose,
}) => {
  const mapRef = useRef<MapView>(null);
  const [riderCoords, setRiderCoords]   = useState<Coords | null>(null);
  const [locationError, setLocationError] = useState('');

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

      // One-shot current position
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
  const customerCoords: Coords | null = order?.location
    ? { latitude: order.location.latitude, longitude: order.location.longitude }
    : null;

  const distance =
    riderCoords && customerCoords
      ? formatDistance(haversineMetres(riderCoords, customerCoords))
      : null;

  const locationName = order?.location?.label ?? order?.locationTag ?? '—';
  // Full address = label + ", Kumasi" fallback
  const fullAddress  = order?.location?.label
    ? `${order.location.label}, KNUST, Oforikrom - Kumasi`
    : 'KNUST, Oforikrom - Kumasi';

  const initialRegion: Region = customerCoords
    ? {
        latitude:  customerCoords.latitude,
        longitude: customerCoords.longitude,
        latitudeDelta:  0.018,
        longitudeDelta: 0.018,
      }
    : {
        // KNUST default
        latitude:  6.6745,
        longitude: -1.5716,
        latitudeDelta:  0.018,
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
      {/* Scrim */}
      <Pressable style={styles.scrim} onPress={onClose} />

      {/* Sheet */}
      <View style={styles.sheet}>

        {/* Handle */}
        <View style={styles.handle} />

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
                <CustomerMarker />
              </Marker>

              {/* Rider current location */}
              {riderCoords && (
                <Marker
                  coordinate={riderCoords}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <RiderMarker />
                </Marker>
              )}

              {/* Route line */}
              {riderCoords && (
                <Polyline
                  coordinates={[riderCoords, customerCoords]}
                  strokeColor="#22A45D"
                  strokeWidth={3}
                  lineDashPattern={[8, 5]}
                />
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
            <PinIcon />
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

/* ─── Marker inner styles ────────────────────────────────── */
const markerStyles = StyleSheet.create({
  // Blue pulsing dot for rider
  riderOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(59,130,246,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(59,130,246,0.5)',
  },
  riderInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
  },

  // Green teardrop for customer
  customerPin: {
    width: 24,
    height: 30,
    borderRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#22A45D',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '0deg' }],
    overflow: 'hidden',
  },
  customerDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
});

/* ─── Inline pin icon (no dependency) ───────────────────── */
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
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 20,
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
    marginHorizontal: 16,
    borderRadius: 16,
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