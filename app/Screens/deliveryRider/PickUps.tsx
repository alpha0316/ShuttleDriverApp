// In your PickUps.tsx or wherever you're using the Table

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Table from '@/components/Table';
import OpenMap from '@/components/OpenMap'; // Your map component
import PrimaryButton from '@/components/PrimaryButton';
import BackButton from '@/components/BackButton';

export default function PickUps({ navigation }) {
  const [selectedHostel, setSelectedHostel] = useState(null);

  // Your order data
  const tableData = [
    {
      id: '011',
      customerName: 'Nana Ama Amankwah',
      phone: '055 414 4611',
      hostel: 'Brunei',
      size: 'Medium',
      price: 'GHS 65.00',
      status: 'pending'
    },
    {
      id: '012',
      customerName: 'Kwame Mensah',
      phone: '020 123 4567',
      hostel: 'Suncity Hostel',
      size: 'Large',
      price: 'GHS 85.00',
      status: 'completed'
    },
    {
      id: '013',
      customerName: 'Ama Serwaa',
      phone: '054 987 6543',
      hostel: 'Independence Hall',
      size: 'Small',
      price: 'GHS 45.00',
      status: 'pending'
    },
    {
      id: '014',
      customerName: 'Kofi Owusu',
      phone: '027 555 1234',
      hostel: 'Hall 2',
      size: 'Medium',
      price: 'GHS 65.00',
      status: 'in-progress'
    },
    {
      id: '015',
      customerName: 'Abena Pokuaa',
      phone: '024 777 8888',
      hostel: 'Hall 8',
      size: 'Large',
      price: 'GHS 85.00',
      status: 'pending'
    },
    {
      id: '016',
      customerName: 'Yaw Boateng',
      phone: '050 222 3333',
      hostel: 'Hall 4',
      size: 'Small',
      price: 'GHS 45.00',
      status: 'completed'
    },
    {
      id: '017',
      customerName: 'Akua Nyarko',
      phone: '055 666 9999',
      hostel: 'Hall 6',
      size: 'Medium',
      price: 'GHS 65.00',
      status: 'pending'
    },
    {
      id: '018',
      customerName: 'Kwabena Osei',
      phone: '020 444 5555',
      hostel: 'Hall 1',
      size: 'Large',
      price: 'GHS 85.00',
      status: 'in-progress'
    },
    {
      id: '019',
      customerName: 'Adwoa Safo',
      phone: '054 111 2222',
      hostel: 'Hall 9',
      size: 'Small',
      price: 'GHS 45.00',
      status: 'completed'
    },
    {
      id: '020',
      customerName: 'Benedicta Appiah',
      phone: '027 888 9999',
      hostel: 'Hall 7',
      size: 'Medium',
      price: 'GHS 65.00',
      status: 'pending'
    }
  ];

  return (
    <View style={styles.main}>
      <View style={styles.contentWrapper}>

        {/* Map Section */}
        <View style={{ gap: 16 }}>
          <OpenMap
            orders={tableData}
            selectedHostel={selectedHostel}
            campusName="KNUST"  // 👈 Change this to your university
            city="Kumasi"       // 👈 Change this to your city
          />
        </View>

        {/* Bottom Sheet with Orders */}
        <View style={styles.footer}>
          <View style={styles.headerRow}>
            <BackButton />
            <Text>0 / 10 Orders</Text>
          </View>

          <Text style={styles.ordersTitle}>Orders</Text>

          <ScrollView style={styles.scrollContainer}>
            <Table
              tableData={tableData}
              onStudentPress={(student) => setSelectedHostel(student.hostel)}
            />
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