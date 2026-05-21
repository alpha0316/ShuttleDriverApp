import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import SplashScreen from '../screens/SplashScreen';
import SignUpType from '../screens/SignUpType';
import Home from '../screens/shuttle/Home';
import Register from '../screens/shuttle/Register';
import SignIn from '../screens/shuttle/SignIn';
import OTPVerification from '../screens/shuttle/OTPVerification';
import HomeDelivery from '../screens/rider/HomeDelivery';
import PickUps from '../screens/rider/PickUps';
import FillingProcess from '../screens/rider/FillingProcess';
import RegisterDelivery from '../screens/rider/RegisterDelivery';
import SignInDelivery from '../screens/rider/SignInDelivery';

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