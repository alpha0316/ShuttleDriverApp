import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import SplashScreen from '../screens/SplashScreen';
import Register from '../screens/Register';
import Home from '../screens/Home';
import OTPVerification from '../screens/OTPVerification';
import SignIn from '../screens/SignIn';
import SignUpType from '../screens/SignUpType';
import HomeDelivery from './../screens/deliveryRider/HomeDelivery';
import PickUps from './../screens/deliveryRider/PickUps';
import FillingProcess from '../screens/deliveryRider/FillingProcess';
import RegisterDelivery from '../screens/deliveryRider/RegisterDelivery';
import SignInDelivery from '../screens/deliveryRider/SignInDelivery';

// Define the type for your route parameters
export type RootStackParamList = {
  SplashScreen: undefined;
  Home: undefined;
  Register: undefined;
  SignIn: undefined;
  OTPVerification: undefined;
  SignUpType: undefined;
  HomeDelivery: undefined;
  PickUps: undefined;
  FillingProcess: undefined;
  RegisterDelivery: undefined;
  SignInDelivery: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function MainNav() {
  return (
    <Stack.Navigator 
      initialRouteName="SplashScreen"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="SplashScreen" component={SplashScreen} />
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="Register" component={Register} />
      <Stack.Screen name="SignIn" component={SignIn} />
      <Stack.Screen name="OTPVerification" component={OTPVerification} />
      <Stack.Screen name="SignUpType" component={SignUpType} />
      <Stack.Screen name="HomeDelivery" component={HomeDelivery} />
      <Stack.Screen name="PickUps" component={PickUps} />
      <Stack.Screen name="FillingProcess" component={FillingProcess} />
      <Stack.Screen name="RegisterDelivery" component={RegisterDelivery} />
      <Stack.Screen name="SignInDelivery" component={SignInDelivery} />
    </Stack.Navigator>
  );
}