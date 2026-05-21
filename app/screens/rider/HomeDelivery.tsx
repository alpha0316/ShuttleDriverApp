/**
 * HomeDelivery.tsx  (updated)
 *
 * Changes from original:
 * ─────────────────────
 * 1. Renders all DriverOrderCards in the ScrollView
 * 2. Location pill is tappable → opens SelectLocationModal
 * 3. DriverOrderCard.onViewMap  → opens ViewLocationModal for that order
 * 4. selectedLocation state filters the visible order cards
 * 5. Cost summary reacts to the filtered list
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StackNavigationProp } from '@react-navigation/stack';

import PrimaryButton from '../../../components/PrimaryButton';
import DriverOrderCard, { OrderData } from '@/components/DriverOrderCard';
import SelectLocationModal from '@/components/Selectlocationmodal';
import ViewLocationModal from '@/components/Viewlocationmodal';
import { mockOrders } from '../../data/mockOrders';

/* ─── Types ──────────────────────────────────────────────── */
type HomeDeliveryProps = {
  navigation: StackNavigationProp<any>;
};

/* ─── Data transform ─────────────────────────────────────── */
const toOrderData = (order: typeof mockOrders[0]): OrderData => ({
  id:           order.id,
  customerName: order.customerName,
  phone:        order.customerPhone,
  locationTag:  order.customerLocation.name,
  totalAmount:  order.orders.reduce((s, o) => s + o.price * o.quantity, 0),
  items:        order.orders.map(o => ({
    name:     o.item,
    quantity: o.quantity,
    price:    o.price,
  })),
  location: {
    latitude:  order.customerLocation.lat,
    longitude: order.customerLocation.lng,
    label:     order.customerLocation.name,
  },
});

const allOrderCards: OrderData[] = mockOrders.map(toOrderData);

/* ─── Component ──────────────────────────────────────────── */
export default function HomeDelivery({ navigation }: HomeDeliveryProps) {

  /* ── Modal visibility ── */
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [mapModalOpen,      setMapModalOpen]       = useState(false);

  /* ── Filter state ── */
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null); // null = All

  /* ── Currently viewed order (map modal) ── */
  const [activeOrder, setActiveOrder] = useState<OrderData | null>(null);

  /* ── Filtered cards ── */
  const visibleCards = useMemo(() =>
    selectedLocation
      ? allOrderCards.filter(o => o.locationTag === selectedLocation)
      : allOrderCards,
  [selectedLocation]);

  /* ── Handlers ── */
  const handleLogout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('riderData');
    } catch (e) {
      console.error('Logout error', e);
    }
  }, []);

  const handleViewMap = useCallback((order: OrderData) => {
    setActiveOrder(order);
    setMapModalOpen(true);
  }, []);

  const handleSelectLocation = useCallback((loc: string | null) => {
    setSelectedLocation(loc);
  }, []);

  /* ── Totals ── */
  const totalAmount   = visibleCards.reduce((s, o) => s + o.totalAmount, 0);
  const commission    = totalAmount * 0.3;

  /* ── Location pill label ── */
  const locationLabel = selectedLocation ?? 'All Locations';

  return (
    <View style={styles.main}>
      <View style={styles.contentWrapper}>

        {/* ── Main content ── */}
        <View style={{ gap: 16 }}>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarCircle} />
              <View style={{ flexDirection: 'column', gap: 4 }}>
                <Text style={{ fontWeight: '600', fontSize: 16 }}>Oi Mandem</Text>
                <TouchableOpacity onPress={handleLogout}>
                  <Text style={{ fontSize: 12, color: 'red' }}>LogOut</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bell icon */}
            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <Path
                d="M12.02 2.90997C8.71003 2.90997 6.02003 5.59997 6.02003 8.90997V11.8C6.02003 12.41 5.76003 13.34 5.45003 13.86L4.30003 15.77C3.59003 16.95 4.08003 18.26 5.38003 18.7C9.69003 20.14 14.34 20.14 18.65 18.7C19.86 18.3 20.39 16.87 19.73 15.77L18.58 13.86C18.28 13.34 18.02 12.41 18.02 11.8V8.90997C18.02 5.60997 15.32 2.90997 12.02 2.90997Z"
                stroke="#828282" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round"
              />
              <Path
                d="M13.87 3.2C13.56 3.11 13.24 3.04 12.91 3C11.95 2.88 11.03 2.95 10.17 3.2C10.46 2.46 11.18 1.94 12.02 1.94C12.86 1.94 13.58 2.46 13.87 3.2Z"
                stroke="#828282" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"
              />
              <Path
                d="M15.02 19.06C15.02 20.71 13.67 22.06 12.02 22.06C11.2 22.06 10.44 21.72 9.89999 21.18C9.35999 20.64 9.01999 19.88 9.01999 19.06"
                stroke="#828282" strokeWidth="2" strokeMiterlimit="10"
              />
            </Svg>
          </View>

          {/* Filter row */}
          <View style={styles.filterRow}>

            {/* ── Location pill  (tappable → SelectLocationModal) ── */}
            <TouchableOpacity
              style={styles.locationPill}
              onPress={() => setLocationModalOpen(true)}
              activeOpacity={0.75}
            >
              {/* Filter icon */}
              <Svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <Path d="M14.667 4.33333H10.667" stroke="black" strokeOpacity="0.5" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M3.99967 4.33333H1.33301" stroke="black" strokeOpacity="0.5" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M6.66634 6.66667C7.95501 6.66667 8.99967 5.622 8.99967 4.33333C8.99967 3.04467 7.95501 2 6.66634 2C5.37768 2 4.33301 3.04467 4.33301 4.33333C4.33301 5.622 5.37768 6.66667 6.66634 6.66667Z" stroke="black" strokeOpacity="0.5" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M14.6667 11.6667H12" stroke="black" strokeOpacity="0.5" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M5.33301 11.6667H1.33301" stroke="black" strokeOpacity="0.5" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M9.33333 14C10.622 14 11.6667 12.9553 11.6667 11.6667C11.6667 10.378 10.622 9.33333 9.33333 9.33333C8.04467 9.33333 7 10.378 7 11.6667C7 12.9553 8.04467 14 9.33333 14Z" stroke="black" strokeOpacity="0.5" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>

              <Text style={styles.locationPillText} numberOfLines={1}>
                {locationLabel}
              </Text>

              {/* Order count badge */}
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{visibleCards.length}</Text>
              </View>
            </TouchableOpacity>

            {/* Right: total orders label */}
            <Text style={styles.ordersTotalLabel}>
              {visibleCards.length} / {allOrderCards.length} Orders
            </Text>
          </View>

          {/* ── Order cards list ── */}
          <ScrollView
            style={styles.cardList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingBottom: Dimensions.get('window').height * 0.18 + 100 }}
          >
            {visibleCards.map(order => (
              <DriverOrderCard
                key={order.id}
                order={order}
                defaultOpen={false}
                onViewMap={handleViewMap}
              />
            ))}

            {visibleCards.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  No orders for{' '}
                  <Text style={{ fontWeight: '600' }}>{selectedLocation}</Text>
                </Text>
                <TouchableOpacity onPress={() => setSelectedLocation(null)}>
                  <Text style={styles.clearFilter}>Show all locations</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>

        {/* ── Footer cost summary ── */}
        <View style={styles.footer}>
          <Text style={{ fontWeight: '700', fontSize: 18 }}>Cost Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Amount to be collected</Text>
            <Text style={styles.summaryValue}>GHC {totalAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Commission (30%)</Text>
            <Text style={styles.summaryValue}>GHC {commission.toFixed(2)}</Text>
          </View>
          <PrimaryButton
            title="Start Delivery"
            onPress={() => navigation.navigate('PickUps')}
            disabled={visibleCards.length === 0}
          />
        </View>
      </View>

      {/* ══ Modals ══ */}

      <SelectLocationModal
        visible={locationModalOpen}
        orders={mockOrders}
        selected={selectedLocation}
        currentAddress="KNUST, Oforikrom - Kumasi"
        onSelect={handleSelectLocation}
        onClose={() => setLocationModalOpen(false)}
      />

      <ViewLocationModal
        visible={mapModalOpen}
        order={activeOrder}
        onClose={() => { setMapModalOpen(false); setActiveOrder(null); }}
      />
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */
const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: 'white',
    paddingHorizontal: 2,
    paddingTop: Platform.OS === 'ios' ? 12 : 30,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },

  /* Filter row */
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 12,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: 'white',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: '62%',
  },
  locationPillText: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(0,0,0,0.60)',
    flexShrink: 1,
  },
  countBadge: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.55)',
  },
  ordersTotalLabel: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.40)',
    fontWeight: '400',
  },

  /* Card list */
  cardList: {
    maxHeight: '100%',
    paddingHorizontal: 4,
    zIndex: 2
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.45)',
  },
  clearFilter: {
    fontSize: 13,
    color: '#22A45D',
    fontWeight: '600',
  },

  /* Footer */
  footer: {
    padding: 16,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
    backgroundColor: '#FdFdFd',
    gap: 16,
    bottom: Dimensions.get('window').height * 0.01,
    left: 8,
    right: 8,
    zIndex: 222,
    position: 'absolute',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: 'rgba(0,0,0,0.60)',
    fontSize: 14,
  },
  summaryValue: {
    fontWeight: '600',
    fontSize: 14,
    color: '#111',
  },
});