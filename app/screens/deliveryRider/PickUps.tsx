import { Image, StyleSheet, Platform, View, Text, TextInput,FlatList, TouchableOpacity ,ScrollView, Picker  } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import PrimaryButton from '../../../components/PrimaryButton';
// import HostelDropDown from '../../components/BackButton';
// import LocationDropDown from '../../components/BackButton';
import Table from '@/components/Table';
import OpenMap from '@/components/OpenMap'
import BackButton from '@/components/BackButton';



export default function PickUps({ navigation }) {
  const [selectCount, setSelectCount] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [filteredOrders, setFilterOrders] = useState([])
  const [orders, setOrders] = useState({ data: [] });


  


  const handleSelectedCount = (selectCount, totalCount, price, filteredOrders) => {
    setSelectCount(selectCount);
    setTotalBookings(totalCount);
    setTotalPrice(price);
    setFilterOrders(filteredOrders)
  };

     const updateOrderStatus = useCallback(async (orderId, newStatus) => {
        if (!ORDER_STATUSES.includes(newStatus)) {
          console.error("Invalid status value:", newStatus);
          return;
        }
      
        try {
          const response = await fetch(`${BASE_CUSTOMER_URL}/api/orders/order/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newOrderStatus: newStatus }),
          });
      
          if (!response.ok) {
            const errorData = await response.json(); // Read the response body once
            throw new Error(errorData.message || "Failed to update order status");
          }
      
          const data = await response.json(); // Read the response body once
          console.log('status', data);
      
          setOrders(prevOrders => ({
            data: prevOrders.data.map(order =>
              order._id === orderId ? { ...order, orderStatus: newStatus } : order
            )
          }));
      
        } catch (err) {
          console.error("Error updating order status:", err.message);
        }
      }, []);


  const startFilling = () => {
  


      navigation.navigate('FillingProcess')
  }
 
  const isButtonDisabled = totalBookings > selectCount;

  return (
    <View style={styles.main}>
      <View style={styles.contentWrapper}>
        {/* Main content */}
        <View style ={{

          gap : 16,
          // backgroundColor: 'red',
        }}>
        
        <OpenMap/>
  
        </View>

    
        <View style={styles.footer}>

          <View style={{
            display : 'flex',
            // flex : 1,
            alignItems : 'center',
            justifyContent : 'space-between',
            flexDirection : 'row'
          }}>
            {/* <Svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <Path d="M10.0002 13.2802L5.65355 8.93355C5.14022 8.42021 5.14022 7.58021 5.65355 7.06688L10.0002 2.72021" stroke="black" stroke-opacity="0.6" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
            </Svg> */}

            <BackButton/>

            <Text>0 <Text style={{
              color : 'rgba(0,0,0,0.5)'
            }}>/ 4 Cylinders Picked</Text></Text>
          </View>

          <Text style={{
            fontSize : 14,
            fontWeight : '700'
          }}>Orders</Text>

          <ScrollView style={{
            height : '30%',
          }}>
            <Table 
                onSelectCountChange={handleSelectedCount} 
                // orders={orders.data}  // pass mock data
              />
          </ScrollView>

  
       
          <PrimaryButton
            title={'Start Filling'}
            onPress={startFilling}
            disabled={isButtonDisabled}
          />
        </View>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  main: {
    flex: 1, // Ensures the container fills the screen
    backgroundColor: 'white',
  },
  contentWrapper: {
    flex: 1, // Allows the main content to take up available space
    justifyContent: 'space-between', // Spreads content and footer

  },

  footer: {
    padding: 16,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.10)',
    backgroundColor: '#F5F5F5',
    alignSelf: 'stretch',
    gap: 8,
    position: 'relative',
    bottom : '1%',
    marginHorizontal : 12
  },
});