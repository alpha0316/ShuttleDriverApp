import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import PrimaryButton from '../../../components/PrimaryButton';
import BackButton from '../../../components/BackButton';
import { useNavigation, useRoute } from '@react-navigation/native';

const { height, width } = Dimensions.get('window');

const FillingProcess = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { filteredOrders = [] } = route.params || {};
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filledAmount, setFilledAmount] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const FlatListRef = useRef(null);
  const BASE_CUSTOMER_URL = "https://backend-node-0kx8.onrender.com";
  const ORDER_STATUSES = ["pending", "picked", "in progress", "filling", "filling completed", "completed"];
  const totalAmount = filteredOrders.reduce((sum, order) => sum + order.orderAmount, 0);

  const ITEM_HEIGHT = height * 0.1;
  const ITEM_OFFSET = ITEM_HEIGHT * 0.7;

  useEffect(() => {
    FlatListRef.current?.scrollToOffset({
      offset: (filteredOrders.length / 2 - 1) * ITEM_HEIGHT,
      animated: false,
    });
  }, []);

  useEffect(() => {
    console.log(totalAmount);
  }, [filteredOrders]);

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await fetch(`${BASE_CUSTOMER_URL}/api/orders/order/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOrderStatus: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update order status");
      }

      const data = await response.json();
      console.log('Order status updated:', data);

      // Update local state
      const updatedOrders = filteredOrders.map((order) =>
        order._id === orderId ? { ...order, orderStatus: 'filling' } : order
      );
      route.params.filteredOrders = updatedOrders; // Update route params
      return data;
    } catch (err) {
      console.error("Error updating order status:", err.message);
      throw err;
    }
  };

  const handleNextPress = async () => {
    const currentOrder = filteredOrders[selectedIndex];
    if (!currentOrder) return;
  
    const currentStatusIndex = ORDER_STATUSES.indexOf(currentOrder.orderStatus);
    if (currentStatusIndex === -1) {
      console.error("Invalid order status:", currentOrder.orderStatus);
      return;
    }
  
    if (selectedIndex === filteredOrders.length - 1) {
     
      try {
        await Promise.all(
          filteredOrders.map(order =>
            updateOrderStatus(order._id, "filling completed")
          )
        );
  
     
        const updatedOrders = filteredOrders.map(order => ({
          ...order,
          orderStatus: "filling completed"
        }));
        route.params.filteredOrders = updatedOrders; 
  
        navigation.navigate("CylinderDelivery");
      } catch (err) {
        console.error("Error completing filling process:", err.message);
      }
    } else {
      // Proceed to next order
      const nextStatus = ORDER_STATUSES[currentStatusIndex + 1];
      if (!nextStatus) {
        console.error("No next status available.");
        return;
      }
  
      try {
        await updateOrderStatus(currentOrder._id, "filling");
  
        const updatedOrders = filteredOrders.map((order, index) =>
          index === selectedIndex ? { ...order, orderStatus: nextStatus } : order
        );
        route.params.filteredOrders = updatedOrders;
  
        const nextIndex = selectedIndex + 1;
        setFilledAmount(prev => prev + currentOrder.orderAmount);
        FlatListRef.current?.scrollToOffset({
          offset: nextIndex * ITEM_HEIGHT,
          animated: true,
        });
        setSelectedIndex(nextIndex);
      } catch (err) {
        console.error("Error handling next press:", err.message);
      }
    }
  };
  

  const renderItem = ({ item, index }) => {
    const inputRange = [
      (index - 2) * ITEM_HEIGHT,
      (index - 1) * ITEM_HEIGHT,
      index * ITEM_HEIGHT,
      (index + 1) * ITEM_HEIGHT,
      (index + 2) * ITEM_HEIGHT,
    ];

    const scale = scrollY.interpolate({
      inputRange,
      outputRange: [0.8, 0.9, 1, 0.9, 0.8],
      extrapolate: 'clamp',
    });

    const opacity = scrollY.interpolate({
      inputRange,
      outputRange: [0.3, 0.4, 1, 0.4, 0.3],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.itemContainer,
          {
            height: ITEM_HEIGHT,
            transform: [{ scale }],
            opacity,
          },
        ]}
      >
        <Text style={styles.nameText}>{item.orderId}</Text>
        <Text style={styles.nameText}>{item.customerName}</Text>
        <Text style={styles.detailText}>{item.hostelName}</Text>
        <Text style={styles.detailText}>{item.cylinderSize}</Text>
        <Text style={styles.detailText}>GHS {item.orderAmount}</Text>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerText}>Filling Process</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total</Text>
          <Text>{filteredOrders.length}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Left To Fill</Text>
          <Text>{filteredOrders.length - selectedIndex}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Amount Left</Text>
          <Text>GHS {totalAmount - filledAmount}</Text>
        </View>
      </View>

      <View style={styles.pickerContainer}>
        <View style={styles.pickerMask} />
        <Animated.FlatList
          ref={FlatListRef}
          data={filteredOrders}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          bounces={false}
          decelerationRate="fast"
          snapToAlignment="start"
          snapToInterval={ITEM_HEIGHT}
          contentContainerStyle={{ paddingVertical: ITEM_OFFSET }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          renderItem={renderItem}
          getItemLayout={(data, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          onMomentumScrollEnd={(ev) => {
            const newIndex = Math.round(ev.nativeEvent.contentOffset.y / ITEM_HEIGHT);
            setSelectedIndex(newIndex);
          }}
        />
      </View>

      <View style={styles.buttonContainer}>
        <PrimaryButton
          title={selectedIndex === filteredOrders.length - 1 ? 'Complete Filling' : 'Next'}
          onPress={handleNextPress}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 88,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.20)',
    paddingBottom: 8,
    alignSelf: 'stretch',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 24,
    justifyContent: 'space-between',
  },
  statBox: {
    padding: 12,
    gap: 16,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: 'rgba(0, 0, 0, 0.10)',
    width: 110,
  },
  statLabel: {
    color: 'rgba(0, 0, 0, 0.60)',
  },
  pickerContainer: {
    height: height * 0.22,
    alignItems: 'center',
    justifyContent: 'center',
    top: 30,
    backgroundColor: '#F4F4F4',
  },
  pickerMask: {
    position: 'absolute',
    top: '10%',
    left: 0,
    right: 0,
    height: height * 0.1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.0)',
  },
  itemContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    width: '100%',
    backgroundColor: 'white',
    paddingHorizontal: 4,
  },
  nameText: {
    fontSize: 16,
    color: '#000',
  },
  detailText: {
    fontSize: 16,
    color: '#000',
  },
  buttonContainer: {
    marginTop: 60,
  },
});

export default FillingProcess;