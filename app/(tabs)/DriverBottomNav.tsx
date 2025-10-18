import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Path } from 'react-native-svg';
import DriversHome from '../screens/Home';
import MapScreen from '../screens/Map';

const Tab = createBottomTabNavigator();

function HomeIcon({ focused }: { focused: boolean }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 14 14" fill="none">
      <Path
        d="M12.8867 4.33999L8.52002 0.846659C7.66668 0.166659 6.33335 0.159992 5.48668 0.839992L1.12002 4.33999C0.493349 4.83999 0.113349 5.83999 0.246683 6.62666L1.08668 11.6533C1.28002 12.78 2.32668 13.6667 3.46668 13.6667H10.5333C11.66 13.6667 12.7267 12.76 12.92 11.6467L13.76 6.61999C13.88 5.83999 13.5 4.83999 12.8867 4.33999ZM7.50002 11C7.50002 11.2733 7.27335 11.5 7.00002 11.5C6.72668 11.5 6.50002 11.2733 6.50002 11V8.99999C6.50002 8.72666 6.72668 8.49999 7.00002 8.49999C7.27335 8.49999 7.50002 8.72666 7.50002 8.99999V11Z"
        fill={focused ? '#34A853' : 'rgba(0,0,0,0.5)'}
      />
    </Svg>
  );
}

function MapIcon({ focused }: { focused: boolean }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 17 16" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.83337 6.00001C3.8336 5.10554 4.09089 4.22999 4.57458 3.4776C5.05828 2.72521 5.74802 2.12767 6.56167 1.75615C7.37532 1.38462 8.27861 1.25475 9.16397 1.38201C10.0493 1.50926 10.8795 1.88828 11.5555 2.47393C12.2316 3.05958 12.7251 3.82718 12.9774 4.68535C13.2296 5.54352 13.2298 6.45609 12.9781 7.3144C12.7264 8.17272 12.2334 8.94062 11.5576 9.52667C10.8819 10.1127 10.052 10.4922 9.16671 10.62V14C9.16671 14.1768 9.09647 14.3464 8.97145 14.4714C8.84642 14.5964 8.67685 14.6667 8.50004 14.6667C8.32323 14.6667 8.15366 14.5964 8.02864 14.4714C7.90361 14.3464 7.83337 14.1768 7.83337 14V10.62C6.72251 10.4597 5.70664 9.90433 4.97198 9.0558C4.23732 8.20727 3.83309 7.12238 3.83337 6.00001ZM7.79337 5.29334C7.98073 5.10575 8.23491 5.00024 8.50004 5.00001C8.67685 5.00001 8.84642 4.92977 8.97145 4.80474C9.09647 4.67972 9.16671 4.51015 9.16671 4.33334C9.16671 4.15653 9.09647 3.98696 8.97145 3.86193C8.84642 3.73691 8.67685 3.66667 8.50004 3.66667C7.8812 3.66667 7.28771 3.9125 6.85013 4.35009C6.41254 4.78767 6.16671 5.38117 6.16671 6.00001C6.16671 6.17682 6.23695 6.34639 6.36197 6.47141C6.48699 6.59643 6.65656 6.66667 6.83337 6.66667C7.01019 6.66667 7.17975 6.59643 7.30478 6.47141C7.4298 6.34639 7.50004 6.17682 7.50004 6.00001C7.50004 5.73467 7.60537 5.48001 7.79337 5.29334Z"
        fill={focused ? '#34A853' : 'rgba(0,0,0,0.5)'}
      />
    </Svg>
  );
}

export default function DriverBottomNav() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          height: 65,
          borderTopColor: '#eee',
        },
      }}
    >
      <Tab.Screen
        name="DriversHome"
        component={DriversHome}
        options={{
          tabBarIcon: ({ focused }) => <HomeIcon focused={focused} />,
        }}
      />
      <Tab.Screen
        name="MapScreen"
        component={MapScreen}
        options={{
          tabBarIcon: ({ focused }) => <MapIcon focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}
