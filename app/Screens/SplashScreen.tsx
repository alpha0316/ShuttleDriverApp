import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";



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

    const checkUserData = async () => {
      try {
        // simulate splash delay
        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (!isMounted) return;

        // 🔎 Check driver first
        const driverDataString = await AsyncStorage.getItem("driverData");
        console.log("📥 DriverData (String):", driverDataString);

        if (driverDataString) {
          const driverData = JSON.parse(driverDataString);
          console.log("📥 DriverData (Parsed):", driverData);

          if (driverData?.userId || driverData?.token) {
            navigation.navigate("Home"); // 🚖 Driver Home
            return;
          }
        }

        // 🔎 If no driver, check rider
        const riderDataString = await AsyncStorage.getItem("riderData");
        console.log("📥 RiderData (String):", riderDataString);

        if (riderDataString) {
          const riderData = JSON.parse(riderDataString);
          console.log("📥 RiderData (Parsed):", riderData);

          if (riderData?.userId) {
            navigation.navigate("HomeDelivery"); // 👤 Rider Home
            return;
          }
        }

        // No stored user → signup
        navigation.navigate("SignUpType");
      } catch (error) {
        console.error("❌ Error checking user data:", error);
        if (isMounted) {
          navigation.navigate("SignUpType");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkUserData();

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
