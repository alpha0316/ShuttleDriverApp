import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import SplashScreen from '../screens/SplashScreen';
import Register from '../screens/Register';
import Home from '../screens/Home';
import OTPVerification from '../screens/OTPVerification';
import SignIn from '../screens/SignIn';
import DriverBottomNav from './DriverBottomNav'; // 👈 import here

const Stack = createNativeStackNavigator();

export default function MainNav() {
  return (
    <Stack.Navigator initialRouteName="SplashScreen">
      <Stack.Screen name="SplashScreen" component={SplashScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Home" component={Home} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={Register} options={{ headerShown: false }} />
      <Stack.Screen name="SignIn" component={SignIn} options={{ headerShown: false }} />
      <Stack.Screen name="OTPVerification" component={OTPVerification} options={{ headerShown: false }} />

      {/* 👇 Add your tab navigation here */}
      <Stack.Screen name="DriverBottomNav" component={DriverBottomNav} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
