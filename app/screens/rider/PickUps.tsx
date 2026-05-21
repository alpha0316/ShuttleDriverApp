import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import OpenMap from '@/components/OpenMap';
import PrimaryButton from '@/components/PrimaryButton';
import BackButton from '@/components/BackButton';
import DriverOrderCard, { OrderData } from '@/components/DriverOrderCard';
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

export default function PickUps({ navigation }) {
  const [selectedHostel, setSelectedHostel] = useState<string | null>(null);

  const orderCards = mockOrders.map(toOrderData);

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
              status: 'pending',
            }))}
            selectedHostel={selectedHostel}
            campusName="KNUST"
            city="Kumasi"
          />
        </View>

        <View style={styles.footer}>
          <View style={styles.headerRow}>
            <BackButton />
            <Text>0 / {orderCards.length} Orders</Text>
          </View>

          <Text style={styles.ordersTitle}>Orders</Text>

          <ScrollView style={styles.scrollContainer}>
            {orderCards.map((order) => (
              <View key={order.id} style={{ marginBottom: 12 }}>
                <DriverOrderCard
                  order={order}
                  defaultOpen={false}
                />
              </View>
            ))}
          </ScrollView>

          <PrimaryButton
            title="Start Delivery"
            onPress={() => navigation.navigate('FillingProcess')}
          />
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
    backgroundColor: '#F5F5F5',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 12,
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
    height: 250, // Adjust based on your needs
  },
});