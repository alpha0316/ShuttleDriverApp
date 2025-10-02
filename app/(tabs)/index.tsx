import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native'; // Import NavigationContainer
import MainNav from './MainNav';
import './../../global.css'

export default function Index() {
  return (
 
      <MainNav/>
   
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: 'white',
  },
});
