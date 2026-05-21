/**
 * SelectLocationModal.tsx
 *
 * Bottom-sheet modal for filtering orders by delivery location.
 * - "All Locations" is always first with a green selected ring + radio dot
 * - Remaining locations are derived from orders, sorted by order count desc
 * - Tapping any row calls onSelect(locationName | null for "All")
 */

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import type { MockOrder } from '../../data/mockOrders';

/* ─── Types ──────────────────────────────────────────────── */
interface LocationEntry {
  name: string;
  address: string;  // full label shown as subtitle for All Locations
  count: number;
}

interface SelectLocationModalProps {
  visible: boolean;
  orders: MockOrder[];
  selected: string | null;          // null = "All Locations"
  currentAddress?: string;          // subtitle under "All Locations"
  onSelect: (locationName: string | null) => void;
  onClose: () => void;
}

/* ─── Helpers ────────────────────────────────────────────── */
const buildLocationList = (orders: MockOrder[]): LocationEntry[] => {
  const countMap: Record<string, { address: string; count: number }> = {};

  for (const order of orders) {
    const name = order.customerLocation.name;
    if (!countMap[name]) {
      countMap[name] = { address: name, count: 0 };
    }
    countMap[name].count += 1;
  }

  return Object.entries(countMap)
    .map(([name, { address, count }]) => ({ name, address, count }))
    .sort((a, b) => b.count - a.count);
};

/* ─── Component ──────────────────────────────────────────── */
const SelectLocationModal: React.FC<SelectLocationModalProps> = ({
  visible,
  orders,
  selected,
  currentAddress = 'KNUST, Oforikrom - Kumasi',
  onSelect,
  onClose,
}) => {
  const locations = useMemo(() => buildLocationList(orders), [orders]);
  const isAllSelected = selected === null;

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

        {/* Handle pill */}
        <View style={styles.handle} />

        {/* Title */}
        <Text style={styles.title}>Select Location</Text>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          bounces={false}
        >
          {/* ── All Locations row (always first, special styling) ── */}
          <TouchableOpacity
            style={[
              styles.allLocationsRow,
              isAllSelected && styles.allLocationsRowSelected,
            ]}
            onPress={() => { onSelect(null); onClose(); }}
            activeOpacity={0.75}
          >
            <View style={styles.allLocationsText}>
              <Text style={styles.locationName}>All Locations</Text>
              <Text style={styles.locationAddress}>{currentAddress}</Text>
            </View>

            {/* Green radio dot */}
            <View style={[
              styles.radioOuter,
              isAllSelected && styles.radioOuterSelected,
            ]}>
              {isAllSelected && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          {/* ── Location rows ── */}
          {locations.map((loc, index) => {
            const isSelected = selected === loc.name;
            return (
              <React.Fragment key={loc.name}>
                {/* Divider */}
                <View style={styles.divider} />

                <TouchableOpacity
                  style={styles.locationRow}
                  onPress={() => { onSelect(loc.name); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.locationRowText}>
                    <Text style={styles.locationName}>{loc.name}</Text>
                    <Text style={styles.orderCount}>
                      {loc.count} {loc.count === 1 ? 'Order' : 'Orders'}
                    </Text>
                  </View>

                  {/* Radio — only shown when selected */}
                  {isSelected && (
                    <View style={[styles.radioOuter, styles.radioOuterSelected]}>
                      <View style={styles.radioInner} />
                    </View>
                  )}
                </TouchableOpacity>
              </React.Fragment>
            );
          })}

          {/* Bottom safe area padding */}
          <View style={{ height: Platform.OS === 'ios' ? 32 : 16 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

/* ─── Styles ─────────────────────────────────────────────── */
const GREEN = '#22A45D';

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: '72%',
    // Shadow for depth on iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 16,
    marginHorizontal: 12,
    marginBottom: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  listContent: {
    paddingBottom: 0,
  },

  /* All Locations row */
  allLocationsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#FFFFFF',
  },
  allLocationsRowSelected: {
    borderColor: GREEN,
    backgroundColor: 'rgba(34,164,93,0.04)',
  },
  allLocationsText: {
    flex: 1,
    marginRight: 12,
    gap: 2,
  },

  /* Regular location rows */
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  locationRowText: {
    flex: 1,
    gap: 2,
  },

  locationName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.1,
  },
  locationAddress: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.45)',
    marginTop: 1,
  },
  orderCount: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.45)',
    marginTop: 1,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.07)',
  },

  /* Radio button */
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioOuterSelected: {
    borderColor: GREEN,
    backgroundColor: '#FFFFFF',
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: GREEN,
  },
});

export default SelectLocationModal;