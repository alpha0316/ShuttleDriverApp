import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MOCK_DRIVER_DATA = {
  driver: {
    id: "DRV001",
    fullName: "Test Driver",
    phoneNumber: "0541234567",
  },
  token: "mock-token-123",
};



type RootStackParamList = {
  SplashScreen: undefined;
  Home: undefined;        // Driver home
  HomeDelivery: undefined; // Rider home ✅
  SignUpType: undefined;
};


type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SplashScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const skipAuth = async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!isMounted) return;
      await AsyncStorage.setItem("userData", JSON.stringify(MOCK_DRIVER_DATA));
      navigation.navigate("Home");
    };

    skipAuth();

    return () => {
      isMounted = false;
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.text}>Shuttle</Text>
        <Text style={[styles.text, styles.subText]}>App</Text>
      </View>

      {isLoading && (
        <ActivityIndicator size="small" color="#000" style={styles.loader} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flexDirection: "row",
  },
  text: {
    fontWeight: "700",
    fontSize: 40,
  },
  subText: {
    color: "rgba(0, 0, 0, 0.50)",
  },
  loader: {
    marginTop: 20,
    position: "absolute",
    bottom: 50,
  },
});
