import BackButton from '@/components/BackButton';
import DriverOrderCard, { OrderData } from '@/components/DriverOrderCard';
import OpenMap from '@/components/OpenMap';
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, Dimensions } from 'react-native';
import { Audio } from 'expo-av';
import { mockOrders } from '../../data/mockOrders';

const toOrderData = (order: typeof mockOrders[0]): OrderData => ({
  id: order.id,
  customerName: order.customerName,
  phone: order.customerPhone,
  locationTag: order.customerLocation.name,
  totalAmount: order.orders.reduce((sum, o) => sum + o.price * o.quantity, 0),
  items: order.orders.map((o) => ({
    name: o.item,
    quantity: o.quantity,
    price: o.price,
  })),
  location: {
    latitude: order.customerLocation.lat,
    longitude: order.customerLocation.lng,
    label: order.customerLocation.name,
  },
});

const initialOrders = mockOrders.map(toOrderData);

export default function PickUps({ navigation }) {
  const [selectedHostel, setSelectedHostel] = useState<string | null>(null);
  const [routeTarget, setRouteTarget] = useState<{latitude: number; longitude: number} | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const soundRef = useRef<Audio.Sound | null>(null);

  const playCompleteSound = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.replayAsync();
        return;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/buttons/sounds/button-09.wav' },
        { volume: 0.5 }
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch {}
  }, []);

  React.useEffect(() => {
    return () => { soundRef.current?.unloadAsync(); };
  }, []);

  const orderCards = useMemo(() => {
    const completed = initialOrders.filter(o => completedIds.has(o.id));
    const uncompleted = initialOrders.filter(o => !completedIds.has(o.id));
    return [...uncompleted, ...completed];
  }, [completedIds]);

  const completedCount = completedIds.size;

  const handleViewDirection = useCallback((order: OrderData) => {
    if (order.location) {
      setRouteTarget({
        latitude: order.location.latitude,
        longitude: order.location.longitude,
      });
    }
  }, []);

  const handleComplete = useCallback((order: OrderData) => {
    setCompletedIds(prev => {
      const next = new Set(prev);
      if (next.has(order.id)) {
        next.delete(order.id);
      } else {
        next.add(order.id);
      }
      return next;
    });
    playCompleteSound();
  }, [playCompleteSound]);

  return (
    <View style={styles.main}>
      <View style={styles.contentWrapper}>

        <View style={{ gap: 16 }}>
          <OpenMap
            orders={orderCards.map((o) => ({
              id: o.id,
              customerName: o.customerName,
              phone: o.phone,
              hostel: o.locationTag,
              size: 'Medium',
              price: `GHS ${o.totalAmount.toFixed(2)}`,
              status: completedIds.has(o.id) ? 'completed' : 'pending',
            }))}
            deliveryPoints={orderCards
              .filter(o => !completedIds.has(o.id))
              .map((o) => ({
                latitude: o.location!.latitude,
                longitude: o.location!.longitude,
                label: o.locationTag,
                customerName: o.customerName,
              }))}
            routeTarget={routeTarget}
            selectedHostel={selectedHostel}
            campusName="KNUST"
            city="Kumasi"
          />
        </View>

        <View style={styles.footer}>
          <View style={styles.headerRow}>

            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <BackButton />
              <Text style={styles.ordersTitle}>Orders</Text>
            </View>

            <Text>{completedCount} / {orderCards.length} Orders</Text>
          </View>

          <ScrollView style={styles.scrollContainer}>
            {orderCards.map((order) => (
              <View key={order.id} style={{ marginBottom: 12 }}>
                <DriverOrderCard
                  order={order}
                  defaultOpen={false}
                  onViewMap={handleViewDirection}
                  onComplete={handleComplete}
                  hideCallName
                  actionButtonFlex={[3, 2, 4]}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: 'white',
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
  footer: {
    padding: 16,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.10)',
    backgroundColor: '#FdFdFd',
    gap: 8,
    bottom: Dimensions.get('window').height * 0.01,
    left: 8,
    right: 8,
    zIndex: 222,
    position: 'absolute',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ordersTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContainer: {
    height: 250,
  },
});
