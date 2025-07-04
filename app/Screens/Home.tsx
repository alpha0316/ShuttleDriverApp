import EndingPoint from "@/components/EndingPoint";
import PrimaryButton from "@/components/PrimaryButton";
import StartPoint from "@/components/StartPoint";
import ProfileComponent from "@/components/ui/ProfileComponent";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Mask,
  G
} from "react-native-svg";

interface LocationData {
  coords: {
    accuracy: number;
    altitude: number;
    heading: number;
    latitude: number;
    longitude: number;
    speed: number;
  };
  timestamp: number;
}

interface HomeProps {
  navigation: NativeStackNavigationProp<any>;
}

export default function Home({ navigation }: HomeProps) {
  const [isActiveTrip, setIsActiveTrip] = useState(false);
  const [startPoint, setStartPoint] = useState<string>("");
  const [endPoint, setEndPoint] = useState<string>("");
  const [location, setLocation] = useState<LocationData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [driverID, setDriverID] = useState<string>("");
  const [busID, setBusID] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<any>(null);
  const locationSubscriptionRef = useRef<any>(null);
  const locationIntervalRef = useRef<any>(null);

  const BASE_CUSTOMER_URL = "https://shuttle-backend-0.onrender.com/api/v1";

  // Test network connectivity
  const testConnectivity = async () => {
    try {
      console.log("Testing network connectivity...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch("https://shuttle-backend-0.onrender.com/", {
        method: "HEAD",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log("Server is reachable, status:", response.status);
      return true;
    } catch (error: any) {
      console.error("Server connectivity test failed:", error.message);
      return false;
    }
  };

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        console.log(
          "Attempting to fetch drivers from:",
          `${BASE_CUSTOMER_URL}/drivers/drivers`
        );

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`${BASE_CUSTOMER_URL}/drivers/drivers`, {
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Drivers fetched successfully:", data);
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.error("Request timed out after 10 seconds");
        } else if (err.message?.includes("Network request failed")) {
          console.error(
            "Network error - check internet connection and server status"
          );
        } else {
          console.error("Error fetching drivers:", err.message || err);
        }
      }
    };
    // fetchDrivers();
  }, []);

  const switchStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${BASE_CUSTOMER_URL}/drivers/drivers/switchStatus`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            driverID: busID,
          }),
        }
      );
      const data = await response.json();

      if (response.ok) {
        setIsActiveTrip((previousState) => !previousState);
        console.log(
          `Driver ${busID} is ${!isActiveTrip ? "active" : "inactive"}`
        );
      } else {
        Alert.alert("Error", data.message || "Failed to toggle bus status.");
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Could not toggle bus status.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSwitch = () => {
    switchStatus();
  };

  const handleStartPointChange = (selectedLocation: string) => {
    setStartPoint(selectedLocation);
  };

  const handleEndPointChange = (selectedLocation: string) => {
    setEndPoint(selectedLocation);
  };

  const handleConfirmRoute = () => {
    console.log("Start Point:", startPoint);
    console.log("End Point:", endPoint);
    if (location) {
      console.log("Current Location:", location.coords);
    }
  };

  // Set up location tracking
  useEffect(() => {
    const setupLocationTracking = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setErrorMsg("Permission to access location was denied");
          return;
        }

        // Get initial location
        let currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(currentLocation as LocationData);
        console.log("Initial location:", currentLocation);

        // Start watching position
        const locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 10,
          },
          (newLocation) => {
            setLocation(newLocation as LocationData);
            // console.log("Location updated:", newLocation);
          }
        );

        locationSubscriptionRef.current = locationSubscription;
      } catch (error) {
        console.error("Error setting up location tracking:", error);
        setErrorMsg("Error setting up location tracking");
      }
    };

    setupLocationTracking();

    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }
    };
  }, []);

  // Set up WebSocket connection
  useEffect(() => {
    if (!busID) return;

    const initializeSocket = async () => {
      // Test connectivity first
      const isConnected = await testConnectivity();
      if (!isConnected) {
        setErrorMsg(
          "Cannot reach server. Please check your internet connection."
        );
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const io = require("socket.io-client");

      console.log("Attempting to connect to socket with busID:", busID);

      const socket = io("https://shuttle-backend-0.onrender.com/", {
        transports: ["polling", "websocket"], // Try polling first, then websocket
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 30000,
        forceNew: true,
        upgrade: true,
        rememberUpgrade: false,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("Socket connected successfully with ID:", socket.id);
        setIsConnected(true);
        setErrorMsg("");

        // Emit driver connection with more details
        const driverData = {
          name: driverID || "Unknown Driver",
          shuttleId: busID,
          route:
            startPoint && endPoint
              ? `${startPoint} -> ${endPoint}`
              : "No route set",
          timestamp: Date.now(),
        };

        console.log("Emitting driver-connect with data:", driverData);
        socket.emit("driver-connect", driverData);
      });

      socket.on("disconnect", (reason: string) => {
        console.log("Socket disconnected. Reason:", reason);
        setIsConnected(false);

        // Handle Render.com's known issues
        if (
          reason === "ping timeout" ||
          reason === "io server disconnect" ||
          reason === "transport close"
        ) {
          console.log(
            "Detected Render.com timeout issue, will auto-reconnect..."
          );
          setTimeout(() => {
            if (!socket.connected) {
              console.log("Attempting manual reconnection...");
              socket.connect();
            }
          }, 2000);
        }
      });

      socket.on("connect_error", (error: any) => {
        console.error("Socket connection error details:", {
          message: error.message,
          description: error.description,
          context: error.context,
          type: error.type,
        });

        // Handle Render.com specific errors
        if (
          error.message === "timeout" ||
          error.message?.includes("websocket error")
        ) {
          setErrorMsg(
            "Server connection unstable (Render.com limitation). Retrying..."
          );
        } else {
          setErrorMsg(`Connection failed: ${error.message || "Unknown error"}`);
        }
        setIsConnected(false);
      });

      socket.on("reconnect", (attemptNumber: number) => {
        console.log(
          "Socket reconnected successfully after",
          attemptNumber,
          "attempts"
        );
        setIsConnected(true);
        setErrorMsg("");
      });

      socket.on("reconnect_error", (error: any) => {
        console.error("Socket reconnection failed:", error.message);
        setErrorMsg(`Reconnection failed: ${error.message || "Unknown error"}`);
      });

      socket.on("reconnect_failed", () => {
        console.error("Socket reconnection failed permanently");
        setErrorMsg(
          "Failed to connect to server. Please check your internet connection."
        );
        setIsConnected(false);
      });

      socket.on("driver-locations", (data: any) => {
        console.log("Received driver locations:", data);
      });

      socket.on("bus-stop-updates", (users: any) => {
        console.log("Received bus stop updates:", users);
      });

      // Test connection after a delay
      setTimeout(() => {
        if (!socket.connected) {
          console.log(
            "Socket not connected after timeout, connection status:",
            {
              connected: socket.connected,
              id: socket.id,
              transport: socket.io?.engine?.transport?.name,
            }
          );
        } else {
          console.log(
            "Socket connected successfully with transport:",
            socket.io?.engine?.transport?.name
          );
        }
      }, 5000);
    };

    initializeSocket();

    return () => {
      console.log("Cleaning up socket connection");
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
      if (socketRef.current) {
        socketRef.current.off(); // Remove all listeners
        socketRef.current.disconnect();
      }
    };
  }, [busID, driverID, startPoint, endPoint]);

  // Handle location updates to socket
  useEffect(() => {
    if (!socketRef.current || !location || !isActiveTrip) return;

    const emitLocationUpdate = () => {
      if (socketRef.current?.connected && location && isActiveTrip) {
        const locationData = {
          driverId: busID,
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            altitude: location.coords.altitude,
            heading: location.coords.heading,
            speed: location.coords.speed,
            timestamp: location.timestamp,
          },
          route: `${startPoint} -> ${endPoint}`,
          isActive: isActiveTrip,
        };

        socketRef.current.emit("driver-location-update", locationData);
        console.log("Location emitted:", locationData);
      }
    };

    // Emit location immediately
    emitLocationUpdate();

    // Set up interval for periodic updates
    locationIntervalRef.current = setInterval(emitLocationUpdate, 3000);

    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, [location, isActiveTrip, busID, startPoint, endPoint]);

  useEffect(() => {
    const retrieveUserData = async () => {
      try {
        const userDataString = await AsyncStorage.getItem("userData");
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          console.log("Retrieved User Data:", userData);

          if (userData.driver?.id) {
            setBusID(userData.driver.id);
            setDriverID(userData.driver.fullName || userData.driver.id);
            console.log("Bus ID:", userData.driver.id);
          }
        } else {
          console.log("No user data found in AsyncStorage.");
        }
      } catch (error) {
        console.error("Error retrieving user data:", error);
      }
    };

    retrieveUserData();
  }, []);

  const handleSignOut = async () => {
    try {
      // Disconnect socket before signing out
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      // Clear location tracking
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }

      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }

      await AsyncStorage.removeItem("userToken");
      await AsyncStorage.removeItem("userData");
      console.log("User data cleared from AsyncStorage");

      navigation.navigate("Register");
    } catch (error) {
      console.error("Error signing out:", error);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.main}>
        <View style={styles.contentWrapper}>
          <View style={styles.mainContent}>
            <View style={styles.header}>
              <ProfileComponent />
              <TouchableOpacity
                onPress={() =>
                  Alert.alert("Notifications", "No new notifications")
                }
              >
                <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12.02 2.90997C8.71003 2.90997 6.02003 5.59997 6.02003 8.90997V11.8C6.02003 12.41 5.76003 13.34 5.45003 13.86L4.30003 15.77C3.59003 16.95 4.08003 18.26 5.38003 18.7C9.69003 20.14 14.34 20.14 18.65 18.7C19.86 18.3 20.39 16.87 19.73 15.77L18.58 13.86C18.28 13.34 18.02 12.41 18.02 11.8V8.90997C18.02 5.60997 15.32 2.90997 12.02 2.90997Z"
                    stroke="#828282"
                    strokeWidth="2"
                    strokeMiterlimit="10"
                    strokeLinecap="round"
                  />
                  <Path
                    d="M13.87 3.2C13.56 3.11 13.24 3.04 12.91 3C11.95 2.88 11.03 2.95 10.17 3.2C10.46 2.46 11.18 1.94 12.02 1.94C12.86 1.94 13.58 2.46 13.87 3.2Z"
                    stroke="#828282"
                    strokeWidth="2"
                    strokeMiterlimit="10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M15.02 19.06C15.02 20.71 13.67 22.06 12.02 22.06C11.2 22.06 10.44 21.72 9.89999 21.18C9.35999 20.64 9.01999 19.88 9.01999 19.06"
                    stroke="#828282"
                    strokeWidth="2"
                    strokeMiterlimit="10"
                  />
                </Svg>
              </TouchableOpacity>
            </View>

            {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
            {!isConnected && busID && (
              <Text style={styles.errorText}>
                Location service disconnected
              </Text>
            )}
          </View>

          <View style={{ gap: 12 }}>
            <View
              style={[
                styles.toggleContainer,
                isActiveTrip && styles.activeToggleContainer,
              ]}
            >
              <Text
                style={[
                  styles.toggleText,
                  isActiveTrip && styles.activeToggleText,
                ]}
              >
                {isActiveTrip ? "Active Trip" : "Inactive"}
              </Text>
              <TouchableOpacity
                onPress={toggleSwitch}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                <Svg width="40" height="30" viewBox="0 0 40 20">
                  <Rect
                    width="40"
                    height="20"
                    rx="10"
                    fill={isActiveTrip ? "#1573FE" : "#D9D9D9"}
                    transform={
                      isActiveTrip ? undefined : "matrix(-1 0 0 1 40 0)"
                    }
                  />
                  <Circle
                    cx={isActiveTrip ? 29 : 11}
                    cy="10"
                    r="7.74286"
                    fill="white"
                    stroke="url(#paint0_linear)"
                    strokeWidth="0.514286"
                  />
                  <Defs>
                    <LinearGradient
                      id="paint0_linear"
                      x1={isActiveTrip ? 21 : 0}
                      y1={isActiveTrip ? 2 : 0}
                      x2={isActiveTrip ? 21 : 0}
                      y2={isActiveTrip ? 18 : 16}
                      gradientUnits="userSpaceOnUse"
                    >
                      <Stop stopColor="#F8F8F8" stopOpacity="0.0252353" />
                      <Stop offset="1" stopColor="#EEEEEE" />
                    </LinearGradient>
                  </Defs>
                </Svg>
              </TouchableOpacity>
            </View>

            <Text style={styles.toggleDescription}>
              {isActiveTrip
                ? "You are currently on an active ride"
                : "Switch the button on when you're on an active ride"}
            </Text>
          </View>

          <View style={styles.routesContainer}>
            <Text style={styles.routesTitle}>Routes</Text>


                <View style={{
                  display : 'flex',
                  flexDirection : 'row',
                  alignItems : 'center',
                  justifyContent : 'space-between',
                  padding : 16,
                  borderWidth : 1,
                  borderRadius : 16,
                  borderColor : '#34A853',
                  backgroundColor : '#fafafa'
                }}>

                  <View style={{
                    display : 'flex',
                    gap : 4,
                    alignItems : 'center'
                  }}>
                    <Text style={{
                      fontWeight : '700',
                      fontSize : 14
                    }}>Brunei</Text>
                     <Text style={{
                      fontSize : 10,
                      color : 'rgba(0,0,0,0.5)'
                    }}>Campus</Text>
                    <Text style={{
                      fontSize : 12,
                      color : 'rgba(0,0,0,0.6)',
                      padding : 4,
                      backgroundColor : '#fafafa',
                      borderRadius : 6
                    }}>Start</Text>
                  </View>

                    <View style ={{
                      display : 'flex',
                      flexDirection : 'row',
                      gap : 12,
                      alignItems : 'center'
                    }}>
                      <View style={{
                        width : 60,
                        height : 2,
                        borderRadius : 24,
                        backgroundColor : '#34A853'
                      }}/>
                        <Svg xmlns="http://www.w3.org/2000/svg" width="84" height="27" viewBox="0 0 84 27" fill="none">
                          <Mask id="mask0_933_1781" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="0" width="84" height="27">
                            <Path d="M83.2118 0.595215H0.460938V26.5118H83.2118V0.595215Z" fill="white"/>
                          </Mask>
                          <G mask="url(#mask0_933_1781)">
                            <Path d="M57.5742 5.56278C57.5046 5.70528 57.4365 5.84777 57.3654 5.99472C49.387 6.06596 41.4071 6.13722 33.1859 6.20995C33.1859 10.985 33.1859 15.7614 33.1859 20.6804C33.6613 20.9268 33.9382 20.9283 34.467 20.9372C34.6447 20.9417 34.8224 20.9446 35.0061 20.9491C35.1986 20.9506 35.3911 20.9535 35.5896 20.958C35.7866 20.961 35.985 20.9654 36.1879 20.9699C36.8203 20.9818 37.4528 20.9936 38.0852 21.004C38.916 21.0189 39.7484 21.0352 40.5792 21.0515C40.7718 21.0545 40.9643 21.0574 41.1628 21.0604C41.3405 21.0649 41.5197 21.0678 41.7033 21.0723C41.8603 21.0738 42.0173 21.0767 42.1788 21.0797C42.5668 21.1124 42.5668 21.1124 42.983 21.3291C42.983 21.4716 42.983 21.614 42.983 21.761C30.6014 21.761 18.2199 21.761 5.46372 21.761C5.39559 21.476 5.32597 21.1895 5.25488 20.8971C5.53036 20.8971 5.80584 20.8971 6.08872 20.8971C6.08872 16.4784 6.08872 12.0596 6.08872 7.50573C8.08368 7.50573 10.0786 7.50573 12.1343 7.50573C12.1343 6.86451 12.1343 6.2233 12.1343 5.56278C17.9667 5.52865 23.799 5.49747 29.6314 5.4663C32.3387 5.45294 35.0461 5.43809 37.7549 5.42325C40.1142 5.4084 42.4735 5.39655 44.8328 5.38468C46.0828 5.37874 47.3328 5.37131 48.5828 5.36388C49.7587 5.35646 50.9347 5.35052 52.1091 5.34459C52.5416 5.3431 52.9741 5.34013 53.4065 5.33716C53.9945 5.33419 54.584 5.33123 55.1719 5.32826C55.3452 5.32677 55.517 5.3253 55.6948 5.32382C56.3775 5.32233 56.9225 5.33717 57.5742 5.56278Z" fill="#34A853"/>
                            <Path d="M71.9453 5.466C75.605 4.15833 75.5013 15.7597 75.5013 20.6801C75.9752 20.9265 74.3476 21.0705 74.8748 21.0794C75.054 21.0824 74.5623 21.3273 77.32 20.9473C74.5934 21.3243 74.2765 21.5247 77.4118 21.0349C76.5232 21.1744 75.639 21.3021 74.8748 21.4104C74.8867 21.4104 74.8704 21.4134 74.8304 21.4163C74.3505 21.4846 73.9181 21.544 73.5626 21.593C73.764 21.5885 73.958 21.5841 74.1328 21.5781C74.1713 21.5752 74.2098 21.5707 74.2498 21.5663C74.318 21.5588 74.3876 21.5514 74.4586 21.544C75.091 21.5574 74.2439 21.5321 74.8748 21.544C75.0274 21.547 74.8556 21.5559 74.5209 21.5678C75.5043 21.5722 75.3769 21.6123 75.1888 21.6538C74.9577 21.7058 74.6364 21.7592 76.1263 21.7592H72.4992C71.889 21.777 71.6061 21.7741 71.5469 21.7592H47.7777L47.5703 20.8954H48.4041V7.50543H54.4483V5.56249C60.2806 5.52835 65.913 5.0222 71.9453 5.466Z" fill="#34A853"/>
                            <Path d="M34.4106 6.83203C34.6683 6.83203 34.6683 6.83204 34.9319 6.83353C35.1289 6.83204 35.3259 6.83203 35.5273 6.83203C35.7451 6.83203 35.9628 6.83351 36.1879 6.835C36.4145 6.83351 36.6426 6.83353 36.8781 6.83353C37.6349 6.83501 38.3902 6.83648 39.147 6.83797C39.6713 6.83797 40.1941 6.83797 40.7169 6.83797C41.9551 6.83945 43.1947 6.84093 44.4328 6.8439C46.2279 6.84687 48.0244 6.84688 49.8194 6.84836C52.3342 6.85133 54.8505 6.85579 57.3653 6.85876C57.3653 11.3488 57.3653 15.8388 57.3653 20.4654C49.5928 20.4654 41.8203 20.4654 33.8123 20.4654C33.8078 18.2597 33.8034 16.0555 33.799 13.783C33.7975 13.0869 33.796 12.3893 33.793 11.6709C33.793 11.1217 33.7916 10.574 33.7916 10.0248C33.7916 9.8808 33.7901 9.7383 33.7901 9.58987C33.7886 9.16981 33.7886 8.74975 33.7886 8.3282C33.7886 8.09072 33.7871 7.85324 33.7871 7.60981C33.8212 6.87211 33.8212 6.87211 34.4106 6.83203Z" fill="#34A853"/>
                            <Path d="M80.7109 3.83506C80.7198 4.19426 80.7198 4.55496 80.7109 4.91416C80.3481 5.28969 79.8371 5.21101 79.3439 5.25257C79.027 5.27929 79.027 5.27929 78.7041 5.306C78.5412 5.31936 78.3783 5.33273 78.2095 5.34609C78.2406 5.52124 78.2702 5.69489 78.3013 5.87598C78.3398 6.10605 78.3783 6.33759 78.4183 6.57508C78.4568 6.80218 78.4953 7.03078 78.5353 7.2653C78.6167 7.86199 78.6434 8.41712 78.6271 9.01826C78.833 9.08951 79.0388 9.16074 79.2521 9.23347C79.4846 10.3779 79.532 11.5238 79.4609 12.6889C79.3913 12.7602 79.3232 12.8314 79.2521 12.9056C79.218 13.6611 79.218 13.6612 79.2521 14.4167C79.3202 14.4879 79.3899 14.5592 79.4609 14.6334C79.5513 15.9203 79.5439 17.1047 79.0433 18.3041C78.9056 18.3041 78.7678 18.3041 78.6271 18.3041C78.636 18.5223 78.6434 18.7419 78.6523 18.9661C78.6256 19.8552 78.4746 20.4905 78.2095 21.3276C78.5545 21.3988 78.8981 21.4701 79.2521 21.5443C79.2521 21.6868 79.2521 21.8293 79.2521 21.9762C79.4535 21.9718 79.6564 21.9673 79.8638 21.9629C80.5021 21.9762 80.5021 21.9762 80.7109 22.1915C80.7198 22.6234 80.7198 23.0568 80.7109 23.4873C79.7734 23.4576 78.8359 23.4264 77.897 23.3937C77.6333 23.3848 77.3682 23.3759 77.0957 23.3685C76.838 23.3581 76.5803 23.3492 76.3137 23.3403C76.0782 23.3329 75.8427 23.324 75.5998 23.3166C74.8741 23.272 74.8741 23.272 74.1677 23.1637C72.9325 23.0004 71.6944 23.0271 70.4503 23.0286C70.1704 23.0286 69.8919 23.0286 69.612 23.0286C69.0077 23.0271 68.402 23.0271 67.7977 23.0286C66.8128 23.0286 65.8279 23.0286 64.843 23.0271C63.599 23.0271 62.3549 23.0256 61.1108 23.0256C58.6671 23.0256 56.2234 23.0242 53.7797 23.0197C53.3946 23.0197 53.011 23.0182 52.6259 23.0182C52.0424 23.0167 51.4589 23.0167 50.8753 23.0152C48.6789 23.0123 46.4811 23.0093 44.2847 23.0063C44.0848 23.0063 43.8833 23.0063 43.676 23.0063C40.4192 23.0019 37.1624 23.0019 33.9056 23.0019C30.5614 23.0019 27.2157 22.9989 23.8715 22.9915C21.8084 22.9871 19.7468 22.9856 17.6837 22.9885C16.2708 22.99 14.8579 22.9885 13.4464 22.9826C12.6304 22.9796 11.8158 22.9796 10.9997 22.9826C10.2533 22.9856 9.50833 22.9841 8.76188 22.9781C8.36348 22.9767 7.96509 22.9796 7.56669 22.9841C5.63986 22.9618 5.63985 22.9618 4.99263 22.3384C4.51574 21.577 4.49945 21.0738 4.49945 20.1683C4.49649 19.9338 4.49648 19.9338 4.495 19.6934C4.49056 19.1783 4.49501 18.6647 4.49945 18.1497C4.49945 17.7905 4.49796 17.4313 4.49796 17.0721C4.49648 16.321 4.50093 15.5685 4.50538 14.8174C4.51278 13.8556 4.5113 12.8938 4.50834 11.9305C4.50537 11.1898 4.50833 10.4491 4.5113 9.70696C4.5113 9.35221 4.51129 8.99747 4.5098 8.64272C4.5098 8.14696 4.51427 7.65121 4.51871 7.15545C4.52019 6.87195 4.52166 6.58992 4.52314 6.30048C4.65791 5.36834 4.76308 5.09227 5.46361 4.48222C6.34928 4.3145 7.23049 4.33675 8.128 4.34565C8.40644 4.34417 8.68635 4.3427 8.96627 4.34121C9.73345 4.33676 10.5021 4.33823 11.2693 4.34269C12.0972 4.34417 12.9266 4.34122 13.7545 4.33825C15.1896 4.33379 16.6247 4.33231 18.0599 4.33528C20.1363 4.33825 22.2127 4.33527 24.2891 4.33082C27.66 4.3234 31.0309 4.32042 34.4017 4.32042C37.6733 4.32042 40.9449 4.31895 44.2151 4.31598C44.5172 4.31598 44.5172 4.31597 44.8267 4.31449C47.0246 4.313 49.224 4.31004 51.4233 4.30559C52.0054 4.30559 52.5889 4.30409 53.1724 4.30409C53.5575 4.30261 53.9411 4.30261 54.3262 4.30113C56.7728 4.29816 59.2195 4.29669 61.6662 4.29669C62.9014 4.29669 64.1351 4.29519 65.3703 4.29519C66.3463 4.29371 67.3238 4.29371 68.2998 4.29519C68.8922 4.29519 69.4846 4.2952 70.0771 4.29372C70.4769 4.29372 70.8768 4.29371 71.2767 4.29519C71.5151 4.29519 71.7521 4.29372 71.998 4.29372C72.2023 4.29372 72.4082 4.29372 72.6185 4.29372C73.245 4.26403 73.8404 4.16458 74.458 4.05029C74.7616 4.04732 75.0667 4.05027 75.3703 4.06363C76.5062 4.08144 77.6037 3.92708 78.7234 3.75341C79.4387 3.64803 80.0252 3.57382 80.7109 3.83506ZM54.2403 5.35646C48.1043 5.3817 41.9683 5.41138 35.8339 5.44255C33.2406 5.45591 30.6473 5.46927 28.0539 5.48115C22.7474 5.50786 17.4408 5.53459 12.1342 5.56279C12.1342 6.20401 12.1342 6.84522 12.1342 7.50574C10.1393 7.50574 8.14429 7.50574 6.09008 7.50574C6.09008 11.9245 6.09008 16.3433 6.09008 20.8957C5.745 20.8957 5.4014 20.8957 5.04743 20.8957C5.11556 21.2534 5.18518 21.6096 5.25627 21.9762C27.6111 21.9762 49.966 21.9762 72.9991 21.9762C72.9991 21.8337 72.9991 21.6912 72.9991 21.5443C73.128 21.5235 73.2554 21.5042 73.3887 21.482C73.8463 21.3691 73.8463 21.3691 74.0818 21.0055C75.1126 18.7746 75.16 16.514 75.1481 14.0797C75.1481 13.9268 75.1481 13.774 75.1481 13.6166C75.2459 9.49471 75.2459 9.49472 73.833 5.77802C73.1517 5.32383 72.6022 5.29264 71.8025 5.29561C71.4322 5.29561 71.4322 5.29562 71.0545 5.29413C70.6458 5.2971 70.6458 5.2971 70.2296 5.30007C69.9364 5.30155 69.6416 5.30156 69.3484 5.30156C68.5338 5.30305 67.7192 5.30601 66.9047 5.31046C66.019 5.31492 65.1333 5.31639 64.2477 5.31787C62.2497 5.32232 60.2518 5.33123 58.2539 5.34013C56.9165 5.34607 55.5776 5.35201 54.2403 5.35646Z" fill="#C4C4C3"/>
                            <Path d="M36.9375 10.0977C42.5773 10.0977 48.2186 10.0977 54.0302 10.0977C54.0302 12.4503 54.0302 14.8014 54.0302 17.2253C48.3889 17.2253 42.7491 17.2253 36.9375 17.2253C36.9375 14.8727 36.9375 12.5215 36.9375 10.0977Z" fill="#34A853"/>
                            <Path d="M76.4515 5.10432C76.5966 5.10283 76.7418 5.10284 76.8914 5.10135C77.9755 5.10284 77.9755 5.10285 78.2095 5.34627C78.2939 5.75891 78.365 6.17302 78.4316 6.58862C78.4687 6.81424 78.5042 7.04134 78.5427 7.27438C78.6168 7.86513 78.642 8.42175 78.6271 9.01844C78.833 9.08969 79.0389 9.16092 79.2521 9.23365C79.4847 10.3795 79.5321 11.5239 79.461 12.6891C79.3914 12.7604 79.3232 12.8316 79.2521 12.9058C79.2166 13.6613 79.2166 13.6613 79.2521 14.4169C79.3558 14.5252 79.3558 14.5252 79.461 14.6336C79.5513 15.9204 79.5439 17.1049 79.0433 18.3057C78.9056 18.3057 78.7678 18.3057 78.6271 18.3057C78.6346 18.5239 78.6434 18.7421 78.6523 18.9662C78.6257 19.8553 78.4746 20.4906 78.2095 21.3293C78.485 21.4005 78.7604 21.4718 79.0433 21.5445C79.0433 21.687 79.0433 21.8295 79.0433 21.9764C78.1932 22.1857 77.389 22.2288 76.5167 22.2332C76.1345 22.2377 76.1345 22.2377 75.7465 22.2421C75.083 22.1931 75.083 22.1931 74.458 21.7612C74.5217 21.5846 74.5854 21.4094 74.652 21.2298C76.0072 16.5839 75.9376 9.94613 74.458 5.34627C75.0934 5.01676 75.7539 5.09986 76.4515 5.10432Z" fill="#282828"/>
                            <Path d="M33.1862 6.21179C36.443 6.20585 39.7013 6.20289 42.9596 6.19992C44.4717 6.19844 45.9839 6.19695 47.496 6.19546C48.8141 6.19249 50.1323 6.19102 51.4504 6.19102C52.148 6.19102 52.847 6.18952 53.5446 6.18803C54.3221 6.18655 55.1012 6.18656 55.8787 6.18656C56.1127 6.18508 56.3452 6.18508 56.5852 6.18359C56.797 6.18508 57.0073 6.18507 57.2235 6.18507C57.5005 6.18507 57.5005 6.18507 57.7819 6.18507C58.1995 6.21178 58.1995 6.2118 58.4069 6.42702C58.4276 6.87825 58.432 7.32947 58.4306 7.77922C58.4306 7.92171 58.4306 8.06272 58.4306 8.20818C58.4306 8.67574 58.4291 9.14479 58.4276 9.61383C58.4276 9.93741 58.4276 10.261 58.4261 10.586C58.4261 11.441 58.4231 12.2945 58.4217 13.1494C58.4187 14.0207 58.4187 14.892 58.4172 15.7633C58.4157 17.4747 58.4113 19.1861 58.4069 20.8975C55.1219 20.902 51.8369 20.9064 48.552 20.9079C47.028 20.9094 45.5025 20.9109 43.9771 20.9138C42.6486 20.9153 41.3201 20.9168 39.9916 20.9168C39.2866 20.9183 38.5831 20.9183 37.8781 20.9198C37.0947 20.9212 36.3097 20.9213 35.5247 20.9213C35.2893 20.9227 35.0553 20.9227 34.8124 20.9242C34.4939 20.9242 34.4939 20.9242 34.1681 20.9227C33.983 20.9227 33.7964 20.9242 33.6053 20.9242C33.1862 20.8975 33.1862 20.8975 32.9774 20.6808C32.9566 20.2459 32.9507 19.811 32.9507 19.3746C32.9492 19.0956 32.9492 18.815 32.9492 18.5271C32.9492 18.2198 32.9492 17.9126 32.9492 17.6038C32.9492 17.2906 32.9492 16.9775 32.9492 16.6643C32.9492 16.0067 32.9492 15.3492 32.9507 14.6901C32.9522 13.8471 32.9507 13.0025 32.9492 12.1579C32.9492 11.5108 32.9492 10.8636 32.9492 10.2164C32.9492 9.90474 32.9492 9.59305 32.9492 9.28135C32.9492 8.84645 32.9492 8.41152 32.9507 7.97662C32.9507 7.72874 32.9507 7.48236 32.9507 7.22706C32.9773 6.64373 32.9773 6.64372 33.1862 6.21179ZM33.8112 7.07566C33.7919 7.49275 33.7875 7.91131 33.7875 8.3284C33.7875 8.60003 33.7875 8.87167 33.7875 9.1522C33.789 9.44313 33.7904 9.73405 33.7904 10.025C33.7904 10.2877 33.7919 10.5519 33.7919 10.822C33.7919 11.8091 33.7949 12.7962 33.7979 13.7832C33.8023 15.9889 33.8067 18.1931 33.8112 20.4656C41.5837 20.4656 49.3562 20.4656 57.3657 20.4656C57.3657 15.9755 57.3657 11.4855 57.3657 6.85896C53.2202 6.85302 53.2202 6.85301 49.0763 6.84856C47.3879 6.84708 45.698 6.84559 44.0096 6.84263C42.6486 6.83966 41.2875 6.83965 39.9264 6.83816C39.4066 6.83816 38.8852 6.83669 38.3654 6.83669C37.6382 6.83521 36.9125 6.83372 36.1868 6.83372C35.969 6.83372 35.7513 6.83223 35.5277 6.83223C35.3307 6.83223 35.1338 6.83224 34.9309 6.83372C34.759 6.83224 34.5872 6.83223 34.4095 6.83223C34.017 6.81442 34.0171 6.81442 33.8112 7.07566Z" fill="#34A853" fill-opacity="0.6"/>
                            <Path d="M6.56426 4.34277C6.7094 4.34574 6.85454 4.34872 7.00413 4.35317C7.15964 4.35168 7.31514 4.3502 7.47509 4.3502C7.9979 4.34872 8.51923 4.35465 9.04056 4.3591C9.41378 4.36059 9.78849 4.36059 10.1617 4.3591C11.1777 4.3591 12.1922 4.36504 13.2082 4.37247C14.2701 4.37989 15.3305 4.37988 16.391 4.38137C18.4007 4.38434 20.4105 4.39325 22.4203 4.40513C24.707 4.417 26.9953 4.42294 29.282 4.42739C33.9887 4.43926 38.694 4.45856 43.3993 4.48231C43.3993 4.69605 43.3993 4.90979 43.3993 5.13095C43.2082 5.12946 43.0172 5.12947 42.8187 5.12798C38.1623 5.11462 33.5059 5.10424 28.848 5.09682C26.5969 5.09385 24.3442 5.08938 22.093 5.08196C20.1306 5.07454 18.1682 5.07009 16.2044 5.07009C15.1662 5.06861 14.1265 5.06713 13.0868 5.06119C12.1093 5.05674 11.1303 5.05673 10.1528 5.05673C9.79442 5.05673 9.43451 5.05525 9.07462 5.05376C8.58587 5.04931 8.09566 5.05078 7.60544 5.05227C7.33145 5.05227 7.05745 5.05079 6.77457 5.05079C6.04886 5.1354 5.75709 5.23931 5.25502 5.77811C5.18689 5.99185 5.11727 6.20559 5.04618 6.42675C5.38978 6.42675 5.73488 6.42675 6.08885 6.42675C6.15698 6.14176 6.22657 5.85529 6.29766 5.56288C6.29766 6.13285 6.29766 6.70283 6.29766 7.29061C8.08528 7.29061 9.8744 7.29061 11.7168 7.29061C11.7168 6.71916 11.7168 6.14918 11.7168 5.56288C11.7849 5.56288 11.8545 5.56288 11.9256 5.56288C11.9256 6.2041 11.9256 6.84531 11.9256 7.50582C9.99879 7.50582 8.07345 7.50582 6.08885 7.50582C6.08885 11.8534 6.08885 16.2009 6.08885 20.6805C5.60751 20.6805 5.12617 20.6805 4.63002 20.6805C4.61077 18.7272 4.59595 16.7753 4.58706 14.8235C4.58262 13.9165 4.5767 13.0096 4.56634 12.1027C4.55745 11.227 4.553 10.3527 4.55004 9.47698C4.54856 9.14301 4.5456 8.81054 4.54116 8.47657C4.53524 8.00901 4.53524 7.53997 4.53524 7.07242C4.53376 6.80673 4.53078 6.54104 4.5293 6.26644C4.71443 4.96916 5.27872 4.36355 6.56426 4.34277Z" fill="#BABABA"/>
                            <Path d="M7.57206 4.83595C7.79717 4.83446 7.79717 4.83448 8.02525 4.83448C8.52585 4.83151 9.02792 4.83595 9.52851 4.83892C9.88692 4.83743 10.2468 4.83744 10.6052 4.83744C11.5812 4.83596 12.5572 4.83891 13.5318 4.84188C14.5522 4.84634 15.5712 4.84486 16.5901 4.84634C18.3022 4.84634 20.0128 4.84931 21.7249 4.85525C23.9242 4.86118 26.1236 4.86266 28.3244 4.86415C30.2113 4.86415 32.0996 4.86713 33.9879 4.8701C34.5966 4.87159 35.2053 4.87159 35.8141 4.87307C36.7678 4.87307 37.7216 4.87604 38.6769 4.879C39.0279 4.88049 39.3789 4.88048 39.73 4.88048C40.2068 4.88048 40.6837 4.88345 41.1621 4.88494C41.4287 4.88494 41.6968 4.88641 41.9722 4.88641C42.5661 4.91461 42.5661 4.91462 42.7735 5.13133C43.2148 5.15805 43.6577 5.16992 44.099 5.17586C44.2368 5.17735 44.376 5.18031 44.5181 5.18179C44.9773 5.18922 45.4364 5.19368 45.8955 5.19962C46.2125 5.20407 46.5294 5.20851 46.8478 5.21296C47.6846 5.22483 48.5214 5.23523 49.3597 5.24562C50.2128 5.25749 51.0658 5.26937 51.9204 5.28125C53.5955 5.30351 55.272 5.32578 56.9485 5.34656C56.9485 5.41781 56.9485 5.48905 56.9485 5.56327C42.1589 5.56327 27.3706 5.56327 12.1337 5.56327C12.1337 6.20449 12.1337 6.84569 12.1337 7.50621C11.9959 7.43496 11.8582 7.36373 11.716 7.291C11.3087 7.27319 10.8985 7.26724 10.4897 7.27021C10.1254 7.27021 10.1254 7.27022 9.75364 7.2717C9.4989 7.27319 9.24416 7.27615 8.98053 7.27764C8.72431 7.27912 8.4681 7.27912 8.20299 7.2806C7.56763 7.28357 6.93226 7.28655 6.29689 7.291C6.22876 7.00601 6.15914 6.72103 6.08805 6.42713C5.74445 6.42713 5.40084 6.42713 5.04688 6.42713C5.11945 5.87794 5.20685 5.61225 5.58896 5.21445C6.2732 4.80479 6.78266 4.83446 7.57206 4.83595Z" fill="#CFCFCF"/>
                            <Path d="M5.04785 20.896C5.25372 21.0029 5.25373 21.0029 5.46403 21.1127C5.46403 21.3264 5.46403 21.5402 5.46403 21.7599C17.8455 21.7599 30.2271 21.7599 42.9833 21.7599C42.9833 21.6174 42.9833 21.4749 42.9833 21.3279C39.8879 21.2567 36.7925 21.1854 33.6038 21.1127C33.6038 21.0415 33.6038 20.9687 33.6038 20.896C41.72 20.896 49.8375 20.896 58.1995 20.896C57.9936 21.1097 57.7863 21.3235 57.5745 21.5446C65.2093 21.6515 65.2093 21.6515 72.9996 21.7599C72.9996 21.8311 72.9996 21.9024 72.9996 21.9766C50.6432 21.9766 28.2884 21.9766 5.2552 21.9766C5.18707 21.6188 5.11894 21.2626 5.04785 20.896Z" fill="#34A853"/>
                            <Path d="M4.62891 6.64209C5.11173 6.64209 5.59308 6.64209 6.08923 6.64209C6.08923 11.2761 6.08923 15.9086 6.08923 20.6806C5.60789 20.6806 5.12506 20.6806 4.62891 20.6806C4.62891 16.0481 4.62891 11.4156 4.62891 6.64209Z" fill="#4B4B4B"/>
                            <Path d="M76.3848 5.10156C76.5744 5.10305 76.7625 5.10305 76.958 5.10453C77.2424 5.10305 77.2423 5.10305 77.5312 5.10156C78.0006 5.13125 78.0007 5.13126 78.2095 5.34649C78.2924 5.75912 78.3635 6.17323 78.4302 6.58883C78.4672 6.81445 78.5042 7.04006 78.5412 7.2731C78.6168 7.86533 78.6419 8.42196 78.6256 9.01865C78.8315 9.0899 79.0389 9.16113 79.2507 9.23386C79.5543 10.7286 79.7098 12.1728 79.0418 13.5532C78.2865 13.5532 77.5297 13.5532 76.7492 13.5532C76.7151 13.0723 76.7151 13.0723 76.681 12.581C76.5107 10.3174 76.3049 8.11619 75.8087 5.90161C75.7761 5.71904 75.7421 5.53499 75.708 5.34649C75.9154 5.13126 75.9154 5.13125 76.3848 5.10156Z" fill="#3E3E3E"/>
                            <Path d="M36.9375 10.0977C42.5773 10.0977 48.2186 10.0977 54.0302 10.0977C54.0302 12.4503 54.0302 14.8014 54.0302 17.2253C48.3889 17.2253 42.7491 17.2253 36.9375 17.2253C36.9375 14.8727 36.9375 12.5215 36.9375 10.0977ZM37.3537 10.5296C37.3537 12.5972 37.3537 14.6634 37.3537 16.7934C42.7195 16.7934 48.0853 16.7934 53.6126 16.7934C53.6126 14.7257 53.6126 12.6596 53.6126 10.5296C48.2467 10.5296 42.8824 10.5296 37.3537 10.5296Z" fill="#D4D4D4"/>
                            <Path d="M80.7083 3.83506C80.7172 4.19575 80.7172 4.55494 80.7083 4.91563C80.3336 5.30452 79.7575 5.18282 79.2495 5.19915C78.9962 5.20805 78.7429 5.21695 78.4823 5.22734C78.2157 5.23477 77.9476 5.24367 77.6736 5.25257C77.4056 5.26148 77.139 5.27187 76.8635 5.28077C76.2 5.30452 75.5365 5.3253 74.873 5.34756C74.873 5.99324 74.9782 6.57213 75.0952 7.20444C75.6254 10.1745 75.5587 13.1372 75.498 16.1459C75.4299 16.1459 75.3603 16.1459 75.2892 16.1459C75.2847 15.9782 75.2788 15.8104 75.2744 15.6382C75.2492 14.8709 75.224 14.105 75.1988 13.3376C75.1899 13.0748 75.1825 12.8106 75.1736 12.539C75.0655 8.96778 75.0655 8.96778 73.6215 5.7795C73.0543 5.58357 72.6588 5.52271 72.0694 5.49451C71.8931 5.4856 71.7154 5.47671 71.5333 5.4678C71.3496 5.4589 71.166 5.44999 70.9779 5.44108C70.7913 5.43217 70.6046 5.42327 70.4136 5.41288C69.9544 5.39062 69.4953 5.36834 69.0362 5.34756C69.0362 5.20507 69.0362 5.06258 69.0362 4.91563C65.3218 4.91563 61.6073 4.91563 57.7803 4.91563C57.7803 4.84438 57.7803 4.77314 57.7803 4.69893C57.9239 4.69744 58.0691 4.69448 58.2172 4.69299C59.5901 4.67073 60.963 4.64847 62.336 4.6262C63.0424 4.61433 63.7474 4.60244 64.4538 4.59205C69.4731 4.58759 69.4731 4.5876 74.4553 4.05176C74.7604 4.04731 75.064 4.05177 75.3677 4.06513C76.5036 4.08294 77.6011 3.92856 78.7222 3.75341C79.4361 3.64803 80.0226 3.57382 80.7083 3.83506Z" fill="#BAB0A5"/>
                            <Path d="M43.4251 11.1763C43.6769 11.2104 43.6769 11.2104 43.9331 11.246C44.1849 11.2787 44.1849 11.2787 44.4411 11.3113C44.8573 11.3945 44.8573 11.3945 45.0661 11.6097C45.0868 12.2153 45.0957 12.8135 45.0928 13.4191C45.0942 13.6714 45.0942 13.6714 45.0942 13.9296C45.0942 14.651 45.0794 15.2418 44.8573 15.929C44.5285 15.9409 44.1982 15.9498 43.8679 15.9572C43.6843 15.9617 43.5006 15.9661 43.3111 15.9721C42.7468 15.9275 42.4343 15.7628 41.9396 15.4971C41.8019 15.5683 41.6641 15.6396 41.5234 15.7138C41.5234 14.5026 41.5234 13.2899 41.5234 12.0416C41.867 11.8991 42.2106 11.7566 42.5646 11.6097C42.9823 11.1778 42.9823 11.1778 43.4251 11.1763Z" fill="#E5E7E6"/>
                            <Path d="M79.0418 13.7695C79.6313 14.8026 79.5439 15.8416 79.4595 17.0098C79.2507 17.8054 79.2507 17.8054 79.0418 18.3056C78.9041 18.3056 78.7663 18.3056 78.6256 18.3056C78.6375 18.6321 78.6375 18.6321 78.6508 18.9661C78.6242 19.8567 78.4731 20.4905 78.208 21.3291C78.4835 21.4003 78.7589 21.4716 79.0418 21.5443C79.0418 21.6868 79.0418 21.8293 79.0418 21.9763C78.1236 22.2152 77.2735 22.2093 76.333 22.193C76.5389 22.0861 76.5389 22.0861 76.7492 21.9763C76.7447 21.7314 76.7403 21.4864 76.7359 21.2341C76.7492 20.4652 76.7492 20.4652 76.958 20.2485C77.4823 18.2121 77.4986 16.0791 77.583 13.9863C78.208 13.7695 78.208 13.7695 79.0418 13.7695Z" fill="#595959"/>
                            <Path d="M75.9149 5.13107C76.4555 7.96164 76.8953 10.6616 76.7487 13.553C77.5055 13.553 78.2623 13.553 79.0414 13.553C79.0414 13.6243 79.0414 13.6955 79.0414 13.7697C77.9409 13.7697 76.8405 13.7697 75.706 13.7697C75.6512 13.3066 75.5964 12.8435 75.5387 12.3656C75.4839 11.9114 75.4291 11.4572 75.3728 11.0045C75.3358 10.6913 75.2973 10.3781 75.2603 10.0649C74.9789 7.6826 74.9789 7.68259 74.4561 5.3463C74.97 5.08061 75.3476 5.11474 75.9149 5.13107Z" fill="#212121"/>
                            <Path d="M50.0698 11.395C50.4134 11.4663 50.7571 11.5375 51.111 11.6103C51.1806 11.8952 51.2487 12.1802 51.3198 12.4741C51.5953 12.4741 51.8708 12.4741 52.1537 12.4741C52.1537 12.7591 52.1537 13.0441 52.1537 13.338C51.4502 13.2222 50.7585 13.099 50.0698 12.906C50.1083 13.0352 50.1468 13.1643 50.1868 13.2979C50.2787 13.7699 50.2787 13.7699 50.0698 14.4186C50.4134 14.4186 50.7571 14.4186 51.111 14.4186C51.111 14.2761 51.111 14.1336 51.111 13.9866C51.4561 13.9154 51.7997 13.8441 52.1537 13.7699C52.1537 14.1261 52.1537 14.4824 52.1537 14.8505C51.8782 14.8505 51.6042 14.8505 51.3198 14.8505C51.2517 15.1355 51.1821 15.4205 51.111 15.7144C50.7674 15.7856 50.4238 15.8568 50.0698 15.9296C50.018 15.796 49.9662 15.6624 49.9128 15.5244C49.6507 14.9663 49.6507 14.9662 48.8184 14.6338C48.8184 13.85 48.8184 13.0663 48.8184 12.2589C49.1634 12.1876 49.507 12.1164 49.861 12.0422C49.9306 11.8284 49.9988 11.6147 50.0698 11.395Z" fill="#CCCCCC"/>
                            <Path d="M6.50471 5.77832C8.2242 5.77832 9.94371 5.77832 11.7165 5.77832C11.7165 6.27853 11.7165 6.77725 11.7165 7.29082C9.92742 7.29082 8.1398 7.29082 6.2959 7.29082C6.36551 6.7921 6.43362 6.29337 6.50471 5.77832Z" fill="#D7D7D7"/>
                            <Path d="M77.165 5.13086C77.6804 5.23773 77.6804 5.23774 78.2077 5.34609C78.2773 5.75576 78.3469 6.16541 78.415 6.57508C78.455 6.80366 78.4935 7.03078 78.5335 7.2653C78.6135 7.86199 78.6416 8.41712 78.6239 9.01826C78.8312 9.08951 79.0371 9.16074 79.2489 9.23347C79.4799 10.369 79.5717 11.5342 79.4577 12.6904C79.32 12.9042 79.1822 13.1179 79.0415 13.3376C78.766 13.3376 78.4906 13.3376 78.2077 13.3376C78.1958 13.1565 78.184 12.9754 78.1721 12.7899C78.1292 12.119 78.0848 11.4481 78.0403 10.7772C78.0211 10.4877 78.0033 10.1968 77.984 9.90736C77.9574 9.49027 77.9293 9.07317 77.9026 8.65608C77.8848 8.40375 77.8685 8.1529 77.8522 7.89463C77.8256 7.30091 77.8256 7.30092 77.5812 6.85859C77.5857 6.64485 77.5901 6.43112 77.5945 6.20996C77.6538 5.53757 77.6538 5.53756 77.165 5.13086Z" fill="#717171"/>
                            <Path d="M80.7092 3.83543C80.7181 4.19463 80.7181 4.55531 80.7092 4.916C80.5018 5.13122 80.5018 5.13122 79.8842 5.15646C79.6147 5.15497 79.3451 5.15348 79.0667 5.15199C78.8519 5.15199 78.852 5.15199 78.6342 5.15199C78.1751 5.15051 77.716 5.14756 77.2569 5.14459C76.9473 5.1431 76.6363 5.14311 76.3268 5.14162C75.564 5.14014 74.8013 5.13568 74.04 5.13123C74.04 4.77499 74.04 4.41875 74.04 4.05213C74.1807 4.05658 74.3229 4.06105 74.4695 4.06699C75.9224 4.09519 77.3102 3.97939 78.7438 3.75378C79.4518 3.64839 80.0279 3.57716 80.7092 3.83543Z" fill="#C0C0C0"/>
                            <Path d="M77.596 13.7549C77.8996 13.7623 77.8996 13.7623 78.2077 13.7697C78.0018 13.841 77.796 13.9122 77.5827 13.9849C77.5871 14.2388 77.593 14.4911 77.5975 14.7523C77.6227 16.6374 77.5871 18.4037 77.1665 20.2487C77.131 20.4343 77.0969 20.6198 77.0613 20.8113C76.9577 21.3278 76.9577 21.3278 76.7488 21.9764C76.3193 22.1249 76.3194 22.1249 75.915 22.1917C76.0232 21.2195 76.1594 20.2651 76.3327 19.3032C76.5578 17.957 76.6259 16.6181 76.6778 15.2555C76.7385 13.7742 76.7385 13.7742 77.596 13.7549Z" fill="#444444"/>
                            <Path d="M7.538 4.85208C7.74386 4.85208 7.74386 4.85209 7.95565 4.85357C8.39256 4.85803 8.82947 4.86544 9.26786 4.87434C9.56555 4.87731 9.86176 4.88028 10.1595 4.88324C10.8866 4.89067 11.6138 4.90107 12.3425 4.91443C12.2729 5.76939 12.2048 6.62582 12.1337 7.50601C12.0641 7.50601 11.9959 7.50601 11.9249 7.50601C11.8212 6.65105 11.8212 6.65107 11.716 5.7783C9.99653 5.7783 8.27703 5.7783 6.5057 5.7783C6.43609 5.92079 6.36798 6.06328 6.29689 6.21023C6.08806 6.42694 6.08805 6.42694 5.55488 6.4403C5.3031 6.43288 5.3031 6.43287 5.04688 6.42693C5.11945 5.87477 5.20683 5.61204 5.59042 5.21276C6.26578 4.80754 6.76045 4.84169 7.538 4.85208Z" fill="#C5C5C5"/>
                            <Path d="M78.417 13.9849C78.6243 13.9849 78.8302 13.9849 79.0435 13.9849C79.6625 14.9482 79.5411 15.8788 79.4596 17.0084C79.2508 17.8055 79.2508 17.8055 79.0435 18.3042C78.9057 18.3042 78.768 18.3042 78.6258 18.3042C78.6391 18.6322 78.6391 18.6322 78.6525 18.9662C78.6243 19.8553 78.4733 20.4906 78.2096 21.3277C78.4836 21.399 78.7591 21.4702 79.0435 21.5444C79.0435 21.6869 79.0435 21.8294 79.0435 21.9764C78.1149 22.0832 78.1149 22.0832 77.167 22.1916C77.3047 21.9779 77.4425 21.7641 77.5832 21.5444C77.6676 21.1244 77.7357 20.6999 77.792 20.2754C77.9579 19.0478 77.9579 19.0478 78.22 18.4556C78.5118 17.5932 78.4614 16.7679 78.4437 15.861C78.4422 15.6814 78.4392 15.5003 78.4377 15.3148C78.4333 14.871 78.4259 14.4287 78.417 13.9849Z" fill="#848484"/>
                            <Path d="M79.0433 21.5444C79.1129 21.6869 79.181 21.8294 79.2521 21.9764C79.455 21.9719 79.6565 21.9675 79.8653 21.963C80.5036 21.9764 80.5036 21.9764 80.711 22.1931C80.7199 22.6235 80.7199 23.0569 80.711 23.4889C79.7601 23.4577 78.8093 23.4265 77.8585 23.3939C77.5889 23.385 77.3194 23.3761 77.0409 23.3687C76.7818 23.3583 76.5211 23.3494 76.253 23.3405C76.0146 23.333 75.7761 23.3241 75.5288 23.3167C74.9438 23.2766 74.4032 23.192 73.833 23.0569C73.9707 22.7705 74.1085 22.4855 74.2492 22.1931C74.3188 22.3356 74.3869 22.4781 74.458 22.625C75.9716 22.5538 77.4853 22.4825 79.0433 22.4083C78.9752 22.2658 78.9071 22.1233 78.836 21.9764C78.9041 21.8339 78.9737 21.6914 79.0433 21.5444Z" fill="#CECCCB"/>
                            <Path d="M76.751 5.13086C77.2664 5.23773 77.2664 5.23774 77.7922 5.34609C77.7892 5.58655 77.7847 5.82847 77.7803 6.07635C77.7373 6.82296 77.7373 6.82297 78.001 7.29053C78.0513 7.86347 78.0898 8.43047 78.118 9.0049C78.1269 9.16965 78.1357 9.33292 78.1446 9.50213C78.2098 10.7816 78.2335 12.0566 78.2098 13.3376C78.4853 13.4088 78.7593 13.4801 79.0436 13.5543C78.7 13.5543 78.3549 13.5543 78.001 13.5543C77.6633 12.9339 77.5285 12.4707 77.5048 11.7612C77.4989 11.5861 77.4915 11.4095 77.4841 11.2284C77.4782 11.0473 77.4722 10.8662 77.4678 10.6792C77.4248 9.46205 77.3567 8.27757 77.1672 7.0738C77.099 7.0738 77.0294 7.0738 76.9583 7.0738C76.8902 6.43258 76.8221 5.79138 76.751 5.13086Z" fill="#5C5C5C"/>
                            <Path d="M56.9475 21.9766C57.1534 21.9766 57.3592 21.9766 57.5725 21.9766C57.5725 22.1191 57.5725 22.2615 57.5725 22.4085C58.6729 22.4085 59.7733 22.4085 60.9078 22.4085C60.9078 22.4797 60.9078 22.551 60.9078 22.6252C57.3074 22.9235 53.71 22.8241 50.1051 22.7558C49.2757 22.7395 48.4463 22.7261 47.6184 22.7113C46.0026 22.6846 44.3883 22.6549 42.7725 22.6252C42.7725 22.4827 42.7725 22.3387 42.7725 22.1933C42.9472 22.1933 43.122 22.1933 43.3012 22.1948C44.9422 22.1977 46.5832 22.2022 48.2242 22.2037C49.0684 22.2051 49.9126 22.2066 50.7568 22.2096C51.5699 22.2111 52.3829 22.2126 53.1975 22.2126C53.5085 22.214 53.8196 22.214 54.1306 22.2155C54.5645 22.217 54.9985 22.217 55.4324 22.217C55.8042 22.2185 55.8041 22.2185 56.1833 22.2185C56.7224 22.2586 56.7224 22.2586 56.9475 21.9766Z" fill="#A8A8A8"/>
                            <Path d="M42.9816 11.1777C43.4052 11.197 43.4052 11.197 43.9206 11.2594C44.1753 11.2876 44.1753 11.2876 44.4345 11.3173C44.8581 11.3944 44.8581 11.3944 45.0669 11.6097C45.095 12.1871 45.0758 12.76 45.0669 13.3374C44.704 13.4784 44.704 13.4784 44.2331 13.5541C43.7858 13.3389 43.7858 13.3389 43.3459 13.0272C43.1993 12.9247 43.0527 12.8223 42.9001 12.7169C42.7891 12.6368 42.6795 12.5566 42.5654 12.4735C42.7476 11.4211 42.7476 11.4212 42.9816 11.1777Z" fill="#CBCCCC"/>
                            <Path d="M42.2678 13.7549C42.5181 13.7623 42.5181 13.7623 42.7758 13.7697C42.7758 13.9835 42.7758 14.1972 42.7758 14.4169C43.1194 14.4881 43.463 14.5594 43.817 14.6336C43.9473 15.0373 43.9473 15.0373 44.0258 15.4975C43.8881 15.6399 43.7504 15.7824 43.6097 15.9294C43.1135 15.8477 43.1135 15.8478 42.567 15.7127C42.2915 15.7127 42.0161 15.7127 41.7332 15.7127C41.6636 15.7127 41.5954 15.7127 41.5243 15.7127C41.5036 14.3842 41.5036 14.3842 41.5243 13.9849C41.7332 13.7697 41.7332 13.7697 42.2678 13.7549Z" fill="#C8C9C9"/>
                            <Path d="M69.8721 21.9767C70.4112 21.9708 70.9488 21.9663 71.4879 21.9633C71.6404 21.9618 71.7915 21.9604 71.9485 21.9589C72.6831 21.9544 73.3348 21.9871 74.0412 22.1934C73.9731 22.4784 73.9035 22.7634 73.8324 23.0573C72.5261 22.986 71.2183 22.9148 69.8721 22.8406C69.8721 22.5556 69.8721 22.2706 69.8721 21.9767Z" fill="#B8A898"/>
                            <Path d="M79.0415 13.9851C78.8342 13.9851 78.6283 13.9851 78.415 13.9851C78.4358 14.2538 78.455 14.521 78.4758 14.7985C78.4995 15.1518 78.5232 15.5065 78.5454 15.8613C78.5587 16.0379 78.5735 16.2146 78.5869 16.3956C78.6476 17.3768 78.6357 18.0521 78.2077 18.9531C78.1277 19.4548 78.0566 19.9594 77.9989 20.4641C77.9307 20.4641 77.8611 20.4641 77.79 20.4641C77.79 18.3267 77.79 16.1878 77.79 13.9851C78.3099 13.7165 78.5009 13.8174 79.0415 13.9851ZM77.5812 20.4641C77.6508 20.4641 77.7189 20.4641 77.79 20.4641C77.79 20.9628 77.79 21.463 77.79 21.9766C77.5842 21.9766 77.3783 21.9766 77.165 21.9766C77.3472 20.951 77.3472 20.951 77.5812 20.4641Z" fill="#6C6C6C"/>
                            <Path d="M43.3993 4.48242C43.3993 4.69616 43.3993 4.9099 43.3993 5.13106C39.2035 5.13106 35.0077 5.13106 30.6846 5.13106C30.6846 4.98856 30.6846 4.84607 30.6846 4.69912C32.25 4.67092 33.8155 4.64271 35.381 4.61451C36.1082 4.60115 36.8353 4.58779 37.5625 4.57592C38.3978 4.55959 39.2331 4.54476 40.0685 4.52992C40.3306 4.52546 40.5913 4.52101 40.8608 4.51655C41.2237 4.50913 41.2237 4.50913 41.5939 4.50319C41.8072 4.49874 42.0205 4.49578 42.2397 4.49132C42.6262 4.48539 43.0128 4.48242 43.3993 4.48242Z" fill="#ABABAB"/>
                            <Path d="M57.7812 4.69873C61.7712 4.69873 65.7611 4.69873 69.871 4.69873C69.871 4.91247 69.871 5.12622 69.871 5.34589C69.5955 5.34589 69.32 5.34589 69.0372 5.34589C69.0372 5.2034 69.0372 5.06091 69.0372 4.91396C65.3227 4.91396 61.6083 4.91396 57.7812 4.91396C57.7812 4.84271 57.7812 4.77146 57.7812 4.69873Z" fill="#B5B5B5"/>
                            <Path d="M48.8184 11.1782C49.9188 11.1782 51.0207 11.1782 52.1537 11.1782C52.2233 11.8907 52.2914 12.6031 52.3625 13.3379C52.087 13.1954 51.8115 13.0529 51.5287 12.9059C51.7345 12.9059 51.9419 12.9059 52.1537 12.9059C52.1537 12.7634 52.1537 12.6209 52.1537 12.474C51.8782 12.474 51.6042 12.474 51.3198 12.474C51.1821 12.189 51.0444 11.904 50.9037 11.6102C50.095 11.5166 50.095 11.5166 49.7055 11.9337C49.6181 12.0406 49.5322 12.1475 49.4448 12.2588C49.2375 12.1875 49.0316 12.1163 48.8184 12.0421C48.8184 11.7571 48.8184 11.4721 48.8184 11.1782Z" fill="#DDDEDE"/>
                            <Path d="M48.8177 14.6333C49.4768 14.9302 49.65 15.0638 50.0692 15.7139C50.4128 15.6426 50.7564 15.5714 51.1118 15.4972C51.18 15.2834 51.2481 15.0697 51.3192 14.85C51.6643 14.9213 52.0079 14.9925 52.3618 15.0652C52.2937 15.4215 52.2241 15.7777 52.153 16.1458C51.1222 16.1458 50.0899 16.1458 49.0265 16.1458C48.8888 15.7896 48.7511 15.4333 48.6104 15.0652C48.6785 14.9227 48.7481 14.7802 48.8177 14.6333Z" fill="#E0E0E0"/>
                            <Path d="M52.154 13.7695C52.154 14.1258 52.154 14.482 52.154 14.8486C51.8785 14.8486 51.6045 14.8486 51.3202 14.8486C51.2521 15.1336 51.1824 15.4186 51.1113 15.7125C50.7677 15.7837 50.4241 15.855 50.0702 15.9292C49.8347 14.9035 49.8347 14.9035 50.0702 14.4167C50.4138 14.4167 50.7574 14.4167 51.1113 14.4167C51.1113 14.2742 51.1113 14.1317 51.1113 13.9848C51.529 13.7695 51.529 13.7695 52.154 13.7695Z" fill="#9E9E9E"/>
                            <Path d="M17.9717 21.9766C17.9717 22.1191 17.9717 22.2615 17.9717 22.4085C20.7916 22.4085 23.6115 22.4085 26.5173 22.4085C26.5173 22.4797 26.5173 22.551 26.5173 22.6237C23.2842 22.695 20.0525 22.7662 16.7217 22.8404C16.7217 22.6267 16.7217 22.4115 16.7217 22.1918C17.3467 21.9766 17.3467 21.9766 17.9717 21.9766Z" fill="#B5B5B5"/>
                            <Path d="M6.92285 5.99316C8.29874 5.99316 9.67461 5.99316 11.092 5.99316C11.092 6.20839 11.092 6.42215 11.092 6.64182C9.71608 6.64182 8.34021 6.64182 6.92285 6.64182C6.92285 6.42808 6.92285 6.21433 6.92285 5.99316Z" fill="#34A853"/>
                            <Path d="M45.0682 13.9847C45.0001 14.6274 44.9305 15.2686 44.8594 15.9291C44.4476 15.9291 44.0344 15.9291 43.6094 15.9291C43.6434 15.7688 43.6775 15.6085 43.713 15.4437C43.8419 14.8085 43.8419 14.8084 43.8182 13.9847C44.2344 13.7694 44.2344 13.7694 45.0682 13.9847Z" fill="#DEDEDE"/>
                            <Path d="M74.6649 6.85889C74.8026 6.93013 74.9389 7.00286 75.0811 7.07559C75.8838 9.93436 75.5357 13.2087 75.4987 16.1462C75.4291 16.1462 75.361 16.1462 75.2899 16.1462C75.2825 15.8953 75.2825 15.8953 75.2736 15.6385C75.2499 14.8712 75.2247 14.1053 75.198 13.3394C75.1906 13.0752 75.1818 12.8109 75.1744 12.5393C75.1225 10.1644 75.1225 10.1644 74.6382 7.85781C74.5775 7.67079 74.5183 7.48378 74.4561 7.29082C74.5242 7.14833 74.5938 7.00583 74.6649 6.85889Z" fill="#B0B0B0"/>
                            <Path d="M78.2096 21.7612C78.6229 21.9037 79.0346 22.0462 79.4611 22.1932C79.0435 22.6251 79.0435 22.6251 78.5947 22.6741C78.4125 22.6711 78.2318 22.6696 78.0452 22.6667C77.8497 22.6652 77.6528 22.6637 77.4513 22.6622C77.2455 22.6592 77.0396 22.6548 76.8293 22.6518C76.622 22.6489 76.4146 22.6474 76.2013 22.6459C75.6904 22.64 75.178 22.634 74.667 22.6251C74.667 22.4114 74.667 22.1961 74.667 21.9765C74.904 21.9794 75.1424 21.9809 75.3883 21.9839C75.6993 21.9869 76.0103 21.9883 76.3213 21.9898C76.4783 21.9913 76.6353 21.9943 76.7982 21.9958C77.1981 21.9972 77.5994 21.9883 78.0008 21.9765C78.0704 21.9052 78.1386 21.834 78.2096 21.7612Z" fill="#B8B8B8"/>
                            <Path d="M77.1672 6.85693C77.2354 6.85693 77.305 6.85693 77.376 6.85693C77.5701 8.31749 77.6515 9.76619 77.7108 11.2386C77.7182 11.4138 77.7256 11.5874 77.7345 11.767C77.7404 11.9243 77.7463 12.0802 77.7537 12.242C77.7937 12.6977 77.8826 13.1133 78.001 13.5526C77.7952 13.4814 77.5878 13.4101 77.376 13.3374C77.305 12.6175 77.2354 11.8976 77.1672 11.1778C77.148 10.9759 77.1272 10.774 77.1065 10.5662C76.9969 9.39511 76.9169 8.24921 76.9584 7.07364C77.028 7.00239 77.0961 6.93115 77.1672 6.85693Z" fill="#4D4D4D"/>
                            <Path d="M74.0381 4.05176C75.4821 4.15863 75.4821 4.15863 76.9557 4.26699C76.9557 4.33824 76.9557 4.40948 76.9557 4.48369C77.5748 4.59056 77.5748 4.59057 78.2058 4.69892C78.2058 4.77017 78.2058 4.84141 78.2058 4.91562C76.8313 4.98687 75.4554 5.05812 74.0381 5.13085C74.0381 4.77462 74.0381 4.41838 74.0381 4.05176Z" fill="#CCCAC9"/>
                            <Path d="M57.5728 4.48389C57.5728 4.76887 57.5728 5.05386 57.5728 5.34775C57.4706 5.31361 57.3669 5.27949 57.2603 5.24386C56.5316 5.08653 55.8044 5.08058 55.0624 5.06276C54.901 5.05831 54.741 5.05385 54.5752 5.0494C54.0627 5.03604 53.5518 5.02268 53.0393 5.01081C52.6913 5.00042 52.3432 4.99152 51.9967 4.98261C51.1451 4.95886 50.295 4.9366 49.4434 4.91582C49.4434 4.84457 49.4434 4.77333 49.4434 4.69912C50.5008 4.66943 51.5583 4.63827 52.6158 4.6071C52.9756 4.59671 53.3341 4.5863 53.6939 4.57591C54.2108 4.56107 54.7277 4.54622 55.2446 4.53138C55.406 4.52693 55.5675 4.521 55.7334 4.51655C56.3465 4.49873 56.9596 4.48389 57.5728 4.48389Z" fill="#A2A2A2"/>
                            <Path d="M78.4163 13.9849C78.6222 13.9849 78.8295 13.9849 79.0413 13.9849C79.0413 15.1975 79.0413 16.4087 79.0413 17.657C78.9036 17.7283 78.7673 17.7995 78.6251 17.8723C78.3734 17.0915 78.3941 16.3776 78.403 15.5642C78.4045 15.4128 78.406 15.2614 78.406 15.1055C78.4089 14.7315 78.4119 14.3589 78.4163 13.9849Z" fill="#959595"/>
                            <Path d="M51.112 12.689C51.1801 12.9027 51.2497 13.1164 51.3208 13.3376C51.74 13.4949 51.7399 13.4949 52.1532 13.5528C51.8096 13.6953 51.466 13.8378 51.112 13.9848C51.112 14.1273 51.112 14.2698 51.112 14.4167C50.7684 14.4167 50.4233 14.4167 50.0693 14.4167C50.0693 13.918 50.0693 13.4192 50.0693 12.9057C50.4129 12.8344 50.758 12.7632 51.112 12.689Z" fill="#E6E6E6"/>
                            <Path d="M43.4009 4.69922C45.3944 4.69922 47.3893 4.69922 49.445 4.69922C49.445 4.77047 49.445 4.84172 49.445 4.91445C49.3251 4.92039 49.2036 4.92633 49.0792 4.93078C45.9231 5.06734 45.9231 5.06733 42.7744 5.34638C42.9818 5.27514 43.1876 5.20388 43.4009 5.13115C43.4009 4.98866 43.4009 4.84616 43.4009 4.69922Z" fill="#B8B8B8"/>
                            <Path d="M74.8722 17.4419C75.01 17.4419 75.1477 17.4419 75.2899 17.4419C75.2662 17.9273 75.2395 18.4141 75.2114 18.8995C75.1892 19.3047 75.1892 19.3047 75.167 19.7188C75.0914 20.3808 74.9981 20.7712 74.6634 21.3293C74.4131 19.9266 74.542 18.8223 74.8722 17.4419Z" fill="#B6B6B6"/>
                            <Path d="M78.4146 7.93896C78.4843 7.93896 78.5524 7.93896 78.6235 7.93896C78.6531 8.18388 78.6842 8.42879 78.7153 8.68112C78.7508 9.40843 78.7508 9.40843 79.0411 9.6667C79.0559 10.1016 79.0574 10.5395 79.053 10.9759C79.0515 11.2133 79.05 11.4523 79.0485 11.6987C79.0456 11.8828 79.0426 12.0668 79.0411 12.2583C78.9715 12.2583 78.9034 12.2583 78.8323 12.2583C78.8323 11.8308 78.8323 11.4019 78.8323 10.9625C78.6946 10.9625 78.5568 10.9625 78.4146 10.9625C78.2251 9.88786 78.2251 9.01212 78.4146 7.93896Z" fill="#A0A0A0"/>
                            <Path d="M78.8348 14.4185C79.0407 14.4897 79.248 14.5609 79.4598 14.6337C79.5368 17.1228 79.5368 17.1228 79.0436 18.3058C78.9059 18.3058 78.7682 18.3058 78.626 18.3058C78.6956 18.0921 78.7637 17.8784 78.8348 17.6572C78.8496 17.1021 78.8541 16.5529 78.8481 15.9978C78.8467 15.7707 78.8467 15.7707 78.8452 15.5376C78.8422 15.1651 78.8393 14.791 78.8348 14.4185Z" fill="#5E5E5E"/>
                            <Path d="M42.3573 11.8267C42.5631 12.1116 42.769 12.3966 42.9823 12.6905C42.7216 13.0141 42.7216 13.0141 42.3573 13.3392C42.0818 13.3392 41.8063 13.3392 41.5234 13.3392C41.5234 12.9117 41.5234 12.4827 41.5234 12.0434C41.7974 11.9721 42.0729 11.9009 42.3573 11.8267Z" fill="#CFD0D0"/>
                            <Path d="M78.624 9.01855C78.8314 9.0898 79.0372 9.16104 79.2505 9.23526C79.4845 10.393 79.4786 11.5137 79.4579 12.6907C79.252 12.762 79.0461 12.8332 78.8329 12.9059C78.8358 12.6803 78.8373 12.4532 78.8402 12.2202C78.8417 11.9219 78.8447 11.625 78.8462 11.3266C78.8477 11.1782 78.8491 11.0283 78.8506 10.8754C78.8551 10.1956 78.8329 9.6672 78.624 9.01855Z" fill="#5C5C5C"/>
                            <Path d="M50.0702 11.3931C50.4138 11.4643 50.7588 11.5356 51.1128 11.6098C51.0432 11.966 50.9751 12.3222 50.904 12.6889C50.5604 12.6176 50.2168 12.5464 49.8613 12.4736C49.9309 12.1174 49.9991 11.7612 50.0702 11.3931Z" fill="#7E8080"/>
                            <Path d="M80.7098 3.83522C80.7098 3.97771 80.7098 4.1202 80.7098 4.26715C79.6094 4.26715 78.509 4.26715 77.376 4.26715C78.4246 3.72389 79.5635 3.38992 80.7098 3.83522Z" fill="#B5B5B5"/>
                            <Path d="M56.9473 21.978C57.1531 21.978 57.359 21.978 57.5723 21.978C57.5723 22.1205 57.5723 22.263 57.5723 22.41C58.6727 22.41 59.7731 22.41 60.9076 22.41C60.9076 22.4812 60.9076 22.5525 60.9076 22.6252C58.9467 22.7321 58.9467 22.7321 56.9473 22.8419C56.9473 22.5554 56.9473 22.2704 56.9473 21.978Z" fill="#959595"/>
                            <Path d="M76.9591 13.7695C77.0953 13.7695 77.2331 13.7695 77.3752 13.7695C77.1738 15.8015 77.1738 15.8015 76.9591 16.7931C76.8894 16.7931 76.8213 16.7931 76.7502 16.7931C76.7443 16.33 76.7399 15.8654 76.7369 15.4023C76.7339 15.144 76.7325 14.8857 76.7295 14.6201C76.7502 13.9848 76.7502 13.9848 76.9591 13.7695Z" fill="#3A3A3A"/>
                            <Path d="M78.417 10.9629C78.5547 10.9629 78.6925 10.9629 78.8332 10.9629C78.9028 11.7466 78.9709 12.5303 79.042 13.3378C78.8361 13.3378 78.6288 13.3378 78.417 13.3378C78.417 12.5541 78.417 11.7704 78.417 10.9629Z" fill="#7A7A7A"/>
                            <Path d="M42.7738 14.6333C42.9115 14.6333 43.0492 14.6333 43.1914 14.6333C43.1914 14.847 43.1914 15.0608 43.1914 15.282C43.3973 15.282 43.6046 15.282 43.8164 15.282C43.7483 15.4957 43.6787 15.7094 43.6076 15.9291C43.264 15.8579 42.9204 15.7866 42.5664 15.7139C42.6345 15.3577 42.7042 15.0014 42.7738 14.6333Z" fill="#6A6C6B"/>
                            <Path d="M41.9393 15.2803C42.4947 15.5682 43.0516 15.8562 43.6069 16.1441C42.9879 16.1441 42.3688 16.1441 41.7305 16.1441C41.7305 15.497 41.7305 15.497 41.9393 15.2803Z" fill="#E1E2E2"/>
                            <Path d="M44.2332 13.7695C44.645 13.8764 44.645 13.8764 45.0671 13.9848C44.9975 14.2697 44.9293 14.5547 44.8582 14.8486C44.5828 14.7774 44.3073 14.7061 44.0244 14.6334C44.094 14.3484 44.1621 14.0634 44.2332 13.7695Z" fill="#C5C5C5"/>
                            <Path d="M42.7738 11.395C42.9811 11.395 43.187 11.395 43.4002 11.395C43.4684 11.8225 43.538 12.25 43.6076 12.6908C43.264 12.6196 42.9204 12.5483 42.5664 12.4741C42.6345 12.1179 42.7042 11.7616 42.7738 11.395Z" fill="#676969"/>
                            <Path d="M41.7308 11.1797C42.144 11.1797 42.5572 11.1797 42.9823 11.1797C42.7216 11.6116 42.7216 11.6116 42.3573 12.0436C42.0818 12.0436 41.8063 12.0436 41.5234 12.0436C41.5916 11.7586 41.6597 11.4736 41.7308 11.1797Z" fill="#E1E2E2"/>
                            <Path d="M69.8701 21.978C70.2137 21.978 70.5588 21.978 70.9128 21.978C70.9128 22.263 70.9128 22.548 70.9128 22.8419C70.5692 22.8419 70.2241 22.8419 69.8701 22.8419C69.8701 22.5554 69.8701 22.2704 69.8701 21.978Z" fill="#5F5F5F"/>
                            <Path d="M69.8721 4.48242C70.2157 4.48242 70.5608 4.48242 70.9147 4.48242C70.9147 4.76741 70.9147 5.0524 70.9147 5.34629C70.5711 5.34629 70.226 5.34629 69.8721 5.34629C69.8721 5.0613 69.8721 4.77631 69.8721 4.48242Z" fill="#5E5E5E"/>
                            <Path d="M5.25539 4.69873C5.39313 4.91247 5.52939 5.12622 5.67158 5.34589C5.38573 5.88618 5.38572 5.88618 5.04656 6.42646C4.90882 6.42646 4.77109 6.42646 4.62891 6.42646C4.7859 5.1841 4.7859 5.1841 5.25539 4.69873Z" fill="#BEBEBE"/>
                            <Path d="M79.0428 21.5444C79.1109 21.6869 79.1806 21.8294 79.2502 21.9764C79.6634 21.9764 80.0766 21.9764 80.5016 21.9764C80.5698 22.1901 80.6394 22.4038 80.7105 22.625C79.7818 22.4113 79.7819 22.4113 78.834 22.1931C78.9021 21.9778 78.9717 21.7641 79.0428 21.5444Z" fill="#C9C9C9"/>
                            <Path d="M17.9717 21.9766C17.8339 22.2615 17.6962 22.5465 17.554 22.8404C17.28 22.8404 17.0046 22.8404 16.7217 22.8404C16.7217 22.6267 16.7217 22.4115 16.7217 22.1918C17.3467 21.9766 17.3467 21.9766 17.9717 21.9766Z" fill="#7E7E7E"/>
                            <Path d="M5.46403 5.34619C5.60177 5.34619 5.7395 5.34619 5.88168 5.34619C5.88168 5.70391 5.88168 6.06014 5.88168 6.42676C5.60621 6.42676 5.33073 6.42676 5.04785 6.42676C5.23002 5.58961 5.23003 5.58962 5.46403 5.34619Z" fill="#E4E4E4"/>
                          </G>
                      </Svg>


                      <View style={{
                        width : 70,
                        height : 4,
                        borderRadius : 24,
                        backgroundColor : '#f4f4f4'
                      }}/>

                    </View>

                  <View style={{
                    display : 'flex',
                    gap : 4,
                    alignItems : 'center'
                  }}>
                    <Text style={{
                      fontWeight : '700',
                      fontSize : 16
                    }}>KSB</Text>
                     <Text style={{
                      fontSize : 10,
                      color : 'rgba(0,0,0,0.5)'
                    }}>Campus</Text>
                    <Text style={{
                      fontSize : 12,
                      color : 'rgba(0,0,0,0.6)',
                      padding : 4,
                      backgroundColor : '#fafafa',
                      borderRadius : 6
                    }}>Stop</Text>
                  </View>

                </View>

                <View style={{
                  display : 'flex',
                  flexDirection : 'row',
                  alignItems : 'center',
                  justifyContent : 'space-between',
                  padding : 16,
                  borderWidth : 1,
                  borderRadius : 16,
                  borderColor : 'rgba(0,0,0,0.1)',
                  backgroundColor : '#fff'
                }}>

                  <View style={{
                    display : 'flex',
                    gap : 4,
                    alignItems : 'center'
                  }}>
                    <Text style={{
                      fontWeight : '700',
                      fontSize : 14,
                      // maxWidth : 100,
                      textAlign : 'center'
                    }}>Commercial</Text>
                     <Text style={{
                      fontSize : 10,
                      color : 'rgba(0,0,0,0.5)'
                    }}>Campus</Text>
                    <Text style={{
                      fontSize : 12,
                      color : 'rgba(0,0,0,0.6)',
                      padding : 4,
                      backgroundColor : '#fafafa',
                      borderRadius : 6
                    }}>Start</Text>
                  </View>

                    <View style ={{
                      display : 'flex',
                      flexDirection : 'row',
                      gap : 12,
                      alignItems : 'center'
                    }}>
                      <View style={{
                        width : 60,
                        height : 2,
                        borderRadius : 24,
                        backgroundColor : '#34A853'
                      }}/>

                        {/* <Svg xmlns="http://www.w3.org/2000/svg" width="57" height="36" viewBox="0 0 57 36" fill="none">
                          <Path d="M31.0068 10.9014H30.0068C26.1408 10.9014 23.0068 14.0354 23.0068 17.9014C23.0068 21.7674 26.1408 24.9014 30.0068 24.9014H31.0068C34.8728 24.9014 38.0068 21.7674 38.0068 17.9014C38.0068 14.0354 34.8728 10.9014 31.0068 10.9014Z" fill="#699635" fill-opacity="0.8"/>
                          <Path d="M42.0068 17.4014C42.0068 11.0501 36.8581 5.90137 30.5068 5.90137C24.1556 5.90137 19.0068 11.0501 19.0068 17.4014C19.0068 23.7526 24.1556 28.9014 30.5068 28.9014C36.8581 28.9014 42.0068 23.7526 42.0068 17.4014Z" fill="#699635" fill-opacity="0.4"/>
                          <Path d="M45.0068 17.4014C45.0068 9.39324 38.515 2.90137 30.5068 2.90137C22.4987 2.90137 16.0068 9.39324 16.0068 17.4014C16.0068 25.4095 22.4987 31.9014 30.5068 31.9014C38.515 31.9014 45.0068 25.4095 45.0068 17.4014Z" fill="#699635" fill-opacity="0.1"/>
                          <Mask id="mask0_945_306" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="9" width="57" height="18">
                            <Path d="M56.4984 9.09326H0.625V26.5537H56.4984V9.09326Z" fill="white"/>
                          </Mask>
                          <G mask="url(#mask0_945_306)">
                            <Path d="M39.1878 12.4398C39.1413 12.5359 39.0949 12.6319 39.0471 12.7308C33.6596 12.7789 28.2721 12.8269 22.7213 12.8763C22.7213 16.0934 22.7213 19.3105 22.7213 22.6251C23.0422 22.7909 23.2291 22.792 23.5858 22.7981C23.7061 22.8006 23.8263 22.803 23.9502 22.8055C24.0802 22.8075 24.2102 22.8095 24.3442 22.8115C24.4775 22.8142 24.6107 22.8169 24.748 22.8196C25.1749 22.8282 25.6018 22.8359 26.0287 22.8433C26.5902 22.8532 27.1517 22.8639 27.7132 22.8752C27.8432 22.8771 27.9732 22.8791 28.1072 22.8811C28.2275 22.8836 28.3477 22.886 28.4716 22.8885C28.5776 22.8903 28.6836 22.8922 28.7929 22.894C29.0546 22.9161 29.0546 22.9161 29.3361 23.0616C29.3361 23.1576 29.3361 23.2537 29.3361 23.3526C20.9762 23.3526 12.6163 23.3526 4.00304 23.3526C3.9566 23.1605 3.91016 22.9685 3.8623 22.7706C4.04808 22.7706 4.23386 22.7706 4.42526 22.7706C4.42526 19.7936 4.42526 16.8166 4.42526 13.7494C5.77213 13.7494 7.119 13.7494 8.50669 13.7494C8.50669 13.3172 8.50669 12.8851 8.50669 12.4398C12.4447 12.4174 16.3826 12.3959 20.3206 12.3754C22.149 12.3658 23.9774 12.356 25.8057 12.3455C27.3989 12.3364 28.992 12.3278 30.5852 12.3198C31.4292 12.3155 32.2731 12.311 33.1171 12.3059C33.9108 12.3011 34.7045 12.2969 35.4982 12.2933C35.7901 12.2919 36.082 12.2902 36.3739 12.2882C36.7713 12.2856 37.1687 12.2839 37.5661 12.2824C37.6826 12.2814 37.7991 12.2804 37.9191 12.2794C38.3795 12.2784 38.7477 12.2882 39.1878 12.4398Z" fill="#34A853"/>
                            <Path d="M48.8909 12.3752C51.362 11.4939 51.2916 19.3104 51.2916 22.6249C51.6125 22.7908 50.5127 22.8878 50.8694 22.8939C50.9897 22.8963 50.6583 23.0615 52.5205 22.8054C50.6793 23.0586 50.4645 23.1938 52.5821 22.8639C51.982 22.9576 51.3855 23.0442 50.8694 23.1171C50.877 23.1172 50.8659 23.1187 50.8393 23.1213C50.5146 23.1671 50.2228 23.2073 49.9834 23.2403C50.1187 23.2371 50.2496 23.2338 50.3681 23.2305C50.394 23.2277 50.4203 23.2249 50.4472 23.222C50.4926 23.2172 50.5395 23.2121 50.5879 23.207C51.0148 23.2155 50.4425 23.1995 50.8694 23.207C50.9722 23.2088 50.8559 23.215 50.6303 23.2225C51.2938 23.2265 51.208 23.2532 51.0805 23.2815C50.9251 23.3159 50.7077 23.3525 51.7139 23.3525H49.2645C48.8532 23.3639 48.6624 23.3624 48.6219 23.3525H32.5734L32.4326 22.7704H32.9956V13.7492H37.077V12.4397C41.015 12.4173 44.8176 12.0759 48.8909 12.3752Z" fill="#34A853"/>
                            <Path 
                            d="M23.5481 13.2951C23.7223 13.2953 23.7223 13.2953 23.9 13.2955C24.0328 13.2953 24.1656 13.2951 24.3025 13.2949C24.4493 13.2954 24.5962 13.296 24.7476 13.2965C24.9013 13.2965 25.0551 13.2965 25.2135 13.2964C25.7245 13.2965 26.2355 13.2977 26.7465 13.2988C27.0997 13.2991 27.4529 13.2993 27.8061 13.2994C28.6425 13.2999 29.4788 13.3011 30.3152 13.3025C31.5274 13.3046 32.7396 13.3054 33.9517 13.3063C35.6503 13.3077 37.3488 13.3105 39.0474 13.313C39.0474 16.338 39.0474 19.3631 39.0474 22.4798C33.7992 22.4798 28.5511 22.4798 23.1439 22.4798C23.141 20.9943 23.1381 19.5087 23.1351 17.9782C23.1338 17.5086 23.1325 17.0389 23.1312 16.5551C23.1308 16.1854 23.1304 15.8158 23.1301 15.4461C23.1298 15.3495 23.1294 15.2528 23.129 15.1533C23.128 14.8699 23.1279 14.5865 23.1279 14.3032C23.1276 14.1432 23.1273 13.9833 23.127 13.8185C23.1503 13.3222 23.1503 13.3222 23.5481 13.2951Z" fill="#34A853"/>
                            <Path d="M54.8102 11.2757C54.8162 11.5181 54.8159 11.7608 54.8102 12.0032C54.5653 12.2563 54.22 12.2028 53.8866 12.2305C53.6729 12.2488 53.6729 12.2488 53.455 12.2675C53.3449 12.2763 53.2348 12.2851 53.1213 12.2942C53.1416 12.4118 53.1619 12.5294 53.1829 12.6506C53.209 12.8061 53.2351 12.9615 53.262 13.1217C53.2882 13.2754 53.3143 13.429 53.3412 13.5872C53.3958 13.9892 53.4144 14.3629 53.4028 14.7678C53.5421 14.8158 53.6814 14.8638 53.825 14.9133C53.982 15.6845 54.0144 16.4558 53.9657 17.2413C53.9193 17.2893 53.8728 17.3373 53.825 17.3868C53.8015 17.8961 53.8015 17.8961 53.825 18.4053C53.8714 18.4534 53.9179 18.5014 53.9657 18.5508C54.0271 19.4176 54.0225 20.2158 53.6843 21.0244C53.5914 21.0244 53.4985 21.0244 53.4028 21.0244C53.4086 21.1715 53.4144 21.3185 53.4204 21.47C53.402 22.0692 53.2997 22.4967 53.1213 23.0615C53.3535 23.1095 53.5857 23.1575 53.825 23.207C53.825 23.303 53.825 23.399 53.825 23.498C53.9614 23.495 54.0979 23.492 54.2384 23.4889C54.6694 23.498 54.6694 23.498 54.8102 23.6435C54.8159 23.9344 54.8162 24.2256 54.8102 24.5165C54.1768 24.4961 53.5435 24.4746 52.9102 24.4528C52.7317 24.4471 52.5532 24.4414 52.3692 24.4355C52.1951 24.4294 52.0209 24.4233 51.8415 24.417C51.6823 24.4117 51.5231 24.4064 51.359 24.4009C50.8695 24.371 50.8695 24.371 50.3923 24.2975C49.5578 24.1881 48.7216 24.2056 47.8818 24.2074C47.6932 24.2072 47.5047 24.207 47.3161 24.2067C46.9076 24.2063 46.4991 24.2063 46.0905 24.2067C45.4258 24.2073 44.761 24.2069 44.0962 24.2063C43.2561 24.2057 42.416 24.2054 41.576 24.2054C39.9261 24.2054 38.2762 24.2036 36.6263 24.2011C36.3664 24.2007 36.1065 24.2003 35.8466 24.2C35.4528 24.1994 35.059 24.1988 34.6652 24.1982C33.1818 24.1961 31.6985 24.1941 30.2151 24.1923C30.0795 24.1921 29.944 24.192 29.8043 24.1918C27.6052 24.1893 25.406 24.1888 23.2069 24.1891C20.9487 24.1893 18.6905 24.1867 16.4323 24.1817C15.0394 24.1787 13.6466 24.1779 12.2538 24.18C11.3 24.1812 10.3463 24.1798 9.39262 24.1763C8.8421 24.1743 8.29164 24.1736 7.74113 24.176C7.23734 24.1782 6.73367 24.177 6.2299 24.1732C5.96099 24.1721 5.69208 24.1745 5.42319 24.177C4.12158 24.1618 4.12158 24.1618 3.68479 23.7415C3.36266 23.2286 3.35204 22.8896 3.35161 22.2797C3.3501 22.1216 3.3501 22.1216 3.34856 21.9603C3.34619 21.6134 3.34891 21.2668 3.35192 20.9198C3.3518 20.6779 3.35145 20.4361 3.35089 20.1942C3.35048 19.6878 3.35255 19.1815 3.35642 18.6751C3.36122 18.0268 3.36037 17.3786 3.35773 16.7303C3.35624 16.231 3.35751 15.7317 3.35962 15.2324C3.36035 14.9934 3.36028 14.7544 3.3594 14.5154C3.35863 14.181 3.3615 13.8469 3.36535 13.5125C3.36622 13.3224 3.36709 13.1324 3.36799 12.9366C3.45942 12.3094 3.53029 12.1234 4.00338 11.7122C4.60101 11.5986 5.19578 11.6144 5.80187 11.6201C5.99043 11.6193 6.17898 11.6182 6.36753 11.6168C6.88617 11.6138 7.40472 11.6153 7.92336 11.6176C8.48249 11.6192 9.04162 11.6167 9.60075 11.6146C10.5698 11.6116 11.5389 11.6113 12.508 11.6128C13.9101 11.6148 15.3121 11.6128 16.7142 11.6096C18.99 11.6047 21.2659 11.6029 23.5418 11.6031C25.7507 11.6034 27.9596 11.6025 30.1685 11.5999C30.3725 11.5996 30.3725 11.5996 30.5806 11.5994C32.0652 11.5976 33.5499 11.5955 35.0345 11.5934C35.4283 11.5928 35.8221 11.5922 36.2159 11.5916C36.4755 11.5913 36.7351 11.5909 36.9947 11.5905C38.6469 11.5881 40.299 11.5868 41.9512 11.5868C42.7848 11.5867 43.6184 11.5862 44.4521 11.5856C45.1114 11.5851 45.7707 11.5852 46.43 11.5858C46.8301 11.586 47.2301 11.5856 47.6302 11.585C47.9001 11.5848 48.1701 11.5853 48.44 11.5859C48.6007 11.5855 48.7614 11.5852 48.9269 11.5848C49.0652 11.5848 49.2035 11.5848 49.346 11.5848C49.7694 11.5655 50.1711 11.4979 50.588 11.4212C50.7932 11.4185 50.9986 11.4215 51.2037 11.4303C51.9705 11.4424 52.7118 11.3384 53.4684 11.2209C53.9509 11.15 54.3465 11.0999 54.8102 11.2757ZM36.9366 12.3014C32.794 12.3177 28.6513 12.3376 24.5086 12.359C22.7576 12.368 21.0066 12.3767 19.2556 12.3854C15.6727 12.4032 12.0899 12.4213 8.50703 12.4397C8.50703 12.8718 8.50703 13.304 8.50703 13.7492C7.16016 13.7492 5.81329 13.7492 4.4256 13.7492C4.4256 16.7262 4.4256 19.7032 4.4256 22.7705C4.19338 22.7705 3.96116 22.7705 3.72191 22.7705C3.76835 23.0105 3.81479 23.2506 3.86265 23.498C18.9569 23.498 34.0512 23.498 49.6028 23.498C49.6028 23.4019 49.6028 23.3059 49.6028 23.207C49.6895 23.1933 49.7763 23.1796 49.8656 23.1655C50.1754 23.0893 50.1754 23.0893 50.334 22.8438C51.03 21.3412 51.0622 19.8176 51.0542 18.178C51.054 18.0751 51.0539 17.9723 51.0537 17.8663C51.1204 15.0888 51.1204 15.0888 50.1658 12.5852C49.706 12.2792 49.3354 12.2584 48.795 12.26C48.5451 12.2597 48.5451 12.2597 48.2902 12.2594C48.0144 12.2613 48.0144 12.2613 47.733 12.2632C47.5346 12.2636 47.3363 12.2638 47.138 12.2639C46.588 12.2645 46.0382 12.267 45.4882 12.2698C44.8902 12.2726 44.2921 12.2737 43.6941 12.275C42.3451 12.2784 40.9961 12.2842 39.6472 12.2903C38.7437 12.2944 37.8402 12.2979 36.9366 12.3014Z" fill="#C4C4C3"/>
                            <Path d="M25.2539 15.4951C29.0623 15.4951 32.8707 15.4951 36.7945 15.4951C36.7945 17.0797 36.7945 18.6642 36.7945 20.2967C32.9861 20.2967 29.1777 20.2967 25.2539 20.2967C25.2539 18.7122 25.2539 17.1277 25.2539 15.4951Z" fill="#34A853"/>
                            <Path d="M51.9337 12.1306C52.0319 12.1301 52.1302 12.1295 52.2314 12.1289C52.9626 12.1304 52.9626 12.1304 53.1212 12.2943C53.1776 12.5719 53.2262 12.8512 53.2707 13.131C53.2956 13.2833 53.3204 13.4356 53.346 13.5925C53.3965 13.9915 53.4135 14.3664 53.4027 14.7679C53.542 14.8159 53.6813 14.8639 53.8249 14.9134C53.9819 15.6846 54.0143 16.4559 53.9656 17.2415C53.9192 17.2895 53.8727 17.3375 53.8249 17.387C53.8014 17.8962 53.8014 17.8962 53.8249 18.4055C53.8946 18.4775 53.8946 18.4775 53.9656 18.551C54.027 19.4177 54.0224 20.216 53.6841 21.0246C53.5913 21.0246 53.4984 21.0246 53.4027 21.0246C53.4085 21.1716 53.4143 21.3187 53.4203 21.4702C53.4019 22.0694 53.2996 22.4968 53.1212 23.0616C53.307 23.1096 53.4927 23.1576 53.6841 23.2071C53.6841 23.3031 53.6841 23.3992 53.6841 23.4981C53.1099 23.6392 52.5672 23.6677 51.9777 23.6709C51.7203 23.674 51.7203 23.674 51.4576 23.6772C51.0101 23.6436 51.0101 23.6436 50.5879 23.3526C50.6311 23.2344 50.6742 23.1163 50.7187 22.9945C51.6341 19.8653 51.5868 15.3926 50.5879 12.2943C51.0171 12.0725 51.4635 12.1279 51.9337 12.1306Z" fill="#282828"/>
                            <Path d="M22.7208 12.8765C24.9204 12.8731 27.12 12.8705 29.3196 12.869C30.3408 12.8682 31.362 12.8672 32.3833 12.8655C33.2731 12.8641 34.1629 12.8631 35.0527 12.8628C35.5241 12.8626 35.9955 12.8622 36.4669 12.8611C36.9924 12.8601 37.5178 12.8599 38.0432 12.86C38.2006 12.8595 38.358 12.8589 38.5202 12.8584C38.6625 12.8586 38.8048 12.8588 38.9514 12.859C39.1381 12.8588 39.1381 12.8588 39.3284 12.8586C39.6095 12.8765 39.6095 12.8765 39.7503 13.022C39.7635 13.3256 39.7668 13.6296 39.7662 13.9334C39.7663 14.0285 39.7663 14.1236 39.7663 14.2216C39.7662 14.5373 39.7651 14.853 39.764 15.1688C39.7637 15.3871 39.7635 15.6055 39.7634 15.8238C39.7629 16.3996 39.7615 16.9754 39.7599 17.5511C39.7585 18.1383 39.7578 18.7254 39.7571 19.3125C39.7556 20.4652 39.7532 21.618 39.7503 22.7707C37.5323 22.7741 35.3144 22.7767 33.0965 22.7783C32.0667 22.779 31.037 22.7801 30.0072 22.7817C29.11 22.7832 28.2128 22.7841 27.3156 22.7844C26.8402 22.7846 26.3649 22.7851 25.8895 22.7861C25.3597 22.7872 24.8299 22.7873 24.3001 22.7873C24.1413 22.7878 23.9826 22.7883 23.8191 22.7888C23.6038 22.7885 23.6038 22.7885 23.3843 22.7882C23.2588 22.7884 23.1334 22.7885 23.0041 22.7886C22.7208 22.7707 22.7208 22.7707 22.5801 22.6252C22.5661 22.3322 22.5621 22.0386 22.5619 21.7452C22.5614 21.5568 22.561 21.3684 22.5605 21.1742C22.5608 20.967 22.5611 20.7597 22.5614 20.5524C22.5613 20.3412 22.5612 20.1301 22.561 19.919C22.5608 19.4758 22.5611 19.0326 22.5618 18.5895C22.5626 18.0207 22.5621 17.452 22.5613 16.8833C22.5607 16.447 22.5609 16.0108 22.5613 15.5745C22.5614 15.3648 22.5612 15.1551 22.5609 14.9454C22.5606 14.6524 22.5612 14.3594 22.5619 14.0664C22.562 13.8995 22.5621 13.7326 22.5622 13.5606C22.5801 13.1675 22.5801 13.1675 22.7208 12.8765ZM23.1431 13.4585C23.1298 13.7398 23.1265 14.0216 23.1271 14.3032C23.1271 14.4863 23.1271 14.6694 23.1271 14.8581C23.1278 15.0541 23.1286 15.2501 23.1293 15.4461C23.1295 15.6233 23.1296 15.8005 23.1297 15.9831C23.1305 16.6481 23.1324 17.3132 23.1343 17.9782C23.1372 19.4637 23.1401 20.9492 23.1431 22.4797C28.3912 22.4797 33.6394 22.4797 39.0466 22.4797C39.0466 19.4547 39.0466 16.4297 39.0466 13.313C36.2484 13.3088 36.2484 13.3088 33.4503 13.3059C32.3098 13.305 31.1694 13.304 30.029 13.302C29.1101 13.3004 28.1912 13.2996 27.2722 13.2992C26.9208 13.2989 26.5693 13.2984 26.2179 13.2976C25.7275 13.2966 25.2371 13.2964 24.7467 13.2965C24.5999 13.296 24.453 13.2954 24.3016 13.2949C24.1688 13.2951 24.036 13.2953 23.8991 13.2955C23.783 13.2954 23.6669 13.2952 23.5473 13.2951C23.2818 13.2831 23.2818 13.2831 23.1431 13.4585Z" fill="#34A853" fill-opacity="0.6"/>
                            <Path d="M4.7458 11.6182C4.84383 11.6203 4.94185 11.6224 5.04285 11.6246C5.14793 11.624 5.25301 11.6233 5.36127 11.6227C5.71359 11.6215 6.06567 11.6255 6.41796 11.6295C6.6704 11.6297 6.92284 11.6296 7.17528 11.6292C7.86093 11.629 8.54649 11.6332 9.23212 11.6383C9.94851 11.6429 10.6649 11.6433 11.3813 11.6441C12.7381 11.6464 14.0948 11.6524 15.4515 11.6597C16.9961 11.6678 18.5406 11.6718 20.0851 11.6755C23.2625 11.6831 26.4399 11.6959 29.6172 11.7121C29.6172 11.8561 29.6172 12.0002 29.6172 12.1486C29.4879 12.1482 29.3586 12.1478 29.2254 12.1474C26.081 12.1377 22.9367 12.1305 19.7924 12.126C18.2718 12.1237 16.7513 12.1206 15.2307 12.1157C13.9056 12.1113 12.5806 12.1085 11.2555 12.1075C10.5536 12.1069 9.8518 12.1056 9.14997 12.1024C8.48968 12.0995 7.82941 12.0986 7.16911 12.0992C6.92651 12.0991 6.68391 12.0982 6.44131 12.0965C6.11052 12.0944 5.77983 12.0949 5.44904 12.0961C5.26378 12.0957 5.07852 12.0953 4.88765 12.0949C4.3976 12.1518 4.20121 12.2219 3.86199 12.5851C3.81554 12.7291 3.7691 12.8732 3.72125 13.0216C3.95347 13.0216 4.18568 13.0216 4.42494 13.0216C4.47139 12.8295 4.51783 12.6375 4.56568 12.4396C4.56568 12.8237 4.56568 13.2079 4.56568 13.6036C5.77322 13.6036 6.98076 13.6036 8.22489 13.6036C8.22489 13.2195 8.22489 12.8354 8.22489 12.4396C8.27134 12.4396 8.31778 12.4396 8.36563 12.4396C8.36563 12.8717 8.36563 13.3039 8.36563 13.7491C7.0652 13.7491 5.76478 13.7491 4.42494 13.7491C4.42494 16.6781 4.42494 19.6071 4.42494 22.6248C4.09983 22.6248 3.77473 22.6248 3.43977 22.6248C3.42672 21.3094 3.41672 19.994 3.4106 18.6786C3.40766 18.0677 3.40368 17.4569 3.3973 16.8461C3.39118 16.2564 3.38781 15.6668 3.38636 15.0772C3.38532 14.8524 3.38329 14.6276 3.38025 14.4028C3.37615 14.0875 3.3756 13.7724 3.37586 13.4572C3.37461 13.2778 3.37336 13.0985 3.37207 12.9138C3.49683 12.0399 3.87843 11.6321 4.7458 11.6182Z" fill="#BABABA"/>
                            <Path d="M5.42617 11.95C5.57761 11.9493 5.57761 11.9493 5.7321 11.9485C6.07042 11.9475 6.40866 11.9495 6.74697 11.9516C6.98947 11.9515 7.23198 11.9512 7.47448 11.9507C8.13307 11.9499 8.79163 11.9519 9.45022 11.9544C10.1386 11.9566 10.8269 11.9564 11.5153 11.9565C12.6708 11.9571 13.8264 11.9592 14.9819 11.9625C16.4671 11.9667 17.9523 11.9682 19.4375 11.9689C20.7124 11.9695 21.9873 11.9713 23.2622 11.9733C23.6731 11.9739 24.0839 11.9743 24.4948 11.9747C25.139 11.9754 25.7833 11.9769 26.4275 11.979C26.6646 11.9797 26.9017 11.9801 27.1388 11.9802C27.4611 11.9805 27.7833 11.9816 28.1056 11.983C28.2863 11.9834 28.4671 11.9839 28.6533 11.9843C29.0537 12.0034 29.0537 12.0034 29.1945 12.1489C29.4923 12.167 29.7907 12.1748 30.089 12.1788C30.1823 12.1803 30.2757 12.1817 30.3719 12.1832C30.6818 12.1878 30.9917 12.1914 31.3017 12.195C31.5161 12.198 31.7304 12.201 31.9448 12.2041C32.51 12.2122 33.0753 12.2194 33.6405 12.2264C34.2169 12.2337 34.7933 12.2418 35.3697 12.2498C36.5013 12.2655 37.633 12.2803 38.7647 12.2944C38.7647 12.3425 38.7647 12.3905 38.7647 12.44C28.7793 12.44 18.7938 12.44 8.50583 12.44C8.50583 12.8721 8.50583 13.3042 8.50583 13.7495C8.41294 13.7015 8.32005 13.6535 8.22435 13.604C7.94859 13.5916 7.67242 13.5884 7.39641 13.5898C7.15013 13.5905 7.15013 13.5905 6.89888 13.5912C6.72671 13.5924 6.55454 13.5936 6.37715 13.5949C6.20389 13.5955 6.03064 13.5962 5.85213 13.5969C5.42312 13.5986 4.99413 13.601 4.56514 13.604C4.51869 13.4119 4.47225 13.2199 4.4244 13.022C4.19218 13.022 3.95996 13.022 3.7207 13.022C3.77011 12.6517 3.82934 12.4734 4.08691 12.2051C4.54929 11.9288 4.89314 11.9493 5.42617 11.95Z" fill="#CFCFCF"/>
                            <Path d="M3.72168 22.77C3.86101 22.842 3.86101 22.842 4.00316 22.9155C4.00316 23.0596 4.00316 23.2036 4.00316 23.352C12.3631 23.352 20.723 23.352 29.3362 23.352C29.3362 23.256 29.3362 23.16 29.3362 23.061C27.2462 23.013 25.1562 22.965 23.0029 22.9155C23.0029 22.8675 23.0029 22.8195 23.0029 22.77C28.4833 22.77 33.9637 22.77 39.6101 22.77C39.4708 22.9141 39.3315 23.0581 39.1879 23.2065C44.3432 23.2786 44.3432 23.2786 49.6026 23.352C49.6026 23.4001 49.6026 23.4481 49.6026 23.4975C34.5083 23.4975 19.4141 23.4975 3.86242 23.4975C3.81597 23.2575 3.76953 23.0174 3.72168 22.77Z" fill="#34A853"/>
                            <Path d="M3.43945 13.1675C3.76456 13.1675 4.08967 13.1675 4.42463 13.1675C4.42463 16.2885 4.42463 19.4096 4.42463 22.6252C4.09952 22.6252 3.77441 22.6252 3.43945 22.6252C3.43945 19.5042 3.43945 16.3831 3.43945 13.1675Z" fill="#4B4B4B"/>
                            <Path d="M51.889 12.1294C52.0168 12.1298 52.1445 12.1301 52.2761 12.1305C52.4677 12.13 52.4677 12.13 52.6631 12.1294C52.9798 12.1487 52.9798 12.1487 53.1205 12.2942C53.1769 12.5718 53.2255 12.851 53.27 13.1309C53.2949 13.2832 53.3198 13.4355 53.3454 13.5924C53.3958 13.9914 53.4128 14.3662 53.402 14.7678C53.5413 14.8158 53.6806 14.8638 53.8242 14.9133C54.0292 15.92 54.1335 16.8928 53.6835 17.8234C53.1726 17.8234 52.6617 17.8234 52.1353 17.8234C52.1122 17.499 52.1122 17.499 52.0886 17.168C51.9736 15.6429 51.8349 14.1598 51.5004 12.6682C51.4777 12.5448 51.455 12.4214 51.4316 12.2942C51.5724 12.1487 51.5724 12.1487 51.889 12.1294Z" fill="#3E3E3E"/>
                            <Path d="M25.2539 15.4951C29.0623 15.4951 32.8707 15.4951 36.7945 15.4951C36.7945 17.0797 36.7945 18.6642 36.7945 20.2967C32.9861 20.2967 29.1777 20.2967 25.2539 20.2967C25.2539 18.7122 25.2539 17.1277 25.2539 15.4951ZM25.5354 15.7861C25.5354 17.1786 25.5354 18.5711 25.5354 20.0057C29.158 20.0057 32.7806 20.0057 36.513 20.0057C36.513 18.6133 36.513 17.2208 36.513 15.7861C32.8904 15.7861 29.2678 15.7861 25.5354 15.7861Z" fill="#D4D4D4"/>
                            <Path d="M54.8084 11.2762C54.8145 11.5186 54.8142 11.7612 54.8084 12.0037C54.5546 12.2662 54.1658 12.1837 53.8228 12.1952C53.6518 12.2013 53.4807 12.2074 53.3046 12.2137C53.1245 12.2194 52.9444 12.2251 52.7589 12.231C52.5783 12.2373 52.3978 12.2436 52.2117 12.2501C51.7638 12.2656 51.3157 12.2804 50.8677 12.2947C50.8677 12.7303 50.9386 13.1199 51.0179 13.5461C51.3763 15.5465 51.3312 17.5426 51.2901 19.5699C51.2436 19.5699 51.1972 19.5699 51.1493 19.5699C51.1458 19.4569 51.1423 19.344 51.1385 19.2277C51.1221 18.7112 51.1049 18.1948 51.0877 17.6783C51.0821 17.5007 51.0766 17.3231 51.0709 17.1401C50.998 14.7335 50.998 14.7335 50.0233 12.5857C49.6398 12.4535 49.3728 12.4135 48.9749 12.3941C48.8556 12.3881 48.7363 12.382 48.6134 12.3757C48.4894 12.37 48.3655 12.3642 48.2378 12.3583C48.1122 12.3521 47.9864 12.3458 47.857 12.3393C47.547 12.3239 47.2372 12.309 46.9272 12.2947C46.9272 12.1987 46.9272 12.1026 46.9272 12.0037C44.4192 12.0037 41.9111 12.0037 39.3271 12.0037C39.3271 11.9557 39.3271 11.9076 39.3271 11.8582C39.4244 11.8567 39.5217 11.8552 39.6219 11.8536C40.5491 11.8392 41.4762 11.8243 42.4035 11.8088C42.8798 11.8008 43.3562 11.7931 43.8326 11.7858C47.2221 11.7833 47.2221 11.7833 50.5863 11.4217C50.7915 11.419 50.9969 11.422 51.202 11.4308C51.9688 11.4428 52.7102 11.3389 53.4668 11.2213C53.9492 11.1505 54.3448 11.1004 54.8084 11.2762Z" fill="#BAB0A5"/>
                            <Path d="M29.6354 16.2217C29.8049 16.245 29.8049 16.245 29.9779 16.2689C30.148 16.2905 30.148 16.2905 30.3215 16.3126C30.6024 16.3689 30.6024 16.3689 30.7431 16.5144C30.7573 16.9221 30.7627 17.3254 30.7607 17.733C30.7616 17.9035 30.7616 17.9035 30.7624 18.0774C30.7616 18.5626 30.7518 18.9612 30.6024 19.4245C30.3796 19.4324 30.1568 19.438 29.9339 19.4427C29.8098 19.446 29.6857 19.4494 29.5579 19.4529C29.1769 19.423 28.9662 19.3122 28.6321 19.1335C28.5392 19.1815 28.4463 19.2295 28.3506 19.279C28.3506 18.4627 28.3506 17.6464 28.3506 16.8054C28.5828 16.7094 28.815 16.6133 29.0543 16.5144C29.3358 16.2234 29.3358 16.2234 29.6354 16.2217Z" fill="#E5E7E6"/>
                            <Path d="M53.6831 17.9692C54.0814 18.6654 54.0217 19.3655 53.9646 20.1518C53.8239 20.6883 53.8239 20.6883 53.6831 21.0248C53.5902 21.0248 53.4973 21.0248 53.4016 21.0248C53.4104 21.2454 53.4104 21.2454 53.4192 21.4704C53.4008 22.0696 53.2986 22.4971 53.1202 23.0619C53.3059 23.1099 53.4917 23.1579 53.6831 23.2074C53.6831 23.3034 53.6831 23.3994 53.6831 23.4984C53.0626 23.6588 52.4891 23.655 51.8535 23.6439C51.9928 23.5719 51.9928 23.5719 52.135 23.4984C52.1321 23.3333 52.1292 23.1683 52.1262 22.9982C52.135 22.4798 52.135 22.4798 52.2757 22.3343C52.6303 20.9624 52.6409 19.525 52.6979 18.1147C53.1202 17.9692 53.1202 17.9692 53.6831 17.9692Z" fill="#595959"/>
                            <Path d="M51.5721 12.1487C51.9368 14.056 52.2335 15.8747 52.135 17.8233C52.6459 17.8233 53.1568 17.8233 53.6832 17.8233C53.6832 17.8713 53.6832 17.9193 53.6832 17.9688C52.9401 17.9688 52.197 17.9688 51.4313 17.9688C51.394 17.6567 51.3566 17.3446 51.3181 17.023C51.281 16.7172 51.2437 16.4114 51.2063 16.1056C51.1807 15.8948 51.1553 15.684 51.1301 15.4731C50.9403 13.8679 50.9403 13.8679 50.5869 12.2942C50.9335 12.115 51.1892 12.1382 51.5721 12.1487Z" fill="#212121"/>
                            <Path d="M34.1208 16.3687C34.353 16.4167 34.5852 16.4647 34.8245 16.5142C34.8709 16.7062 34.9174 16.8983 34.9652 17.0962C35.151 17.0962 35.3368 17.0962 35.5282 17.0962C35.5282 17.2882 35.5282 17.4803 35.5282 17.6782C35.0529 17.6 34.5857 17.5166 34.1208 17.3872C34.1469 17.4742 34.1731 17.5612 34.2 17.6509C34.2615 17.9692 34.2615 17.9692 34.1208 18.4057C34.353 18.4057 34.5852 18.4057 34.8245 18.4057C34.8245 18.3097 34.8245 18.2136 34.8245 18.1147C35.0567 18.0667 35.2889 18.0187 35.5282 17.9692C35.5282 18.2093 35.5282 18.4494 35.5282 18.6967C35.3424 18.6967 35.1566 18.6967 34.9652 18.6967C34.9188 18.8888 34.8723 19.0808 34.8245 19.2787C34.5923 19.3267 34.3601 19.3748 34.1208 19.4242C34.086 19.3342 34.0511 19.2442 34.0152 19.1514C33.8379 18.7755 33.8379 18.7755 33.2764 18.5512C33.2764 18.023 33.2764 17.4948 33.2764 16.9507C33.5086 16.9027 33.7408 16.8546 33.9801 16.8052C34.0265 16.6611 34.0729 16.5171 34.1208 16.3687Z" fill="#CCCCCC"/>
                            <Path d="M4.70617 12.5854C5.86727 12.5854 7.02836 12.5854 8.22464 12.5854C8.22464 12.9216 8.22464 13.2577 8.22464 13.604C7.0171 13.604 5.80956 13.604 4.56543 13.604C4.61187 13.2679 4.65832 12.9317 4.70617 12.5854Z" fill="#D7D7D7"/>
                            <Path d="M52.416 12.1489C52.7643 12.221 52.7643 12.221 53.1197 12.2944C53.1673 12.5701 53.2141 12.846 53.2604 13.122C53.2866 13.2756 53.3127 13.4292 53.3396 13.5875C53.3942 13.9894 53.4128 14.3631 53.4012 14.768C53.5405 14.816 53.6799 14.864 53.8234 14.9135C53.979 15.6776 54.0406 16.4633 53.9641 17.2416C53.8713 17.3856 53.7784 17.5296 53.6827 17.6781C53.4969 17.6781 53.3111 17.6781 53.1197 17.6781C53.1119 17.5562 53.1041 17.4343 53.0961 17.3087C53.0669 16.8569 53.0372 16.4051 53.0072 15.9534C52.9943 15.7578 52.9816 15.5622 52.9691 15.3666C52.9512 15.0855 52.9324 14.8046 52.9135 14.5236C52.9025 14.3544 52.8914 14.1853 52.88 14.011C52.8622 13.6111 52.8622 13.6111 52.6975 13.313C52.7004 13.1689 52.7033 13.0249 52.7063 12.8764C52.7459 12.4228 52.7459 12.4228 52.416 12.1489Z" fill="#717171"/>
                            <Path d="M54.8093 11.276C54.8153 11.5185 54.815 11.7611 54.8093 12.0035C54.6686 12.149 54.6686 12.149 54.2521 12.1656C54.07 12.1648 53.888 12.164 53.7004 12.1633C53.5555 12.1629 53.5555 12.1629 53.4076 12.1626C53.0978 12.1618 52.7881 12.16 52.4783 12.1581C52.2688 12.1574 52.0592 12.1567 51.8497 12.1562C51.335 12.1545 50.8203 12.152 50.3057 12.149C50.3057 11.909 50.3057 11.6689 50.3057 11.4215C50.4015 11.4249 50.4972 11.4283 50.5959 11.4318C51.577 11.4506 52.5137 11.3733 53.4816 11.2212C53.9603 11.1498 54.3491 11.1025 54.8093 11.276Z" fill="#C0C0C0"/>
                            <Path d="M52.707 17.9595C52.9116 17.964 52.9116 17.964 53.1204 17.9686C52.9811 18.0166 52.8417 18.0646 52.6982 18.1141C52.7014 18.2846 52.7047 18.4551 52.7081 18.6307C52.725 19.9008 52.7012 21.0907 52.4167 22.3337C52.3933 22.4588 52.3699 22.5839 52.3458 22.7128C52.276 23.0612 52.276 23.0612 52.1352 23.4977C51.8449 23.5977 51.8449 23.5977 51.5723 23.6432C51.6453 22.9884 51.7368 22.3451 51.8537 21.6971C52.0057 20.7904 52.0522 19.8876 52.0871 18.9695C52.1279 17.9717 52.1279 17.9717 52.707 17.9595Z" fill="#444444"/>
                            <Path d="M5.40297 11.9605C5.54235 11.9615 5.54235 11.9615 5.68455 11.9624C5.97998 11.9648 6.27528 11.9703 6.57067 11.9759C6.77151 11.9781 6.97236 11.9801 7.17321 11.9818C7.66437 11.9866 8.15546 11.9942 8.64657 12.0032C8.60012 12.5794 8.55368 13.1555 8.50583 13.7492C8.45938 13.7492 8.41294 13.7492 8.36509 13.7492C8.29542 13.173 8.29542 13.173 8.22435 12.5852C7.06325 12.5852 5.90216 12.5852 4.70588 12.5852C4.65943 12.6812 4.61299 12.7772 4.56514 12.8762C4.4244 13.0217 4.4244 13.0217 4.06375 13.0308C3.89394 13.0263 3.89394 13.0263 3.7207 13.0217C3.77026 12.6502 3.82949 12.4728 4.08836 12.2042C4.54428 11.9314 4.8782 11.9536 5.40297 11.9605Z" fill="#C5C5C5"/>
                            <Path d="M53.2614 18.1143C53.4008 18.1143 53.5401 18.1143 53.6836 18.1143C54.1022 18.7633 54.0197 19.3898 53.9651 20.1513C53.8244 20.6879 53.8244 20.6879 53.6836 21.0243C53.5908 21.0243 53.4979 21.0243 53.4022 21.0243C53.4109 21.2449 53.4109 21.2449 53.4198 21.4699C53.4014 22.0692 53.2991 22.4966 53.1207 23.0614C53.3065 23.1094 53.4922 23.1574 53.6836 23.2069C53.6836 23.3029 53.6836 23.3989 53.6836 23.4979C53.0567 23.5699 53.0567 23.5699 52.417 23.6434C52.5099 23.4993 52.6028 23.3553 52.6985 23.2069C52.7546 22.9237 52.8005 22.6383 52.8392 22.352C52.9515 21.525 52.9515 21.525 53.1284 21.1261C53.3251 20.5453 53.2911 19.9885 53.279 19.3783C53.2777 19.2567 53.2765 19.1351 53.2752 19.0097C53.2719 18.7112 53.2668 18.4127 53.2614 18.1143Z" fill="#848484"/>
                            <Path d="M53.6845 23.207C53.7309 23.3031 53.7774 23.3991 53.8252 23.498C53.9617 23.495 54.0981 23.492 54.2386 23.4889C54.6697 23.498 54.6697 23.498 54.8104 23.6435C54.8161 23.9345 54.8164 24.2256 54.8104 24.5166C54.1682 24.4963 53.5261 24.4747 52.884 24.4529C52.702 24.4472 52.5199 24.4415 52.3324 24.4356C52.1568 24.4295 51.9813 24.4234 51.8005 24.4171C51.639 24.4118 51.4776 24.4064 51.3113 24.4009C50.9162 24.3742 50.5513 24.3172 50.166 24.2256C50.2589 24.0335 50.3518 23.8414 50.4475 23.6435C50.4939 23.7396 50.5404 23.8356 50.5882 23.9345C51.61 23.8865 52.6318 23.8385 53.6845 23.789C53.638 23.693 53.5916 23.597 53.5438 23.498C53.5902 23.402 53.6366 23.306 53.6845 23.207Z" fill="#CECCCB"/>
                            <Path d="M52.1357 12.1489C52.4841 12.221 52.4841 12.221 52.8394 12.2944C52.8365 12.4565 52.8336 12.6185 52.8306 12.7855C52.8023 13.2885 52.8023 13.2885 52.9802 13.604C53.0136 13.9897 53.0398 14.3724 53.0593 14.7589C53.0653 14.8696 53.0713 14.9804 53.0774 15.0945C53.1212 15.9561 53.1371 16.8153 53.1209 17.6781C53.3067 17.7261 53.4925 17.7741 53.6839 17.8236C53.4517 17.8236 53.2194 17.8236 52.9802 17.8236C52.7525 17.4061 52.6612 17.0937 52.6454 16.6158C52.6406 16.4975 52.6358 16.3793 52.6308 16.2574C52.6271 16.135 52.6234 16.0126 52.6195 15.8865C52.5906 15.0665 52.5452 14.2689 52.4172 13.4585C52.3708 13.4585 52.3243 13.4585 52.2765 13.4585C52.23 13.0263 52.1836 12.5942 52.1357 12.1489Z" fill="#5C5C5C"/>
                            <Path d="M38.7646 23.498C38.9039 23.498 39.0432 23.498 39.1868 23.498C39.1868 23.5941 39.1868 23.6901 39.1868 23.7891C39.9299 23.7891 40.673 23.7891 41.4386 23.7891C41.4386 23.8371 41.4386 23.8851 41.4386 23.9346C39.0083 24.1361 36.5793 24.0689 34.1446 24.0226C33.585 24.0122 33.0253 24.0028 32.4657 23.9934C31.3752 23.9748 30.2848 23.9551 29.1943 23.9346C29.1943 23.8385 29.1943 23.7425 29.1943 23.6436C29.3122 23.6439 29.43 23.6442 29.5514 23.6445C30.6594 23.6474 31.7674 23.6497 32.8754 23.6511C33.4451 23.6519 34.0148 23.6529 34.5845 23.6545C35.1339 23.6561 35.6832 23.657 36.2325 23.6574C36.4426 23.6576 36.6526 23.6582 36.8627 23.6589C37.1559 23.66 37.4491 23.6601 37.7423 23.6601C37.9931 23.6606 37.9931 23.6606 38.2489 23.661C38.6128 23.6877 38.6128 23.6877 38.7646 23.498Z" fill="#A8A8A8"/>
                            <Path d="M29.3352 16.2231C29.6211 16.2356 29.6211 16.2356 29.9685 16.2777C30.1405 16.2974 30.1405 16.2974 30.316 16.3175C30.6018 16.3686 30.6018 16.3686 30.7426 16.5142C30.7624 16.9027 30.7486 17.2889 30.7426 17.6782C30.4985 17.7731 30.4985 17.7731 30.1796 17.8237C29.8784 17.6787 29.8784 17.6787 29.5815 17.469C29.4821 17.4002 29.3826 17.3313 29.2802 17.2604C29.2055 17.2062 29.1307 17.152 29.0537 17.0962C29.1769 16.3868 29.1769 16.3868 29.3352 16.2231Z" fill="#CBCCCC"/>
                            <Path d="M28.8525 17.9595C29.0223 17.964 29.0223 17.964 29.1956 17.9686C29.1956 18.1126 29.1956 18.2567 29.1956 18.4051C29.4278 18.4531 29.66 18.5011 29.8993 18.5506C29.9872 18.8234 29.9872 18.8234 30.04 19.1326C29.9471 19.2286 29.8542 19.3247 29.7585 19.4236C29.4243 19.369 29.4243 19.369 29.0548 19.2781C28.869 19.2781 28.6833 19.2781 28.4919 19.2781C28.4454 19.2781 28.399 19.2781 28.3511 19.2781C28.3374 18.3829 28.3374 18.3829 28.3511 18.1141C28.4919 17.9686 28.4919 17.9686 28.8525 17.9595Z" fill="#C8C9C9"/>
                            <Path d="M47.4912 23.4983C47.8548 23.4944 48.2183 23.4915 48.5819 23.4892C48.6846 23.488 48.7873 23.4868 48.8931 23.4855C49.3893 23.4832 49.8289 23.5051 50.306 23.6438C50.2595 23.8359 50.2131 24.0279 50.1653 24.2258C49.2828 24.1778 48.4004 24.1298 47.4912 24.0803C47.4912 23.8882 47.4912 23.6962 47.4912 23.4983Z" fill="#B8A898"/>
                            <Path d="M53.6827 18.1142C53.5433 18.1142 53.404 18.1142 53.2604 18.1142C53.2739 18.2948 53.2873 18.4755 53.3011 18.6616C53.317 18.9005 53.3327 19.1394 53.3484 19.3783C53.3575 19.4971 53.3666 19.6159 53.3759 19.7384C53.4173 20.3987 53.4088 20.8542 53.1197 21.4608C53.066 21.7992 53.0177 22.1387 52.979 22.4793C52.9325 22.4793 52.8861 22.4793 52.8382 22.4793C52.8382 21.0388 52.8382 19.5984 52.8382 18.1142C53.1888 17.933 53.3183 18.0012 53.6827 18.1142ZM52.6975 22.4793C52.7439 22.4793 52.7904 22.4793 52.8382 22.4793C52.8382 22.8154 52.8382 23.1516 52.8382 23.4979C52.6989 23.4979 52.5596 23.4979 52.416 23.4979C52.5392 22.8067 52.5392 22.8067 52.6975 22.4793Z" fill="#6C6C6C"/>
                            <Path d="M29.6173 11.7124C29.6173 11.8565 29.6173 12.0005 29.6173 12.1489C26.7842 12.1489 23.9512 12.1489 21.0322 12.1489C21.0322 12.0529 21.0322 11.9568 21.0322 11.8579C22.0892 11.8389 23.1463 11.8199 24.2033 11.801C24.6941 11.7922 25.1849 11.7834 25.6757 11.7746C26.2399 11.7644 26.804 11.7543 27.3682 11.7442C27.5446 11.741 27.721 11.7379 27.9027 11.7346C28.1478 11.7302 28.1478 11.7302 28.3978 11.7258C28.5419 11.7232 28.686 11.7206 28.8344 11.7179C29.0954 11.7139 29.3563 11.7124 29.6173 11.7124Z" fill="#ABABAB"/>
                            <Path d="M39.3281 11.8579C42.0219 11.8579 44.7156 11.8579 47.491 11.8579C47.491 12.002 47.491 12.146 47.491 12.2944C47.3052 12.2944 47.1194 12.2944 46.928 12.2944C46.928 12.1984 46.928 12.1024 46.928 12.0034C44.4201 12.0034 41.9121 12.0034 39.3281 12.0034C39.3281 11.9554 39.3281 11.9074 39.3281 11.8579Z" fill="#B5B5B5"/>
                            <Path d="M33.2764 16.2231C34.0195 16.2231 34.7626 16.2231 35.5282 16.2231C35.5746 16.7033 35.6211 17.1835 35.6689 17.6782C35.4832 17.5821 35.2974 17.4861 35.106 17.3872C35.2453 17.3872 35.3846 17.3872 35.5282 17.3872C35.5282 17.2911 35.5282 17.1951 35.5282 17.0962C35.3424 17.0962 35.1566 17.0962 34.9652 17.0962C34.8723 16.9041 34.7795 16.712 34.6838 16.5142C34.138 16.451 34.138 16.451 33.8745 16.7324C33.8165 16.8044 33.7584 16.8765 33.6986 16.9507C33.5593 16.9026 33.4199 16.8546 33.2764 16.8052C33.2764 16.6131 33.2764 16.421 33.2764 16.2231Z" fill="#DDDEDE"/>
                            <Path d="M33.2765 18.5513C33.7214 18.7506 33.8384 18.8407 34.1209 19.2788C34.3531 19.2308 34.5854 19.1828 34.8246 19.1333C34.8711 18.9892 34.9175 18.8452 34.9653 18.6968C35.1976 18.7448 35.4298 18.7928 35.669 18.8423C35.6226 19.0824 35.5762 19.3224 35.5283 19.5698C34.8316 19.5698 34.135 19.5698 33.4172 19.5698C33.3243 19.3297 33.2314 19.0896 33.1357 18.8423C33.1822 18.7462 33.2286 18.6502 33.2765 18.5513Z" fill="#E0E0E0"/>
                            <Path d="M35.5291 17.9688C35.5291 18.2087 35.5291 18.4489 35.5291 18.6963C35.3433 18.6963 35.1575 18.6963 34.9661 18.6963C34.9197 18.8883 34.8732 19.0803 34.8254 19.2782C34.5932 19.3262 34.3609 19.3742 34.1217 19.4237C33.9633 18.7325 33.9633 18.7326 34.1217 18.4053C34.3539 18.4053 34.5861 18.4053 34.8254 18.4053C34.8254 18.3092 34.8254 18.2132 34.8254 18.1143C35.1069 17.9688 35.1069 17.9688 35.5291 17.9688Z" fill="#9E9E9E"/>
                            <Path d="M12.4479 23.4976C12.4479 23.5936 12.4479 23.6896 12.4479 23.7886C14.3521 23.7886 16.2563 23.7886 18.2182 23.7886C18.2182 23.8366 18.2182 23.8846 18.2182 23.9341C16.0354 23.9821 13.8525 24.0301 11.6035 24.0796C11.6035 23.9355 11.6035 23.7915 11.6035 23.6431C12.0257 23.4976 12.0257 23.4976 12.4479 23.4976Z" fill="#B5B5B5"/>
                            <Path d="M4.98828 12.7305C5.91716 12.7305 6.84604 12.7305 7.80306 12.7305C7.80306 12.8745 7.80306 13.0186 7.80306 13.167C6.87418 13.167 5.94531 13.167 4.98828 13.167C4.98828 13.0229 4.98828 12.8789 4.98828 12.7305Z" fill="#34A853"/>
                            <Path d="M30.744 18.1145C30.6975 18.5466 30.6511 18.9788 30.6032 19.424C30.3246 19.424 30.0459 19.424 29.7588 19.424C29.782 19.316 29.8052 19.208 29.8292 19.0966C29.9163 18.6689 29.9163 18.6689 29.8995 18.1145C30.181 17.969 30.181 17.969 30.744 18.1145Z" fill="#DEDEDE"/>
                            <Path d="M50.7277 13.3135C50.8205 13.3615 50.9134 13.4095 51.0091 13.459C51.5509 15.3849 51.3165 17.5911 51.2906 19.5701C51.2442 19.5701 51.1977 19.5701 51.1499 19.5701C51.1446 19.4008 51.1446 19.4008 51.1392 19.228C51.1228 18.7115 51.1055 18.195 51.0883 17.6786C51.0828 17.501 51.0772 17.3233 51.0715 17.1403C51.0372 15.5402 51.0372 15.5402 50.7101 13.9864C50.6694 13.8604 50.6288 13.7343 50.5869 13.6045C50.6334 13.5085 50.6798 13.4124 50.7277 13.3135Z" fill="#B0B0B0"/>
                            <Path d="M53.1211 23.3525C53.3997 23.4486 53.6784 23.5446 53.9655 23.6435C53.684 23.9346 53.684 23.9346 53.3808 23.9676C53.2584 23.9661 53.1361 23.9645 53.01 23.963C52.8776 23.962 52.7452 23.9611 52.6087 23.9601C52.4701 23.9577 52.3315 23.9553 52.1887 23.9527C52.049 23.9514 51.9093 23.9501 51.7654 23.9488C51.4197 23.9453 51.0741 23.9405 50.7285 23.9346C50.7285 23.7905 50.7285 23.6465 50.7285 23.498C50.8894 23.4997 51.0504 23.5014 51.2162 23.5032C51.426 23.5045 51.6358 23.5058 51.8456 23.5071C51.9519 23.5084 52.0581 23.5096 52.1675 23.5108C52.4385 23.5121 52.7095 23.5056 52.9803 23.498C53.0268 23.45 53.0732 23.402 53.1211 23.3525Z" fill="#B8B8B8"/>
                            <Path d="M52.417 13.3125C52.4634 13.3125 52.5099 13.3125 52.5577 13.3125C52.6893 14.2964 52.7438 15.2723 52.7837 16.2641C52.7889 16.3817 52.7942 16.4993 52.7996 16.6204C52.8039 16.7258 52.8082 16.8312 52.8125 16.9397C52.8397 17.2467 52.9001 17.5266 52.9799 17.8231C52.8406 17.7751 52.7013 17.7271 52.5577 17.6776C52.5099 17.1927 52.4633 16.7076 52.417 16.2226C52.4036 16.0866 52.3901 15.9506 52.3763 15.8105C52.3017 15.0224 52.2479 14.25 52.2763 13.458C52.3227 13.41 52.3691 13.362 52.417 13.3125Z" fill="#4D4D4D"/>
                            <Path d="M50.3047 11.4219C51.28 11.4939 51.28 11.4939 52.275 11.5674C52.275 11.6154 52.275 11.6634 52.275 11.7129C52.693 11.7849 52.693 11.7849 53.1195 11.8584C53.1195 11.9064 53.1195 11.9544 53.1195 12.0039C52.1906 12.0519 51.2617 12.0999 50.3047 12.1494C50.3047 11.9093 50.3047 11.6692 50.3047 11.4219Z" fill="#CCCAC9"/>
                            <Path d="M39.1871 11.7129C39.1871 11.905 39.1871 12.097 39.1871 12.2949C39.1175 12.2718 39.048 12.2488 38.9764 12.225C38.4837 12.1193 37.9929 12.115 37.4916 12.1034C37.3831 12.1003 37.2745 12.0973 37.1627 12.0942C36.8171 12.0847 36.4716 12.0761 36.126 12.0676C35.8912 12.0613 35.6565 12.0549 35.4217 12.0485C34.8473 12.033 34.2728 12.0182 33.6982 12.0039C33.6982 11.9559 33.6982 11.9079 33.6982 11.8584C34.4121 11.8376 35.1259 11.8169 35.8397 11.7962C36.0826 11.7892 36.3255 11.7821 36.5683 11.7751C36.9173 11.7649 37.2663 11.7548 37.6153 11.7447C37.7239 11.7415 37.8326 11.7384 37.9445 11.7351C38.3589 11.7232 38.7725 11.7129 39.1871 11.7129Z" fill="#A2A2A2"/>
                            <Path d="M53.2611 18.1143C53.4004 18.1143 53.5398 18.1143 53.6833 18.1143C53.6833 18.9305 53.6833 19.7468 53.6833 20.5878C53.5904 20.6358 53.4975 20.6839 53.4018 20.7333C53.2321 20.2068 53.2459 19.7257 53.2523 19.1783C53.2529 19.0761 53.2536 18.974 53.2542 18.8688C53.2559 18.6173 53.2584 18.3658 53.2611 18.1143Z" fill="#959595"/>
                            <Path d="M34.8248 17.2412C34.8712 17.3853 34.9177 17.5293 34.9655 17.6777C35.2491 17.7844 35.2491 17.7844 35.5285 17.8232C35.2963 17.9193 35.064 18.0153 34.8248 18.1142C34.8248 18.2103 34.8248 18.3063 34.8248 18.4052C34.5926 18.4052 34.3604 18.4052 34.1211 18.4052C34.1211 18.0691 34.1211 17.733 34.1211 17.3867C34.3533 17.3387 34.5855 17.2907 34.8248 17.2412Z" fill="#E6E6E6"/>
                            <Path d="M29.6175 11.8579C30.9644 11.8579 32.3113 11.8579 33.699 11.8579C33.699 11.9059 33.699 11.9539 33.699 12.0034C33.6175 12.0071 33.5361 12.0107 33.4522 12.0145C31.3205 12.1062 31.3205 12.1062 29.1953 12.2944C29.3346 12.2464 29.474 12.1984 29.6175 12.1489C29.6175 12.0529 29.6175 11.9569 29.6175 11.8579Z" fill="#B8B8B8"/>
                            <Path d="M50.8682 20.4429C50.9611 20.4429 51.054 20.4429 51.1497 20.4429C51.1336 20.7703 51.1156 21.0977 51.0969 21.425C51.0822 21.6985 51.0822 21.6985 51.0672 21.9775C51.0155 22.4232 50.9531 22.6865 50.7275 23.0619C50.5582 22.1168 50.6452 21.3727 50.8682 20.4429Z" fill="#B6B6B6"/>
                            <Path d="M53.2604 14.0405C53.3069 14.0405 53.3533 14.0405 53.4012 14.0405C53.4215 14.2056 53.4418 14.3706 53.4627 14.5407C53.4873 15.0311 53.4873 15.0311 53.6826 15.2046C53.6928 15.4984 53.6944 15.7926 53.6914 16.0867C53.6902 16.2474 53.6889 16.4082 53.6876 16.5738C53.686 16.6981 53.6843 16.8225 53.6826 16.9506C53.6362 16.9506 53.5898 16.9506 53.5419 16.9506C53.5419 16.6625 53.5419 16.3744 53.5419 16.0776C53.449 16.0776 53.3561 16.0776 53.2604 16.0776C53.1319 15.3543 53.1319 14.7638 53.2604 14.0405Z" fill="#A0A0A0"/>
                            <Path d="M53.5431 18.4058C53.6824 18.4538 53.8217 18.5018 53.9653 18.5513C54.0172 20.2277 54.0172 20.2277 53.6838 21.0248C53.5909 21.0248 53.498 21.0248 53.4023 21.0248C53.4488 20.8808 53.4952 20.7367 53.5431 20.5883C53.553 20.214 53.5563 19.8439 53.5519 19.4698C53.5509 19.3166 53.5509 19.3166 53.55 19.1603C53.5483 18.9088 53.5458 18.6573 53.5431 18.4058Z" fill="#5E5E5E"/>
                            <Path d="M28.9135 16.6602C29.0529 16.8522 29.1922 17.0443 29.3358 17.2422C29.1598 17.4604 29.1598 17.4604 28.9135 17.6787C28.7278 17.6787 28.542 17.6787 28.3506 17.6787C28.3506 17.3906 28.3506 17.1025 28.3506 16.8057C28.5364 16.7576 28.7221 16.7096 28.9135 16.6602Z" fill="#CFD0D0"/>
                            <Path d="M53.4014 14.7681C53.5407 14.8161 53.68 14.8641 53.8236 14.9136C53.9824 15.6936 53.978 16.4491 53.9643 17.2416C53.825 17.2896 53.6857 17.3377 53.5421 17.3871C53.5437 17.2346 53.5454 17.0822 53.5471 16.925C53.5484 16.7244 53.5497 16.5238 53.5509 16.3231C53.5521 16.2227 53.5533 16.1223 53.5545 16.0188C53.5566 15.5613 53.5424 15.2054 53.4014 14.7681Z" fill="#5C5C5C"/>
                            <Path d="M34.1212 16.3682C34.3534 16.4162 34.5856 16.4642 34.8249 16.5137C34.7785 16.7537 34.732 16.9938 34.6842 17.2412C34.4519 17.1932 34.2197 17.1452 33.9805 17.0957C34.0269 16.8556 34.0734 16.6155 34.1212 16.3682Z" fill="#7E8080"/>
                            <Path d="M54.8094 11.2762C54.8094 11.3722 54.8094 11.4683 54.8094 11.5672C54.0663 11.5672 53.3232 11.5672 52.5576 11.5672C53.2656 11.2012 54.0347 10.9758 54.8094 11.2762Z" fill="#B5B5B5"/>
                            <Path d="M38.7646 23.4985C38.904 23.4985 39.0434 23.4985 39.187 23.4985C39.187 23.5946 39.187 23.6906 39.187 23.7895C39.9301 23.7895 40.6732 23.7895 41.4388 23.7895C41.4388 23.8376 41.4388 23.8856 41.4388 23.935C40.1151 24.0071 40.115 24.0071 38.7646 24.0805C38.7646 23.8885 38.7646 23.6964 38.7646 23.4985Z" fill="#959595"/>
                            <Path d="M52.2766 17.9688C52.3694 17.9688 52.4623 17.9688 52.558 17.9688C52.4224 19.3378 52.4224 19.3379 52.2766 20.0058C52.2301 20.0058 52.1837 20.0058 52.1358 20.0058C52.132 19.6936 52.1293 19.3813 52.127 19.069C52.1254 18.8951 52.1238 18.7214 52.1221 18.5422C52.1358 18.1143 52.1358 18.1143 52.2766 17.9688Z" fill="#3A3A3A"/>
                            <Path d="M53.2607 16.0776C53.3536 16.0776 53.4465 16.0776 53.5422 16.0776C53.5887 16.6058 53.6351 17.134 53.683 17.6782C53.5436 17.6782 53.4043 17.6782 53.2607 17.6782C53.2607 17.15 53.2607 16.6218 53.2607 16.0776Z" fill="#7A7A7A"/>
                            <Path d="M29.1954 18.5513C29.2883 18.5513 29.3812 18.5513 29.4769 18.5513C29.4769 18.6953 29.4769 18.8394 29.4769 18.9878C29.6162 18.9878 29.7556 18.978 29.8991 18.9878C29.8527 19.1318 29.8062 19.2759 29.7584 19.4243C29.5262 19.3763 29.2939 19.3283 29.0547 19.2788C29.1011 19.0387 29.1476 18.7986 29.1954 18.5513Z" fill="#6A6C6B"/>
                            <Path d="M28.6319 18.9873C29.0073 19.1813 29.3826 19.3753 29.7579 19.5693C29.3399 19.5693 28.9219 19.5693 28.4912 19.5693C28.4912 19.1328 28.4912 19.1328 28.6319 18.9873Z" fill="#E1E2E2"/>
                            <Path d="M30.1798 17.9688C30.4585 18.0407 30.4585 18.0408 30.7428 18.1143C30.6963 18.3063 30.6499 18.4984 30.602 18.6963C30.4162 18.6483 30.2305 18.6002 30.0391 18.5508C30.0855 18.3587 30.132 18.1665 30.1798 17.9688Z" fill="#C5C5C5"/>
                            <Path d="M29.1954 16.3687C29.3348 16.3687 29.4741 16.3687 29.6176 16.3687C29.6641 16.6567 29.7105 16.9448 29.7584 17.2417C29.5262 17.1937 29.2939 17.1456 29.0547 17.0962C29.1011 16.8561 29.1476 16.616 29.1954 16.3687Z" fill="#676969"/>
                            <Path d="M28.4913 16.2236C28.77 16.2236 29.0487 16.2236 29.3358 16.2236C29.1598 16.5146 29.1598 16.5146 28.9135 16.8056C28.7278 16.8056 28.542 16.8056 28.3506 16.8056C28.397 16.6136 28.4435 16.4215 28.4913 16.2236Z" fill="#E1E2E2"/>
                            <Path d="M47.4902 23.4985C47.7225 23.4985 47.9547 23.4985 48.1939 23.4985C48.1939 23.6906 48.1939 23.8827 48.1939 24.0805C47.9617 24.0805 47.7295 24.0805 47.4902 24.0805C47.4902 23.8885 47.4902 23.6964 47.4902 23.4985Z" fill="#5F5F5F"/>
                            <Path d="M47.4912 11.7119C47.7234 11.7119 47.9556 11.7119 48.1949 11.7119C48.1949 11.904 48.1949 12.096 48.1949 12.2939C47.9627 12.2939 47.7305 12.2939 47.4912 12.2939C47.4912 12.1019 47.4912 11.9098 47.4912 11.7119Z" fill="#5E5E5E"/>
                            <Path d="M3.86167 11.8579C3.95456 12.002 4.04745 12.146 4.14315 12.2944C3.94963 12.6582 3.94963 12.6582 3.72093 13.0219C3.62804 13.0219 3.53516 13.0219 3.43945 13.0219C3.54501 12.1853 3.54501 12.1853 3.86167 11.8579Z" fill="#BEBEBE"/>
                            <Path d="M53.6837 23.207C53.7302 23.3031 53.7766 23.3991 53.8244 23.498C54.1031 23.498 54.3818 23.498 54.6689 23.498C54.7153 23.6421 54.7618 23.7861 54.8096 23.9345C54.1826 23.7905 54.1826 23.7905 53.543 23.6435C53.5894 23.4995 53.6359 23.3554 53.6837 23.207Z" fill="#C9C9C9"/>
                            <Path d="M12.4479 23.4976C12.3551 23.6896 12.2622 23.8817 12.1665 24.0796C11.9807 24.0796 11.7949 24.0796 11.6035 24.0796C11.6035 23.9355 11.6035 23.7915 11.6035 23.6431C12.0257 23.4976 12.0257 23.4976 12.4479 23.4976Z" fill="#7E7E7E"/>
                            <Path d="M4.00316 12.2944C4.09605 12.2944 4.18893 12.2944 4.28464 12.2944C4.28464 12.5345 4.28464 12.7746 4.28464 13.022C4.09886 13.022 3.91308 13.022 3.72168 13.022C3.84483 12.4581 3.84483 12.4581 4.00316 12.2944Z" fill="#E4E4E4"/>
                          </G>
                        </Svg> */}

                        <Svg xmlns="http://www.w3.org/2000/svg" width="84" height="27" viewBox="0 0 84 27" fill="none">
                          <Mask id="mask0_933_1781" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="0" width="84" height="27">
                            <Path d="M83.2118 0.595215H0.460938V26.5118H83.2118V0.595215Z" fill="white"/>
                          </Mask>
                          <G mask="url(#mask0_933_1781)">
                            <Path d="M57.5742 5.56278C57.5046 5.70528 57.4365 5.84777 57.3654 5.99472C49.387 6.06596 41.4071 6.13722 33.1859 6.20995C33.1859 10.985 33.1859 15.7614 33.1859 20.6804C33.6613 20.9268 33.9382 20.9283 34.467 20.9372C34.6447 20.9417 34.8224 20.9446 35.0061 20.9491C35.1986 20.9506 35.3911 20.9535 35.5896 20.958C35.7866 20.961 35.985 20.9654 36.1879 20.9699C36.8203 20.9818 37.4528 20.9936 38.0852 21.004C38.916 21.0189 39.7484 21.0352 40.5792 21.0515C40.7718 21.0545 40.9643 21.0574 41.1628 21.0604C41.3405 21.0649 41.5197 21.0678 41.7033 21.0723C41.8603 21.0738 42.0173 21.0767 42.1788 21.0797C42.5668 21.1124 42.5668 21.1124 42.983 21.3291C42.983 21.4716 42.983 21.614 42.983 21.761C30.6014 21.761 18.2199 21.761 5.46372 21.761C5.39559 21.476 5.32597 21.1895 5.25488 20.8971C5.53036 20.8971 5.80584 20.8971 6.08872 20.8971C6.08872 16.4784 6.08872 12.0596 6.08872 7.50573C8.08368 7.50573 10.0786 7.50573 12.1343 7.50573C12.1343 6.86451 12.1343 6.2233 12.1343 5.56278C17.9667 5.52865 23.799 5.49747 29.6314 5.4663C32.3387 5.45294 35.0461 5.43809 37.7549 5.42325C40.1142 5.4084 42.4735 5.39655 44.8328 5.38468C46.0828 5.37874 47.3328 5.37131 48.5828 5.36388C49.7587 5.35646 50.9347 5.35052 52.1091 5.34459C52.5416 5.3431 52.9741 5.34013 53.4065 5.33716C53.9945 5.33419 54.584 5.33123 55.1719 5.32826C55.3452 5.32677 55.517 5.3253 55.6948 5.32382C56.3775 5.32233 56.9225 5.33717 57.5742 5.56278Z" fill="#34A853"/>
                            <Path d="M71.9453 5.466C75.605 4.15833 75.5013 15.7597 75.5013 20.6801C75.9752 20.9265 74.3476 21.0705 74.8748 21.0794C75.054 21.0824 74.5623 21.3273 77.32 20.9473C74.5934 21.3243 74.2765 21.5247 77.4118 21.0349C76.5232 21.1744 75.639 21.3021 74.8748 21.4104C74.8867 21.4104 74.8704 21.4134 74.8304 21.4163C74.3505 21.4846 73.9181 21.544 73.5626 21.593C73.764 21.5885 73.958 21.5841 74.1328 21.5781C74.1713 21.5752 74.2098 21.5707 74.2498 21.5663C74.318 21.5588 74.3876 21.5514 74.4586 21.544C75.091 21.5574 74.2439 21.5321 74.8748 21.544C75.0274 21.547 74.8556 21.5559 74.5209 21.5678C75.5043 21.5722 75.3769 21.6123 75.1888 21.6538C74.9577 21.7058 74.6364 21.7592 76.1263 21.7592H72.4992C71.889 21.777 71.6061 21.7741 71.5469 21.7592H47.7777L47.5703 20.8954H48.4041V7.50543H54.4483V5.56249C60.2806 5.52835 65.913 5.0222 71.9453 5.466Z" fill="#34A853"/>
                            <Path d="M34.4106 6.83203C34.6683 6.83203 34.6683 6.83204 34.9319 6.83353C35.1289 6.83204 35.3259 6.83203 35.5273 6.83203C35.7451 6.83203 35.9628 6.83351 36.1879 6.835C36.4145 6.83351 36.6426 6.83353 36.8781 6.83353C37.6349 6.83501 38.3902 6.83648 39.147 6.83797C39.6713 6.83797 40.1941 6.83797 40.7169 6.83797C41.9551 6.83945 43.1947 6.84093 44.4328 6.8439C46.2279 6.84687 48.0244 6.84688 49.8194 6.84836C52.3342 6.85133 54.8505 6.85579 57.3653 6.85876C57.3653 11.3488 57.3653 15.8388 57.3653 20.4654C49.5928 20.4654 41.8203 20.4654 33.8123 20.4654C33.8078 18.2597 33.8034 16.0555 33.799 13.783C33.7975 13.0869 33.796 12.3893 33.793 11.6709C33.793 11.1217 33.7916 10.574 33.7916 10.0248C33.7916 9.8808 33.7901 9.7383 33.7901 9.58987C33.7886 9.16981 33.7886 8.74975 33.7886 8.3282C33.7886 8.09072 33.7871 7.85324 33.7871 7.60981C33.8212 6.87211 33.8212 6.87211 34.4106 6.83203Z" fill="#34A853"/>
                            <Path d="M80.7109 3.83506C80.7198 4.19426 80.7198 4.55496 80.7109 4.91416C80.3481 5.28969 79.8371 5.21101 79.3439 5.25257C79.027 5.27929 79.027 5.27929 78.7041 5.306C78.5412 5.31936 78.3783 5.33273 78.2095 5.34609C78.2406 5.52124 78.2702 5.69489 78.3013 5.87598C78.3398 6.10605 78.3783 6.33759 78.4183 6.57508C78.4568 6.80218 78.4953 7.03078 78.5353 7.2653C78.6167 7.86199 78.6434 8.41712 78.6271 9.01826C78.833 9.08951 79.0388 9.16074 79.2521 9.23347C79.4846 10.3779 79.532 11.5238 79.4609 12.6889C79.3913 12.7602 79.3232 12.8314 79.2521 12.9056C79.218 13.6611 79.218 13.6612 79.2521 14.4167C79.3202 14.4879 79.3899 14.5592 79.4609 14.6334C79.5513 15.9203 79.5439 17.1047 79.0433 18.3041C78.9056 18.3041 78.7678 18.3041 78.6271 18.3041C78.636 18.5223 78.6434 18.7419 78.6523 18.9661C78.6256 19.8552 78.4746 20.4905 78.2095 21.3276C78.5545 21.3988 78.8981 21.4701 79.2521 21.5443C79.2521 21.6868 79.2521 21.8293 79.2521 21.9762C79.4535 21.9718 79.6564 21.9673 79.8638 21.9629C80.5021 21.9762 80.5021 21.9762 80.7109 22.1915C80.7198 22.6234 80.7198 23.0568 80.7109 23.4873C79.7734 23.4576 78.8359 23.4264 77.897 23.3937C77.6333 23.3848 77.3682 23.3759 77.0957 23.3685C76.838 23.3581 76.5803 23.3492 76.3137 23.3403C76.0782 23.3329 75.8427 23.324 75.5998 23.3166C74.8741 23.272 74.8741 23.272 74.1677 23.1637C72.9325 23.0004 71.6944 23.0271 70.4503 23.0286C70.1704 23.0286 69.8919 23.0286 69.612 23.0286C69.0077 23.0271 68.402 23.0271 67.7977 23.0286C66.8128 23.0286 65.8279 23.0286 64.843 23.0271C63.599 23.0271 62.3549 23.0256 61.1108 23.0256C58.6671 23.0256 56.2234 23.0242 53.7797 23.0197C53.3946 23.0197 53.011 23.0182 52.6259 23.0182C52.0424 23.0167 51.4589 23.0167 50.8753 23.0152C48.6789 23.0123 46.4811 23.0093 44.2847 23.0063C44.0848 23.0063 43.8833 23.0063 43.676 23.0063C40.4192 23.0019 37.1624 23.0019 33.9056 23.0019C30.5614 23.0019 27.2157 22.9989 23.8715 22.9915C21.8084 22.9871 19.7468 22.9856 17.6837 22.9885C16.2708 22.99 14.8579 22.9885 13.4464 22.9826C12.6304 22.9796 11.8158 22.9796 10.9997 22.9826C10.2533 22.9856 9.50833 22.9841 8.76188 22.9781C8.36348 22.9767 7.96509 22.9796 7.56669 22.9841C5.63986 22.9618 5.63985 22.9618 4.99263 22.3384C4.51574 21.577 4.49945 21.0738 4.49945 20.1683C4.49649 19.9338 4.49648 19.9338 4.495 19.6934C4.49056 19.1783 4.49501 18.6647 4.49945 18.1497C4.49945 17.7905 4.49796 17.4313 4.49796 17.0721C4.49648 16.321 4.50093 15.5685 4.50538 14.8174C4.51278 13.8556 4.5113 12.8938 4.50834 11.9305C4.50537 11.1898 4.50833 10.4491 4.5113 9.70696C4.5113 9.35221 4.51129 8.99747 4.5098 8.64272C4.5098 8.14696 4.51427 7.65121 4.51871 7.15545C4.52019 6.87195 4.52166 6.58992 4.52314 6.30048C4.65791 5.36834 4.76308 5.09227 5.46361 4.48222C6.34928 4.3145 7.23049 4.33675 8.128 4.34565C8.40644 4.34417 8.68635 4.3427 8.96627 4.34121C9.73345 4.33676 10.5021 4.33823 11.2693 4.34269C12.0972 4.34417 12.9266 4.34122 13.7545 4.33825C15.1896 4.33379 16.6247 4.33231 18.0599 4.33528C20.1363 4.33825 22.2127 4.33527 24.2891 4.33082C27.66 4.3234 31.0309 4.32042 34.4017 4.32042C37.6733 4.32042 40.9449 4.31895 44.2151 4.31598C44.5172 4.31598 44.5172 4.31597 44.8267 4.31449C47.0246 4.313 49.224 4.31004 51.4233 4.30559C52.0054 4.30559 52.5889 4.30409 53.1724 4.30409C53.5575 4.30261 53.9411 4.30261 54.3262 4.30113C56.7728 4.29816 59.2195 4.29669 61.6662 4.29669C62.9014 4.29669 64.1351 4.29519 65.3703 4.29519C66.3463 4.29371 67.3238 4.29371 68.2998 4.29519C68.8922 4.29519 69.4846 4.2952 70.0771 4.29372C70.4769 4.29372 70.8768 4.29371 71.2767 4.29519C71.5151 4.29519 71.7521 4.29372 71.998 4.29372C72.2023 4.29372 72.4082 4.29372 72.6185 4.29372C73.245 4.26403 73.8404 4.16458 74.458 4.05029C74.7616 4.04732 75.0667 4.05027 75.3703 4.06363C76.5062 4.08144 77.6037 3.92708 78.7234 3.75341C79.4387 3.64803 80.0252 3.57382 80.7109 3.83506ZM54.2403 5.35646C48.1043 5.3817 41.9683 5.41138 35.8339 5.44255C33.2406 5.45591 30.6473 5.46927 28.0539 5.48115C22.7474 5.50786 17.4408 5.53459 12.1342 5.56279C12.1342 6.20401 12.1342 6.84522 12.1342 7.50574C10.1393 7.50574 8.14429 7.50574 6.09008 7.50574C6.09008 11.9245 6.09008 16.3433 6.09008 20.8957C5.745 20.8957 5.4014 20.8957 5.04743 20.8957C5.11556 21.2534 5.18518 21.6096 5.25627 21.9762C27.6111 21.9762 49.966 21.9762 72.9991 21.9762C72.9991 21.8337 72.9991 21.6912 72.9991 21.5443C73.128 21.5235 73.2554 21.5042 73.3887 21.482C73.8463 21.3691 73.8463 21.3691 74.0818 21.0055C75.1126 18.7746 75.16 16.514 75.1481 14.0797C75.1481 13.9268 75.1481 13.774 75.1481 13.6166C75.2459 9.49471 75.2459 9.49472 73.833 5.77802C73.1517 5.32383 72.6022 5.29264 71.8025 5.29561C71.4322 5.29561 71.4322 5.29562 71.0545 5.29413C70.6458 5.2971 70.6458 5.2971 70.2296 5.30007C69.9364 5.30155 69.6416 5.30156 69.3484 5.30156C68.5338 5.30305 67.7192 5.30601 66.9047 5.31046C66.019 5.31492 65.1333 5.31639 64.2477 5.31787C62.2497 5.32232 60.2518 5.33123 58.2539 5.34013C56.9165 5.34607 55.5776 5.35201 54.2403 5.35646Z" fill="#C4C4C3"/>
                            <Path d="M36.9375 10.0977C42.5773 10.0977 48.2186 10.0977 54.0302 10.0977C54.0302 12.4503 54.0302 14.8014 54.0302 17.2253C48.3889 17.2253 42.7491 17.2253 36.9375 17.2253C36.9375 14.8727 36.9375 12.5215 36.9375 10.0977Z" fill="#34A853"/>
                            <Path d="M76.4515 5.10432C76.5966 5.10283 76.7418 5.10284 76.8914 5.10135C77.9755 5.10284 77.9755 5.10285 78.2095 5.34627C78.2939 5.75891 78.365 6.17302 78.4316 6.58862C78.4687 6.81424 78.5042 7.04134 78.5427 7.27438C78.6168 7.86513 78.642 8.42175 78.6271 9.01844C78.833 9.08969 79.0389 9.16092 79.2521 9.23365C79.4847 10.3795 79.5321 11.5239 79.461 12.6891C79.3914 12.7604 79.3232 12.8316 79.2521 12.9058C79.2166 13.6613 79.2166 13.6613 79.2521 14.4169C79.3558 14.5252 79.3558 14.5252 79.461 14.6336C79.5513 15.9204 79.5439 17.1049 79.0433 18.3057C78.9056 18.3057 78.7678 18.3057 78.6271 18.3057C78.6346 18.5239 78.6434 18.7421 78.6523 18.9662C78.6257 19.8553 78.4746 20.4906 78.2095 21.3293C78.485 21.4005 78.7604 21.4718 79.0433 21.5445C79.0433 21.687 79.0433 21.8295 79.0433 21.9764C78.1932 22.1857 77.389 22.2288 76.5167 22.2332C76.1345 22.2377 76.1345 22.2377 75.7465 22.2421C75.083 22.1931 75.083 22.1931 74.458 21.7612C74.5217 21.5846 74.5854 21.4094 74.652 21.2298C76.0072 16.5839 75.9376 9.94613 74.458 5.34627C75.0934 5.01676 75.7539 5.09986 76.4515 5.10432Z" fill="#282828"/>
                            <Path d="M33.1862 6.21179C36.443 6.20585 39.7013 6.20289 42.9596 6.19992C44.4717 6.19844 45.9839 6.19695 47.496 6.19546C48.8141 6.19249 50.1323 6.19102 51.4504 6.19102C52.148 6.19102 52.847 6.18952 53.5446 6.18803C54.3221 6.18655 55.1012 6.18656 55.8787 6.18656C56.1127 6.18508 56.3452 6.18508 56.5852 6.18359C56.797 6.18508 57.0073 6.18507 57.2235 6.18507C57.5005 6.18507 57.5005 6.18507 57.7819 6.18507C58.1995 6.21178 58.1995 6.2118 58.4069 6.42702C58.4276 6.87825 58.432 7.32947 58.4306 7.77922C58.4306 7.92171 58.4306 8.06272 58.4306 8.20818C58.4306 8.67574 58.4291 9.14479 58.4276 9.61383C58.4276 9.93741 58.4276 10.261 58.4261 10.586C58.4261 11.441 58.4231 12.2945 58.4217 13.1494C58.4187 14.0207 58.4187 14.892 58.4172 15.7633C58.4157 17.4747 58.4113 19.1861 58.4069 20.8975C55.1219 20.902 51.8369 20.9064 48.552 20.9079C47.028 20.9094 45.5025 20.9109 43.9771 20.9138C42.6486 20.9153 41.3201 20.9168 39.9916 20.9168C39.2866 20.9183 38.5831 20.9183 37.8781 20.9198C37.0947 20.9212 36.3097 20.9213 35.5247 20.9213C35.2893 20.9227 35.0553 20.9227 34.8124 20.9242C34.4939 20.9242 34.4939 20.9242 34.1681 20.9227C33.983 20.9227 33.7964 20.9242 33.6053 20.9242C33.1862 20.8975 33.1862 20.8975 32.9774 20.6808C32.9566 20.2459 32.9507 19.811 32.9507 19.3746C32.9492 19.0956 32.9492 18.815 32.9492 18.5271C32.9492 18.2198 32.9492 17.9126 32.9492 17.6038C32.9492 17.2906 32.9492 16.9775 32.9492 16.6643C32.9492 16.0067 32.9492 15.3492 32.9507 14.6901C32.9522 13.8471 32.9507 13.0025 32.9492 12.1579C32.9492 11.5108 32.9492 10.8636 32.9492 10.2164C32.9492 9.90474 32.9492 9.59305 32.9492 9.28135C32.9492 8.84645 32.9492 8.41152 32.9507 7.97662C32.9507 7.72874 32.9507 7.48236 32.9507 7.22706C32.9773 6.64373 32.9773 6.64372 33.1862 6.21179ZM33.8112 7.07566C33.7919 7.49275 33.7875 7.91131 33.7875 8.3284C33.7875 8.60003 33.7875 8.87167 33.7875 9.1522C33.789 9.44313 33.7904 9.73405 33.7904 10.025C33.7904 10.2877 33.7919 10.5519 33.7919 10.822C33.7919 11.8091 33.7949 12.7962 33.7979 13.7832C33.8023 15.9889 33.8067 18.1931 33.8112 20.4656C41.5837 20.4656 49.3562 20.4656 57.3657 20.4656C57.3657 15.9755 57.3657 11.4855 57.3657 6.85896C53.2202 6.85302 53.2202 6.85301 49.0763 6.84856C47.3879 6.84708 45.698 6.84559 44.0096 6.84263C42.6486 6.83966 41.2875 6.83965 39.9264 6.83816C39.4066 6.83816 38.8852 6.83669 38.3654 6.83669C37.6382 6.83521 36.9125 6.83372 36.1868 6.83372C35.969 6.83372 35.7513 6.83223 35.5277 6.83223C35.3307 6.83223 35.1338 6.83224 34.9309 6.83372C34.759 6.83224 34.5872 6.83223 34.4095 6.83223C34.017 6.81442 34.0171 6.81442 33.8112 7.07566Z" fill="#34A853" fill-opacity="0.6"/>
                            <Path d="M6.56426 4.34277C6.7094 4.34574 6.85454 4.34872 7.00413 4.35317C7.15964 4.35168 7.31514 4.3502 7.47509 4.3502C7.9979 4.34872 8.51923 4.35465 9.04056 4.3591C9.41378 4.36059 9.78849 4.36059 10.1617 4.3591C11.1777 4.3591 12.1922 4.36504 13.2082 4.37247C14.2701 4.37989 15.3305 4.37988 16.391 4.38137C18.4007 4.38434 20.4105 4.39325 22.4203 4.40513C24.707 4.417 26.9953 4.42294 29.282 4.42739C33.9887 4.43926 38.694 4.45856 43.3993 4.48231C43.3993 4.69605 43.3993 4.90979 43.3993 5.13095C43.2082 5.12946 43.0172 5.12947 42.8187 5.12798C38.1623 5.11462 33.5059 5.10424 28.848 5.09682C26.5969 5.09385 24.3442 5.08938 22.093 5.08196C20.1306 5.07454 18.1682 5.07009 16.2044 5.07009C15.1662 5.06861 14.1265 5.06713 13.0868 5.06119C12.1093 5.05674 11.1303 5.05673 10.1528 5.05673C9.79442 5.05673 9.43451 5.05525 9.07462 5.05376C8.58587 5.04931 8.09566 5.05078 7.60544 5.05227C7.33145 5.05227 7.05745 5.05079 6.77457 5.05079C6.04886 5.1354 5.75709 5.23931 5.25502 5.77811C5.18689 5.99185 5.11727 6.20559 5.04618 6.42675C5.38978 6.42675 5.73488 6.42675 6.08885 6.42675C6.15698 6.14176 6.22657 5.85529 6.29766 5.56288C6.29766 6.13285 6.29766 6.70283 6.29766 7.29061C8.08528 7.29061 9.8744 7.29061 11.7168 7.29061C11.7168 6.71916 11.7168 6.14918 11.7168 5.56288C11.7849 5.56288 11.8545 5.56288 11.9256 5.56288C11.9256 6.2041 11.9256 6.84531 11.9256 7.50582C9.99879 7.50582 8.07345 7.50582 6.08885 7.50582C6.08885 11.8534 6.08885 16.2009 6.08885 20.6805C5.60751 20.6805 5.12617 20.6805 4.63002 20.6805C4.61077 18.7272 4.59595 16.7753 4.58706 14.8235C4.58262 13.9165 4.5767 13.0096 4.56634 12.1027C4.55745 11.227 4.553 10.3527 4.55004 9.47698C4.54856 9.14301 4.5456 8.81054 4.54116 8.47657C4.53524 8.00901 4.53524 7.53997 4.53524 7.07242C4.53376 6.80673 4.53078 6.54104 4.5293 6.26644C4.71443 4.96916 5.27872 4.36355 6.56426 4.34277Z" fill="#BABABA"/>
                            <Path d="M7.57206 4.83595C7.79717 4.83446 7.79717 4.83448 8.02525 4.83448C8.52585 4.83151 9.02792 4.83595 9.52851 4.83892C9.88692 4.83743 10.2468 4.83744 10.6052 4.83744C11.5812 4.83596 12.5572 4.83891 13.5318 4.84188C14.5522 4.84634 15.5712 4.84486 16.5901 4.84634C18.3022 4.84634 20.0128 4.84931 21.7249 4.85525C23.9242 4.86118 26.1236 4.86266 28.3244 4.86415C30.2113 4.86415 32.0996 4.86713 33.9879 4.8701C34.5966 4.87159 35.2053 4.87159 35.8141 4.87307C36.7678 4.87307 37.7216 4.87604 38.6769 4.879C39.0279 4.88049 39.3789 4.88048 39.73 4.88048C40.2068 4.88048 40.6837 4.88345 41.1621 4.88494C41.4287 4.88494 41.6968 4.88641 41.9722 4.88641C42.5661 4.91461 42.5661 4.91462 42.7735 5.13133C43.2148 5.15805 43.6577 5.16992 44.099 5.17586C44.2368 5.17735 44.376 5.18031 44.5181 5.18179C44.9773 5.18922 45.4364 5.19368 45.8955 5.19962C46.2125 5.20407 46.5294 5.20851 46.8478 5.21296C47.6846 5.22483 48.5214 5.23523 49.3597 5.24562C50.2128 5.25749 51.0658 5.26937 51.9204 5.28125C53.5955 5.30351 55.272 5.32578 56.9485 5.34656C56.9485 5.41781 56.9485 5.48905 56.9485 5.56327C42.1589 5.56327 27.3706 5.56327 12.1337 5.56327C12.1337 6.20449 12.1337 6.84569 12.1337 7.50621C11.9959 7.43496 11.8582 7.36373 11.716 7.291C11.3087 7.27319 10.8985 7.26724 10.4897 7.27021C10.1254 7.27021 10.1254 7.27022 9.75364 7.2717C9.4989 7.27319 9.24416 7.27615 8.98053 7.27764C8.72431 7.27912 8.4681 7.27912 8.20299 7.2806C7.56763 7.28357 6.93226 7.28655 6.29689 7.291C6.22876 7.00601 6.15914 6.72103 6.08805 6.42713C5.74445 6.42713 5.40084 6.42713 5.04688 6.42713C5.11945 5.87794 5.20685 5.61225 5.58896 5.21445C6.2732 4.80479 6.78266 4.83446 7.57206 4.83595Z" fill="#CFCFCF"/>
                            <Path d="M5.04785 20.896C5.25372 21.0029 5.25373 21.0029 5.46403 21.1127C5.46403 21.3264 5.46403 21.5402 5.46403 21.7599C17.8455 21.7599 30.2271 21.7599 42.9833 21.7599C42.9833 21.6174 42.9833 21.4749 42.9833 21.3279C39.8879 21.2567 36.7925 21.1854 33.6038 21.1127C33.6038 21.0415 33.6038 20.9687 33.6038 20.896C41.72 20.896 49.8375 20.896 58.1995 20.896C57.9936 21.1097 57.7863 21.3235 57.5745 21.5446C65.2093 21.6515 65.2093 21.6515 72.9996 21.7599C72.9996 21.8311 72.9996 21.9024 72.9996 21.9766C50.6432 21.9766 28.2884 21.9766 5.2552 21.9766C5.18707 21.6188 5.11894 21.2626 5.04785 20.896Z" fill="#34A853"/>
                            <Path d="M4.62891 6.64209C5.11173 6.64209 5.59308 6.64209 6.08923 6.64209C6.08923 11.2761 6.08923 15.9086 6.08923 20.6806C5.60789 20.6806 5.12506 20.6806 4.62891 20.6806C4.62891 16.0481 4.62891 11.4156 4.62891 6.64209Z" fill="#4B4B4B"/>
                            <Path d="M76.3848 5.10156C76.5744 5.10305 76.7625 5.10305 76.958 5.10453C77.2424 5.10305 77.2423 5.10305 77.5312 5.10156C78.0006 5.13125 78.0007 5.13126 78.2095 5.34649C78.2924 5.75912 78.3635 6.17323 78.4302 6.58883C78.4672 6.81445 78.5042 7.04006 78.5412 7.2731C78.6168 7.86533 78.6419 8.42196 78.6256 9.01865C78.8315 9.0899 79.0389 9.16113 79.2507 9.23386C79.5543 10.7286 79.7098 12.1728 79.0418 13.5532C78.2865 13.5532 77.5297 13.5532 76.7492 13.5532C76.7151 13.0723 76.7151 13.0723 76.681 12.581C76.5107 10.3174 76.3049 8.11619 75.8087 5.90161C75.7761 5.71904 75.7421 5.53499 75.708 5.34649C75.9154 5.13126 75.9154 5.13125 76.3848 5.10156Z" fill="#3E3E3E"/>
                            <Path d="M36.9375 10.0977C42.5773 10.0977 48.2186 10.0977 54.0302 10.0977C54.0302 12.4503 54.0302 14.8014 54.0302 17.2253C48.3889 17.2253 42.7491 17.2253 36.9375 17.2253C36.9375 14.8727 36.9375 12.5215 36.9375 10.0977ZM37.3537 10.5296C37.3537 12.5972 37.3537 14.6634 37.3537 16.7934C42.7195 16.7934 48.0853 16.7934 53.6126 16.7934C53.6126 14.7257 53.6126 12.6596 53.6126 10.5296C48.2467 10.5296 42.8824 10.5296 37.3537 10.5296Z" fill="#D4D4D4"/>
                            <Path d="M80.7083 3.83506C80.7172 4.19575 80.7172 4.55494 80.7083 4.91563C80.3336 5.30452 79.7575 5.18282 79.2495 5.19915C78.9962 5.20805 78.7429 5.21695 78.4823 5.22734C78.2157 5.23477 77.9476 5.24367 77.6736 5.25257C77.4056 5.26148 77.139 5.27187 76.8635 5.28077C76.2 5.30452 75.5365 5.3253 74.873 5.34756C74.873 5.99324 74.9782 6.57213 75.0952 7.20444C75.6254 10.1745 75.5587 13.1372 75.498 16.1459C75.4299 16.1459 75.3603 16.1459 75.2892 16.1459C75.2847 15.9782 75.2788 15.8104 75.2744 15.6382C75.2492 14.8709 75.224 14.105 75.1988 13.3376C75.1899 13.0748 75.1825 12.8106 75.1736 12.539C75.0655 8.96778 75.0655 8.96778 73.6215 5.7795C73.0543 5.58357 72.6588 5.52271 72.0694 5.49451C71.8931 5.4856 71.7154 5.47671 71.5333 5.4678C71.3496 5.4589 71.166 5.44999 70.9779 5.44108C70.7913 5.43217 70.6046 5.42327 70.4136 5.41288C69.9544 5.39062 69.4953 5.36834 69.0362 5.34756C69.0362 5.20507 69.0362 5.06258 69.0362 4.91563C65.3218 4.91563 61.6073 4.91563 57.7803 4.91563C57.7803 4.84438 57.7803 4.77314 57.7803 4.69893C57.9239 4.69744 58.0691 4.69448 58.2172 4.69299C59.5901 4.67073 60.963 4.64847 62.336 4.6262C63.0424 4.61433 63.7474 4.60244 64.4538 4.59205C69.4731 4.58759 69.4731 4.5876 74.4553 4.05176C74.7604 4.04731 75.064 4.05177 75.3677 4.06513C76.5036 4.08294 77.6011 3.92856 78.7222 3.75341C79.4361 3.64803 80.0226 3.57382 80.7083 3.83506Z" fill="#BAB0A5"/>
                            <Path d="M43.4251 11.1763C43.6769 11.2104 43.6769 11.2104 43.9331 11.246C44.1849 11.2787 44.1849 11.2787 44.4411 11.3113C44.8573 11.3945 44.8573 11.3945 45.0661 11.6097C45.0868 12.2153 45.0957 12.8135 45.0928 13.4191C45.0942 13.6714 45.0942 13.6714 45.0942 13.9296C45.0942 14.651 45.0794 15.2418 44.8573 15.929C44.5285 15.9409 44.1982 15.9498 43.8679 15.9572C43.6843 15.9617 43.5006 15.9661 43.3111 15.9721C42.7468 15.9275 42.4343 15.7628 41.9396 15.4971C41.8019 15.5683 41.6641 15.6396 41.5234 15.7138C41.5234 14.5026 41.5234 13.2899 41.5234 12.0416C41.867 11.8991 42.2106 11.7566 42.5646 11.6097C42.9823 11.1778 42.9823 11.1778 43.4251 11.1763Z" fill="#E5E7E6"/>
                            <Path d="M79.0418 13.7695C79.6313 14.8026 79.5439 15.8416 79.4595 17.0098C79.2507 17.8054 79.2507 17.8054 79.0418 18.3056C78.9041 18.3056 78.7663 18.3056 78.6256 18.3056C78.6375 18.6321 78.6375 18.6321 78.6508 18.9661C78.6242 19.8567 78.4731 20.4905 78.208 21.3291C78.4835 21.4003 78.7589 21.4716 79.0418 21.5443C79.0418 21.6868 79.0418 21.8293 79.0418 21.9763C78.1236 22.2152 77.2735 22.2093 76.333 22.193C76.5389 22.0861 76.5389 22.0861 76.7492 21.9763C76.7447 21.7314 76.7403 21.4864 76.7359 21.2341C76.7492 20.4652 76.7492 20.4652 76.958 20.2485C77.4823 18.2121 77.4986 16.0791 77.583 13.9863C78.208 13.7695 78.208 13.7695 79.0418 13.7695Z" fill="#595959"/>
                            <Path d="M75.9149 5.13107C76.4555 7.96164 76.8953 10.6616 76.7487 13.553C77.5055 13.553 78.2623 13.553 79.0414 13.553C79.0414 13.6243 79.0414 13.6955 79.0414 13.7697C77.9409 13.7697 76.8405 13.7697 75.706 13.7697C75.6512 13.3066 75.5964 12.8435 75.5387 12.3656C75.4839 11.9114 75.4291 11.4572 75.3728 11.0045C75.3358 10.6913 75.2973 10.3781 75.2603 10.0649C74.9789 7.6826 74.9789 7.68259 74.4561 5.3463C74.97 5.08061 75.3476 5.11474 75.9149 5.13107Z" fill="#212121"/>
                            <Path d="M50.0698 11.395C50.4134 11.4663 50.7571 11.5375 51.111 11.6103C51.1806 11.8952 51.2487 12.1802 51.3198 12.4741C51.5953 12.4741 51.8708 12.4741 52.1537 12.4741C52.1537 12.7591 52.1537 13.0441 52.1537 13.338C51.4502 13.2222 50.7585 13.099 50.0698 12.906C50.1083 13.0352 50.1468 13.1643 50.1868 13.2979C50.2787 13.7699 50.2787 13.7699 50.0698 14.4186C50.4134 14.4186 50.7571 14.4186 51.111 14.4186C51.111 14.2761 51.111 14.1336 51.111 13.9866C51.4561 13.9154 51.7997 13.8441 52.1537 13.7699C52.1537 14.1261 52.1537 14.4824 52.1537 14.8505C51.8782 14.8505 51.6042 14.8505 51.3198 14.8505C51.2517 15.1355 51.1821 15.4205 51.111 15.7144C50.7674 15.7856 50.4238 15.8568 50.0698 15.9296C50.018 15.796 49.9662 15.6624 49.9128 15.5244C49.6507 14.9663 49.6507 14.9662 48.8184 14.6338C48.8184 13.85 48.8184 13.0663 48.8184 12.2589C49.1634 12.1876 49.507 12.1164 49.861 12.0422C49.9306 11.8284 49.9988 11.6147 50.0698 11.395Z" fill="#CCCCCC"/>
                            <Path d="M6.50471 5.77832C8.2242 5.77832 9.94371 5.77832 11.7165 5.77832C11.7165 6.27853 11.7165 6.77725 11.7165 7.29082C9.92742 7.29082 8.1398 7.29082 6.2959 7.29082C6.36551 6.7921 6.43362 6.29337 6.50471 5.77832Z" fill="#D7D7D7"/>
                            <Path d="M77.165 5.13086C77.6804 5.23773 77.6804 5.23774 78.2077 5.34609C78.2773 5.75576 78.3469 6.16541 78.415 6.57508C78.455 6.80366 78.4935 7.03078 78.5335 7.2653C78.6135 7.86199 78.6416 8.41712 78.6239 9.01826C78.8312 9.08951 79.0371 9.16074 79.2489 9.23347C79.4799 10.369 79.5717 11.5342 79.4577 12.6904C79.32 12.9042 79.1822 13.1179 79.0415 13.3376C78.766 13.3376 78.4906 13.3376 78.2077 13.3376C78.1958 13.1565 78.184 12.9754 78.1721 12.7899C78.1292 12.119 78.0848 11.4481 78.0403 10.7772C78.0211 10.4877 78.0033 10.1968 77.984 9.90736C77.9574 9.49027 77.9293 9.07317 77.9026 8.65608C77.8848 8.40375 77.8685 8.1529 77.8522 7.89463C77.8256 7.30091 77.8256 7.30092 77.5812 6.85859C77.5857 6.64485 77.5901 6.43112 77.5945 6.20996C77.6538 5.53757 77.6538 5.53756 77.165 5.13086Z" fill="#717171"/>
                            <Path d="M80.7092 3.83543C80.7181 4.19463 80.7181 4.55531 80.7092 4.916C80.5018 5.13122 80.5018 5.13122 79.8842 5.15646C79.6147 5.15497 79.3451 5.15348 79.0667 5.15199C78.8519 5.15199 78.852 5.15199 78.6342 5.15199C78.1751 5.15051 77.716 5.14756 77.2569 5.14459C76.9473 5.1431 76.6363 5.14311 76.3268 5.14162C75.564 5.14014 74.8013 5.13568 74.04 5.13123C74.04 4.77499 74.04 4.41875 74.04 4.05213C74.1807 4.05658 74.3229 4.06105 74.4695 4.06699C75.9224 4.09519 77.3102 3.97939 78.7438 3.75378C79.4518 3.64839 80.0279 3.57716 80.7092 3.83543Z" fill="#C0C0C0"/>
                            <Path d="M77.596 13.7549C77.8996 13.7623 77.8996 13.7623 78.2077 13.7697C78.0018 13.841 77.796 13.9122 77.5827 13.9849C77.5871 14.2388 77.593 14.4911 77.5975 14.7523C77.6227 16.6374 77.5871 18.4037 77.1665 20.2487C77.131 20.4343 77.0969 20.6198 77.0613 20.8113C76.9577 21.3278 76.9577 21.3278 76.7488 21.9764C76.3193 22.1249 76.3194 22.1249 75.915 22.1917C76.0232 21.2195 76.1594 20.2651 76.3327 19.3032C76.5578 17.957 76.6259 16.6181 76.6778 15.2555C76.7385 13.7742 76.7385 13.7742 77.596 13.7549Z" fill="#444444"/>
                            <Path d="M7.538 4.85208C7.74386 4.85208 7.74386 4.85209 7.95565 4.85357C8.39256 4.85803 8.82947 4.86544 9.26786 4.87434C9.56555 4.87731 9.86176 4.88028 10.1595 4.88324C10.8866 4.89067 11.6138 4.90107 12.3425 4.91443C12.2729 5.76939 12.2048 6.62582 12.1337 7.50601C12.0641 7.50601 11.9959 7.50601 11.9249 7.50601C11.8212 6.65105 11.8212 6.65107 11.716 5.7783C9.99653 5.7783 8.27703 5.7783 6.5057 5.7783C6.43609 5.92079 6.36798 6.06328 6.29689 6.21023C6.08806 6.42694 6.08805 6.42694 5.55488 6.4403C5.3031 6.43288 5.3031 6.43287 5.04688 6.42693C5.11945 5.87477 5.20683 5.61204 5.59042 5.21276C6.26578 4.80754 6.76045 4.84169 7.538 4.85208Z" fill="#C5C5C5"/>
                            <Path d="M78.417 13.9849C78.6243 13.9849 78.8302 13.9849 79.0435 13.9849C79.6625 14.9482 79.5411 15.8788 79.4596 17.0084C79.2508 17.8055 79.2508 17.8055 79.0435 18.3042C78.9057 18.3042 78.768 18.3042 78.6258 18.3042C78.6391 18.6322 78.6391 18.6322 78.6525 18.9662C78.6243 19.8553 78.4733 20.4906 78.2096 21.3277C78.4836 21.399 78.7591 21.4702 79.0435 21.5444C79.0435 21.6869 79.0435 21.8294 79.0435 21.9764C78.1149 22.0832 78.1149 22.0832 77.167 22.1916C77.3047 21.9779 77.4425 21.7641 77.5832 21.5444C77.6676 21.1244 77.7357 20.6999 77.792 20.2754C77.9579 19.0478 77.9579 19.0478 78.22 18.4556C78.5118 17.5932 78.4614 16.7679 78.4437 15.861C78.4422 15.6814 78.4392 15.5003 78.4377 15.3148C78.4333 14.871 78.4259 14.4287 78.417 13.9849Z" fill="#848484"/>
                            <Path d="M79.0433 21.5444C79.1129 21.6869 79.181 21.8294 79.2521 21.9764C79.455 21.9719 79.6565 21.9675 79.8653 21.963C80.5036 21.9764 80.5036 21.9764 80.711 22.1931C80.7199 22.6235 80.7199 23.0569 80.711 23.4889C79.7601 23.4577 78.8093 23.4265 77.8585 23.3939C77.5889 23.385 77.3194 23.3761 77.0409 23.3687C76.7818 23.3583 76.5211 23.3494 76.253 23.3405C76.0146 23.333 75.7761 23.3241 75.5288 23.3167C74.9438 23.2766 74.4032 23.192 73.833 23.0569C73.9707 22.7705 74.1085 22.4855 74.2492 22.1931C74.3188 22.3356 74.3869 22.4781 74.458 22.625C75.9716 22.5538 77.4853 22.4825 79.0433 22.4083C78.9752 22.2658 78.9071 22.1233 78.836 21.9764C78.9041 21.8339 78.9737 21.6914 79.0433 21.5444Z" fill="#CECCCB"/>
                            <Path d="M76.751 5.13086C77.2664 5.23773 77.2664 5.23774 77.7922 5.34609C77.7892 5.58655 77.7847 5.82847 77.7803 6.07635C77.7373 6.82296 77.7373 6.82297 78.001 7.29053C78.0513 7.86347 78.0898 8.43047 78.118 9.0049C78.1269 9.16965 78.1357 9.33292 78.1446 9.50213C78.2098 10.7816 78.2335 12.0566 78.2098 13.3376C78.4853 13.4088 78.7593 13.4801 79.0436 13.5543C78.7 13.5543 78.3549 13.5543 78.001 13.5543C77.6633 12.9339 77.5285 12.4707 77.5048 11.7612C77.4989 11.5861 77.4915 11.4095 77.4841 11.2284C77.4782 11.0473 77.4722 10.8662 77.4678 10.6792C77.4248 9.46205 77.3567 8.27757 77.1672 7.0738C77.099 7.0738 77.0294 7.0738 76.9583 7.0738C76.8902 6.43258 76.8221 5.79138 76.751 5.13086Z" fill="#5C5C5C"/>
                            <Path d="M56.9475 21.9766C57.1534 21.9766 57.3592 21.9766 57.5725 21.9766C57.5725 22.1191 57.5725 22.2615 57.5725 22.4085C58.6729 22.4085 59.7733 22.4085 60.9078 22.4085C60.9078 22.4797 60.9078 22.551 60.9078 22.6252C57.3074 22.9235 53.71 22.8241 50.1051 22.7558C49.2757 22.7395 48.4463 22.7261 47.6184 22.7113C46.0026 22.6846 44.3883 22.6549 42.7725 22.6252C42.7725 22.4827 42.7725 22.3387 42.7725 22.1933C42.9472 22.1933 43.122 22.1933 43.3012 22.1948C44.9422 22.1977 46.5832 22.2022 48.2242 22.2037C49.0684 22.2051 49.9126 22.2066 50.7568 22.2096C51.5699 22.2111 52.3829 22.2126 53.1975 22.2126C53.5085 22.214 53.8196 22.214 54.1306 22.2155C54.5645 22.217 54.9985 22.217 55.4324 22.217C55.8042 22.2185 55.8041 22.2185 56.1833 22.2185C56.7224 22.2586 56.7224 22.2586 56.9475 21.9766Z" fill="#A8A8A8"/>
                            <Path d="M42.9816 11.1777C43.4052 11.197 43.4052 11.197 43.9206 11.2594C44.1753 11.2876 44.1753 11.2876 44.4345 11.3173C44.8581 11.3944 44.8581 11.3944 45.0669 11.6097C45.095 12.1871 45.0758 12.76 45.0669 13.3374C44.704 13.4784 44.704 13.4784 44.2331 13.5541C43.7858 13.3389 43.7858 13.3389 43.3459 13.0272C43.1993 12.9247 43.0527 12.8223 42.9001 12.7169C42.7891 12.6368 42.6795 12.5566 42.5654 12.4735C42.7476 11.4211 42.7476 11.4212 42.9816 11.1777Z" fill="#CBCCCC"/>
                            <Path d="M42.2678 13.7549C42.5181 13.7623 42.5181 13.7623 42.7758 13.7697C42.7758 13.9835 42.7758 14.1972 42.7758 14.4169C43.1194 14.4881 43.463 14.5594 43.817 14.6336C43.9473 15.0373 43.9473 15.0373 44.0258 15.4975C43.8881 15.6399 43.7504 15.7824 43.6097 15.9294C43.1135 15.8477 43.1135 15.8478 42.567 15.7127C42.2915 15.7127 42.0161 15.7127 41.7332 15.7127C41.6636 15.7127 41.5954 15.7127 41.5243 15.7127C41.5036 14.3842 41.5036 14.3842 41.5243 13.9849C41.7332 13.7697 41.7332 13.7697 42.2678 13.7549Z" fill="#C8C9C9"/>
                            <Path d="M69.8721 21.9767C70.4112 21.9708 70.9488 21.9663 71.4879 21.9633C71.6404 21.9618 71.7915 21.9604 71.9485 21.9589C72.6831 21.9544 73.3348 21.9871 74.0412 22.1934C73.9731 22.4784 73.9035 22.7634 73.8324 23.0573C72.5261 22.986 71.2183 22.9148 69.8721 22.8406C69.8721 22.5556 69.8721 22.2706 69.8721 21.9767Z" fill="#B8A898"/>
                            <Path d="M79.0415 13.9851C78.8342 13.9851 78.6283 13.9851 78.415 13.9851C78.4358 14.2538 78.455 14.521 78.4758 14.7985C78.4995 15.1518 78.5232 15.5065 78.5454 15.8613C78.5587 16.0379 78.5735 16.2146 78.5869 16.3956C78.6476 17.3768 78.6357 18.0521 78.2077 18.9531C78.1277 19.4548 78.0566 19.9594 77.9989 20.4641C77.9307 20.4641 77.8611 20.4641 77.79 20.4641C77.79 18.3267 77.79 16.1878 77.79 13.9851C78.3099 13.7165 78.5009 13.8174 79.0415 13.9851ZM77.5812 20.4641C77.6508 20.4641 77.7189 20.4641 77.79 20.4641C77.79 20.9628 77.79 21.463 77.79 21.9766C77.5842 21.9766 77.3783 21.9766 77.165 21.9766C77.3472 20.951 77.3472 20.951 77.5812 20.4641Z" fill="#6C6C6C"/>
                            <Path d="M43.3993 4.48242C43.3993 4.69616 43.3993 4.9099 43.3993 5.13106C39.2035 5.13106 35.0077 5.13106 30.6846 5.13106C30.6846 4.98856 30.6846 4.84607 30.6846 4.69912C32.25 4.67092 33.8155 4.64271 35.381 4.61451C36.1082 4.60115 36.8353 4.58779 37.5625 4.57592C38.3978 4.55959 39.2331 4.54476 40.0685 4.52992C40.3306 4.52546 40.5913 4.52101 40.8608 4.51655C41.2237 4.50913 41.2237 4.50913 41.5939 4.50319C41.8072 4.49874 42.0205 4.49578 42.2397 4.49132C42.6262 4.48539 43.0128 4.48242 43.3993 4.48242Z" fill="#ABABAB"/>
                            <Path d="M57.7812 4.69873C61.7712 4.69873 65.7611 4.69873 69.871 4.69873C69.871 4.91247 69.871 5.12622 69.871 5.34589C69.5955 5.34589 69.32 5.34589 69.0372 5.34589C69.0372 5.2034 69.0372 5.06091 69.0372 4.91396C65.3227 4.91396 61.6083 4.91396 57.7812 4.91396C57.7812 4.84271 57.7812 4.77146 57.7812 4.69873Z" fill="#B5B5B5"/>
                            <Path d="M48.8184 11.1782C49.9188 11.1782 51.0207 11.1782 52.1537 11.1782C52.2233 11.8907 52.2914 12.6031 52.3625 13.3379C52.087 13.1954 51.8115 13.0529 51.5287 12.9059C51.7345 12.9059 51.9419 12.9059 52.1537 12.9059C52.1537 12.7634 52.1537 12.6209 52.1537 12.474C51.8782 12.474 51.6042 12.474 51.3198 12.474C51.1821 12.189 51.0444 11.904 50.9037 11.6102C50.095 11.5166 50.095 11.5166 49.7055 11.9337C49.6181 12.0406 49.5322 12.1475 49.4448 12.2588C49.2375 12.1875 49.0316 12.1163 48.8184 12.0421C48.8184 11.7571 48.8184 11.4721 48.8184 11.1782Z" fill="#DDDEDE"/>
                            <Path d="M48.8177 14.6333C49.4768 14.9302 49.65 15.0638 50.0692 15.7139C50.4128 15.6426 50.7564 15.5714 51.1118 15.4972C51.18 15.2834 51.2481 15.0697 51.3192 14.85C51.6643 14.9213 52.0079 14.9925 52.3618 15.0652C52.2937 15.4215 52.2241 15.7777 52.153 16.1458C51.1222 16.1458 50.0899 16.1458 49.0265 16.1458C48.8888 15.7896 48.7511 15.4333 48.6104 15.0652C48.6785 14.9227 48.7481 14.7802 48.8177 14.6333Z" fill="#E0E0E0"/>
                            <Path d="M52.154 13.7695C52.154 14.1258 52.154 14.482 52.154 14.8486C51.8785 14.8486 51.6045 14.8486 51.3202 14.8486C51.2521 15.1336 51.1824 15.4186 51.1113 15.7125C50.7677 15.7837 50.4241 15.855 50.0702 15.9292C49.8347 14.9035 49.8347 14.9035 50.0702 14.4167C50.4138 14.4167 50.7574 14.4167 51.1113 14.4167C51.1113 14.2742 51.1113 14.1317 51.1113 13.9848C51.529 13.7695 51.529 13.7695 52.154 13.7695Z" fill="#9E9E9E"/>
                            <Path d="M17.9717 21.9766C17.9717 22.1191 17.9717 22.2615 17.9717 22.4085C20.7916 22.4085 23.6115 22.4085 26.5173 22.4085C26.5173 22.4797 26.5173 22.551 26.5173 22.6237C23.2842 22.695 20.0525 22.7662 16.7217 22.8404C16.7217 22.6267 16.7217 22.4115 16.7217 22.1918C17.3467 21.9766 17.3467 21.9766 17.9717 21.9766Z" fill="#B5B5B5"/>
                            <Path d="M6.92285 5.99316C8.29874 5.99316 9.67461 5.99316 11.092 5.99316C11.092 6.20839 11.092 6.42215 11.092 6.64182C9.71608 6.64182 8.34021 6.64182 6.92285 6.64182C6.92285 6.42808 6.92285 6.21433 6.92285 5.99316Z" fill="#34A853"/>
                            <Path d="M45.0682 13.9847C45.0001 14.6274 44.9305 15.2686 44.8594 15.9291C44.4476 15.9291 44.0344 15.9291 43.6094 15.9291C43.6434 15.7688 43.6775 15.6085 43.713 15.4437C43.8419 14.8085 43.8419 14.8084 43.8182 13.9847C44.2344 13.7694 44.2344 13.7694 45.0682 13.9847Z" fill="#DEDEDE"/>
                            <Path d="M74.6649 6.85889C74.8026 6.93013 74.9389 7.00286 75.0811 7.07559C75.8838 9.93436 75.5357 13.2087 75.4987 16.1462C75.4291 16.1462 75.361 16.1462 75.2899 16.1462C75.2825 15.8953 75.2825 15.8953 75.2736 15.6385C75.2499 14.8712 75.2247 14.1053 75.198 13.3394C75.1906 13.0752 75.1818 12.8109 75.1744 12.5393C75.1225 10.1644 75.1225 10.1644 74.6382 7.85781C74.5775 7.67079 74.5183 7.48378 74.4561 7.29082C74.5242 7.14833 74.5938 7.00583 74.6649 6.85889Z" fill="#B0B0B0"/>
                            <Path d="M78.2096 21.7612C78.6229 21.9037 79.0346 22.0462 79.4611 22.1932C79.0435 22.6251 79.0435 22.6251 78.5947 22.6741C78.4125 22.6711 78.2318 22.6696 78.0452 22.6667C77.8497 22.6652 77.6528 22.6637 77.4513 22.6622C77.2455 22.6592 77.0396 22.6548 76.8293 22.6518C76.622 22.6489 76.4146 22.6474 76.2013 22.6459C75.6904 22.64 75.178 22.634 74.667 22.6251C74.667 22.4114 74.667 22.1961 74.667 21.9765C74.904 21.9794 75.1424 21.9809 75.3883 21.9839C75.6993 21.9869 76.0103 21.9883 76.3213 21.9898C76.4783 21.9913 76.6353 21.9943 76.7982 21.9958C77.1981 21.9972 77.5994 21.9883 78.0008 21.9765C78.0704 21.9052 78.1386 21.834 78.2096 21.7612Z" fill="#B8B8B8"/>
                            <Path d="M77.1672 6.85693C77.2354 6.85693 77.305 6.85693 77.376 6.85693C77.5701 8.31749 77.6515 9.76619 77.7108 11.2386C77.7182 11.4138 77.7256 11.5874 77.7345 11.767C77.7404 11.9243 77.7463 12.0802 77.7537 12.242C77.7937 12.6977 77.8826 13.1133 78.001 13.5526C77.7952 13.4814 77.5878 13.4101 77.376 13.3374C77.305 12.6175 77.2354 11.8976 77.1672 11.1778C77.148 10.9759 77.1272 10.774 77.1065 10.5662C76.9969 9.39511 76.9169 8.24921 76.9584 7.07364C77.028 7.00239 77.0961 6.93115 77.1672 6.85693Z" fill="#4D4D4D"/>
                            <Path d="M74.0381 4.05176C75.4821 4.15863 75.4821 4.15863 76.9557 4.26699C76.9557 4.33824 76.9557 4.40948 76.9557 4.48369C77.5748 4.59056 77.5748 4.59057 78.2058 4.69892C78.2058 4.77017 78.2058 4.84141 78.2058 4.91562C76.8313 4.98687 75.4554 5.05812 74.0381 5.13085C74.0381 4.77462 74.0381 4.41838 74.0381 4.05176Z" fill="#CCCAC9"/>
                            <Path d="M57.5728 4.48389C57.5728 4.76887 57.5728 5.05386 57.5728 5.34775C57.4706 5.31361 57.3669 5.27949 57.2603 5.24386C56.5316 5.08653 55.8044 5.08058 55.0624 5.06276C54.901 5.05831 54.741 5.05385 54.5752 5.0494C54.0627 5.03604 53.5518 5.02268 53.0393 5.01081C52.6913 5.00042 52.3432 4.99152 51.9967 4.98261C51.1451 4.95886 50.295 4.9366 49.4434 4.91582C49.4434 4.84457 49.4434 4.77333 49.4434 4.69912C50.5008 4.66943 51.5583 4.63827 52.6158 4.6071C52.9756 4.59671 53.3341 4.5863 53.6939 4.57591C54.2108 4.56107 54.7277 4.54622 55.2446 4.53138C55.406 4.52693 55.5675 4.521 55.7334 4.51655C56.3465 4.49873 56.9596 4.48389 57.5728 4.48389Z" fill="#A2A2A2"/>
                            <Path d="M78.4163 13.9849C78.6222 13.9849 78.8295 13.9849 79.0413 13.9849C79.0413 15.1975 79.0413 16.4087 79.0413 17.657C78.9036 17.7283 78.7673 17.7995 78.6251 17.8723C78.3734 17.0915 78.3941 16.3776 78.403 15.5642C78.4045 15.4128 78.406 15.2614 78.406 15.1055C78.4089 14.7315 78.4119 14.3589 78.4163 13.9849Z" fill="#959595"/>
                            <Path d="M51.112 12.689C51.1801 12.9027 51.2497 13.1164 51.3208 13.3376C51.74 13.4949 51.7399 13.4949 52.1532 13.5528C51.8096 13.6953 51.466 13.8378 51.112 13.9848C51.112 14.1273 51.112 14.2698 51.112 14.4167C50.7684 14.4167 50.4233 14.4167 50.0693 14.4167C50.0693 13.918 50.0693 13.4192 50.0693 12.9057C50.4129 12.8344 50.758 12.7632 51.112 12.689Z" fill="#E6E6E6"/>
                            <Path d="M43.4009 4.69922C45.3944 4.69922 47.3893 4.69922 49.445 4.69922C49.445 4.77047 49.445 4.84172 49.445 4.91445C49.3251 4.92039 49.2036 4.92633 49.0792 4.93078C45.9231 5.06734 45.9231 5.06733 42.7744 5.34638C42.9818 5.27514 43.1876 5.20388 43.4009 5.13115C43.4009 4.98866 43.4009 4.84616 43.4009 4.69922Z" fill="#B8B8B8"/>
                            <Path d="M74.8722 17.4419C75.01 17.4419 75.1477 17.4419 75.2899 17.4419C75.2662 17.9273 75.2395 18.4141 75.2114 18.8995C75.1892 19.3047 75.1892 19.3047 75.167 19.7188C75.0914 20.3808 74.9981 20.7712 74.6634 21.3293C74.4131 19.9266 74.542 18.8223 74.8722 17.4419Z" fill="#B6B6B6"/>
                            <Path d="M78.4146 7.93896C78.4843 7.93896 78.5524 7.93896 78.6235 7.93896C78.6531 8.18388 78.6842 8.42879 78.7153 8.68112C78.7508 9.40843 78.7508 9.40843 79.0411 9.6667C79.0559 10.1016 79.0574 10.5395 79.053 10.9759C79.0515 11.2133 79.05 11.4523 79.0485 11.6987C79.0456 11.8828 79.0426 12.0668 79.0411 12.2583C78.9715 12.2583 78.9034 12.2583 78.8323 12.2583C78.8323 11.8308 78.8323 11.4019 78.8323 10.9625C78.6946 10.9625 78.5568 10.9625 78.4146 10.9625C78.2251 9.88786 78.2251 9.01212 78.4146 7.93896Z" fill="#A0A0A0"/>
                            <Path d="M78.8348 14.4185C79.0407 14.4897 79.248 14.5609 79.4598 14.6337C79.5368 17.1228 79.5368 17.1228 79.0436 18.3058C78.9059 18.3058 78.7682 18.3058 78.626 18.3058C78.6956 18.0921 78.7637 17.8784 78.8348 17.6572C78.8496 17.1021 78.8541 16.5529 78.8481 15.9978C78.8467 15.7707 78.8467 15.7707 78.8452 15.5376C78.8422 15.1651 78.8393 14.791 78.8348 14.4185Z" fill="#5E5E5E"/>
                            <Path d="M42.3573 11.8267C42.5631 12.1116 42.769 12.3966 42.9823 12.6905C42.7216 13.0141 42.7216 13.0141 42.3573 13.3392C42.0818 13.3392 41.8063 13.3392 41.5234 13.3392C41.5234 12.9117 41.5234 12.4827 41.5234 12.0434C41.7974 11.9721 42.0729 11.9009 42.3573 11.8267Z" fill="#CFD0D0"/>
                            <Path d="M78.624 9.01855C78.8314 9.0898 79.0372 9.16104 79.2505 9.23526C79.4845 10.393 79.4786 11.5137 79.4579 12.6907C79.252 12.762 79.0461 12.8332 78.8329 12.9059C78.8358 12.6803 78.8373 12.4532 78.8402 12.2202C78.8417 11.9219 78.8447 11.625 78.8462 11.3266C78.8477 11.1782 78.8491 11.0283 78.8506 10.8754C78.8551 10.1956 78.8329 9.6672 78.624 9.01855Z" fill="#5C5C5C"/>
                            <Path d="M50.0702 11.3931C50.4138 11.4643 50.7588 11.5356 51.1128 11.6098C51.0432 11.966 50.9751 12.3222 50.904 12.6889C50.5604 12.6176 50.2168 12.5464 49.8613 12.4736C49.9309 12.1174 49.9991 11.7612 50.0702 11.3931Z" fill="#7E8080"/>
                            <Path d="M80.7098 3.83522C80.7098 3.97771 80.7098 4.1202 80.7098 4.26715C79.6094 4.26715 78.509 4.26715 77.376 4.26715C78.4246 3.72389 79.5635 3.38992 80.7098 3.83522Z" fill="#B5B5B5"/>
                            <Path d="M56.9473 21.978C57.1531 21.978 57.359 21.978 57.5723 21.978C57.5723 22.1205 57.5723 22.263 57.5723 22.41C58.6727 22.41 59.7731 22.41 60.9076 22.41C60.9076 22.4812 60.9076 22.5525 60.9076 22.6252C58.9467 22.7321 58.9467 22.7321 56.9473 22.8419C56.9473 22.5554 56.9473 22.2704 56.9473 21.978Z" fill="#959595"/>
                            <Path d="M76.9591 13.7695C77.0953 13.7695 77.2331 13.7695 77.3752 13.7695C77.1738 15.8015 77.1738 15.8015 76.9591 16.7931C76.8894 16.7931 76.8213 16.7931 76.7502 16.7931C76.7443 16.33 76.7399 15.8654 76.7369 15.4023C76.7339 15.144 76.7325 14.8857 76.7295 14.6201C76.7502 13.9848 76.7502 13.9848 76.9591 13.7695Z" fill="#3A3A3A"/>
                            <Path d="M78.417 10.9629C78.5547 10.9629 78.6925 10.9629 78.8332 10.9629C78.9028 11.7466 78.9709 12.5303 79.042 13.3378C78.8361 13.3378 78.6288 13.3378 78.417 13.3378C78.417 12.5541 78.417 11.7704 78.417 10.9629Z" fill="#7A7A7A"/>
                            <Path d="M42.7738 14.6333C42.9115 14.6333 43.0492 14.6333 43.1914 14.6333C43.1914 14.847 43.1914 15.0608 43.1914 15.282C43.3973 15.282 43.6046 15.282 43.8164 15.282C43.7483 15.4957 43.6787 15.7094 43.6076 15.9291C43.264 15.8579 42.9204 15.7866 42.5664 15.7139C42.6345 15.3577 42.7042 15.0014 42.7738 14.6333Z" fill="#6A6C6B"/>
                            <Path d="M41.9393 15.2803C42.4947 15.5682 43.0516 15.8562 43.6069 16.1441C42.9879 16.1441 42.3688 16.1441 41.7305 16.1441C41.7305 15.497 41.7305 15.497 41.9393 15.2803Z" fill="#E1E2E2"/>
                            <Path d="M44.2332 13.7695C44.645 13.8764 44.645 13.8764 45.0671 13.9848C44.9975 14.2697 44.9293 14.5547 44.8582 14.8486C44.5828 14.7774 44.3073 14.7061 44.0244 14.6334C44.094 14.3484 44.1621 14.0634 44.2332 13.7695Z" fill="#C5C5C5"/>
                            <Path d="M42.7738 11.395C42.9811 11.395 43.187 11.395 43.4002 11.395C43.4684 11.8225 43.538 12.25 43.6076 12.6908C43.264 12.6196 42.9204 12.5483 42.5664 12.4741C42.6345 12.1179 42.7042 11.7616 42.7738 11.395Z" fill="#676969"/>
                            <Path d="M41.7308 11.1797C42.144 11.1797 42.5572 11.1797 42.9823 11.1797C42.7216 11.6116 42.7216 11.6116 42.3573 12.0436C42.0818 12.0436 41.8063 12.0436 41.5234 12.0436C41.5916 11.7586 41.6597 11.4736 41.7308 11.1797Z" fill="#E1E2E2"/>
                            <Path d="M69.8701 21.978C70.2137 21.978 70.5588 21.978 70.9128 21.978C70.9128 22.263 70.9128 22.548 70.9128 22.8419C70.5692 22.8419 70.2241 22.8419 69.8701 22.8419C69.8701 22.5554 69.8701 22.2704 69.8701 21.978Z" fill="#5F5F5F"/>
                            <Path d="M69.8721 4.48242C70.2157 4.48242 70.5608 4.48242 70.9147 4.48242C70.9147 4.76741 70.9147 5.0524 70.9147 5.34629C70.5711 5.34629 70.226 5.34629 69.8721 5.34629C69.8721 5.0613 69.8721 4.77631 69.8721 4.48242Z" fill="#5E5E5E"/>
                            <Path d="M5.25539 4.69873C5.39313 4.91247 5.52939 5.12622 5.67158 5.34589C5.38573 5.88618 5.38572 5.88618 5.04656 6.42646C4.90882 6.42646 4.77109 6.42646 4.62891 6.42646C4.7859 5.1841 4.7859 5.1841 5.25539 4.69873Z" fill="#BEBEBE"/>
                            <Path d="M79.0428 21.5444C79.1109 21.6869 79.1806 21.8294 79.2502 21.9764C79.6634 21.9764 80.0766 21.9764 80.5016 21.9764C80.5698 22.1901 80.6394 22.4038 80.7105 22.625C79.7818 22.4113 79.7819 22.4113 78.834 22.1931C78.9021 21.9778 78.9717 21.7641 79.0428 21.5444Z" fill="#C9C9C9"/>
                            <Path d="M17.9717 21.9766C17.8339 22.2615 17.6962 22.5465 17.554 22.8404C17.28 22.8404 17.0046 22.8404 16.7217 22.8404C16.7217 22.6267 16.7217 22.4115 16.7217 22.1918C17.3467 21.9766 17.3467 21.9766 17.9717 21.9766Z" fill="#7E7E7E"/>
                            <Path d="M5.46403 5.34619C5.60177 5.34619 5.7395 5.34619 5.88168 5.34619C5.88168 5.70391 5.88168 6.06014 5.88168 6.42676C5.60621 6.42676 5.33073 6.42676 5.04785 6.42676C5.23002 5.58961 5.23003 5.58962 5.46403 5.34619Z" fill="#E4E4E4"/>
                          </G>
                      </Svg>


                      <View style={{
                        width : 50,
                        height : 4,
                        borderRadius : 24,
                        backgroundColor : '#f4f4f4'
                      }}/>

                    </View>

                  <View style={{
                    display : 'flex',
                    gap : 4,
                    alignItems : 'center'
                  }}>
                    <Text style={{
                      fontWeight : '700',
                      fontSize : 14
                    }}>KSB</Text>
                     <Text style={{
                      fontSize : 10,
                      color : 'rgba(0,0,0,0.5)'
                    }}>Campus</Text>
                    <Text style={{
                      fontSize : 12,
                      color : 'rgba(0,0,0,0.6)',
                      padding : 4,
                      backgroundColor : '#fafafa',
                      borderRadius : 6
                    }}>Stop</Text>
                  </View>

                </View>

                   <View style={{
                  display : 'flex',
                  flexDirection : 'row',
                  alignItems : 'center',
                  justifyContent : 'space-between',
                  padding : 16,
                  borderWidth : 1,
                  borderRadius : 16,
                  borderColor : 'rgba(0,0,0,0.1)',
                  backgroundColor : '#fff'
                }}>

                  <View style={{
                    display : 'flex',
                    gap : 4,
                    alignItems : 'center'
                  }}>
                    <Text style={{
                      fontWeight : '700',
                      fontSize : 14,
                      // maxWidth : 100,
                      textAlign : 'center'
                    }}>Gaza</Text>
                     <Text style={{
                      fontSize : 10,
                      color : 'rgba(0,0,0,0.5)'
                    }}>Off Campus</Text>
                    <Text style={{
                      fontSize : 12,
                      color : 'rgba(0,0,0,0.6)',
                      padding : 4,
                      backgroundColor : '#fafafa',
                      borderRadius : 6
                    }}>Start</Text>
                  </View>

                    <View style ={{
                      display : 'flex',
                      flexDirection : 'row',
                      gap : 12,
                      alignItems : 'center'
                    }}>
                      <View style={{
                        width : 30,
                        height : 2,
                        borderRadius : 24,
                        backgroundColor : '#34A853'
                      }}/>

                        {/* <Svg xmlns="http://www.w3.org/2000/svg" width="57" height="36" viewBox="0 0 57 36" fill="none">
                          <Path d="M31.0068 10.9014H30.0068C26.1408 10.9014 23.0068 14.0354 23.0068 17.9014C23.0068 21.7674 26.1408 24.9014 30.0068 24.9014H31.0068C34.8728 24.9014 38.0068 21.7674 38.0068 17.9014C38.0068 14.0354 34.8728 10.9014 31.0068 10.9014Z" fill="#699635" fill-opacity="0.8"/>
                          <Path d="M42.0068 17.4014C42.0068 11.0501 36.8581 5.90137 30.5068 5.90137C24.1556 5.90137 19.0068 11.0501 19.0068 17.4014C19.0068 23.7526 24.1556 28.9014 30.5068 28.9014C36.8581 28.9014 42.0068 23.7526 42.0068 17.4014Z" fill="#699635" fill-opacity="0.4"/>
                          <Path d="M45.0068 17.4014C45.0068 9.39324 38.515 2.90137 30.5068 2.90137C22.4987 2.90137 16.0068 9.39324 16.0068 17.4014C16.0068 25.4095 22.4987 31.9014 30.5068 31.9014C38.515 31.9014 45.0068 25.4095 45.0068 17.4014Z" fill="#699635" fill-opacity="0.1"/>
                          <Mask id="mask0_945_306" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="9" width="57" height="18">
                            <Path d="M56.4984 9.09326H0.625V26.5537H56.4984V9.09326Z" fill="white"/>
                          </Mask>
                          <G mask="url(#mask0_945_306)">
                            <Path d="M39.1878 12.4398C39.1413 12.5359 39.0949 12.6319 39.0471 12.7308C33.6596 12.7789 28.2721 12.8269 22.7213 12.8763C22.7213 16.0934 22.7213 19.3105 22.7213 22.6251C23.0422 22.7909 23.2291 22.792 23.5858 22.7981C23.7061 22.8006 23.8263 22.803 23.9502 22.8055C24.0802 22.8075 24.2102 22.8095 24.3442 22.8115C24.4775 22.8142 24.6107 22.8169 24.748 22.8196C25.1749 22.8282 25.6018 22.8359 26.0287 22.8433C26.5902 22.8532 27.1517 22.8639 27.7132 22.8752C27.8432 22.8771 27.9732 22.8791 28.1072 22.8811C28.2275 22.8836 28.3477 22.886 28.4716 22.8885C28.5776 22.8903 28.6836 22.8922 28.7929 22.894C29.0546 22.9161 29.0546 22.9161 29.3361 23.0616C29.3361 23.1576 29.3361 23.2537 29.3361 23.3526C20.9762 23.3526 12.6163 23.3526 4.00304 23.3526C3.9566 23.1605 3.91016 22.9685 3.8623 22.7706C4.04808 22.7706 4.23386 22.7706 4.42526 22.7706C4.42526 19.7936 4.42526 16.8166 4.42526 13.7494C5.77213 13.7494 7.119 13.7494 8.50669 13.7494C8.50669 13.3172 8.50669 12.8851 8.50669 12.4398C12.4447 12.4174 16.3826 12.3959 20.3206 12.3754C22.149 12.3658 23.9774 12.356 25.8057 12.3455C27.3989 12.3364 28.992 12.3278 30.5852 12.3198C31.4292 12.3155 32.2731 12.311 33.1171 12.3059C33.9108 12.3011 34.7045 12.2969 35.4982 12.2933C35.7901 12.2919 36.082 12.2902 36.3739 12.2882C36.7713 12.2856 37.1687 12.2839 37.5661 12.2824C37.6826 12.2814 37.7991 12.2804 37.9191 12.2794C38.3795 12.2784 38.7477 12.2882 39.1878 12.4398Z" fill="#34A853"/>
                            <Path d="M48.8909 12.3752C51.362 11.4939 51.2916 19.3104 51.2916 22.6249C51.6125 22.7908 50.5127 22.8878 50.8694 22.8939C50.9897 22.8963 50.6583 23.0615 52.5205 22.8054C50.6793 23.0586 50.4645 23.1938 52.5821 22.8639C51.982 22.9576 51.3855 23.0442 50.8694 23.1171C50.877 23.1172 50.8659 23.1187 50.8393 23.1213C50.5146 23.1671 50.2228 23.2073 49.9834 23.2403C50.1187 23.2371 50.2496 23.2338 50.3681 23.2305C50.394 23.2277 50.4203 23.2249 50.4472 23.222C50.4926 23.2172 50.5395 23.2121 50.5879 23.207C51.0148 23.2155 50.4425 23.1995 50.8694 23.207C50.9722 23.2088 50.8559 23.215 50.6303 23.2225C51.2938 23.2265 51.208 23.2532 51.0805 23.2815C50.9251 23.3159 50.7077 23.3525 51.7139 23.3525H49.2645C48.8532 23.3639 48.6624 23.3624 48.6219 23.3525H32.5734L32.4326 22.7704H32.9956V13.7492H37.077V12.4397C41.015 12.4173 44.8176 12.0759 48.8909 12.3752Z" fill="#34A853"/>
                            <Path 
                            d="M23.5481 13.2951C23.7223 13.2953 23.7223 13.2953 23.9 13.2955C24.0328 13.2953 24.1656 13.2951 24.3025 13.2949C24.4493 13.2954 24.5962 13.296 24.7476 13.2965C24.9013 13.2965 25.0551 13.2965 25.2135 13.2964C25.7245 13.2965 26.2355 13.2977 26.7465 13.2988C27.0997 13.2991 27.4529 13.2993 27.8061 13.2994C28.6425 13.2999 29.4788 13.3011 30.3152 13.3025C31.5274 13.3046 32.7396 13.3054 33.9517 13.3063C35.6503 13.3077 37.3488 13.3105 39.0474 13.313C39.0474 16.338 39.0474 19.3631 39.0474 22.4798C33.7992 22.4798 28.5511 22.4798 23.1439 22.4798C23.141 20.9943 23.1381 19.5087 23.1351 17.9782C23.1338 17.5086 23.1325 17.0389 23.1312 16.5551C23.1308 16.1854 23.1304 15.8158 23.1301 15.4461C23.1298 15.3495 23.1294 15.2528 23.129 15.1533C23.128 14.8699 23.1279 14.5865 23.1279 14.3032C23.1276 14.1432 23.1273 13.9833 23.127 13.8185C23.1503 13.3222 23.1503 13.3222 23.5481 13.2951Z" fill="#34A853"/>
                            <Path d="M54.8102 11.2757C54.8162 11.5181 54.8159 11.7608 54.8102 12.0032C54.5653 12.2563 54.22 12.2028 53.8866 12.2305C53.6729 12.2488 53.6729 12.2488 53.455 12.2675C53.3449 12.2763 53.2348 12.2851 53.1213 12.2942C53.1416 12.4118 53.1619 12.5294 53.1829 12.6506C53.209 12.8061 53.2351 12.9615 53.262 13.1217C53.2882 13.2754 53.3143 13.429 53.3412 13.5872C53.3958 13.9892 53.4144 14.3629 53.4028 14.7678C53.5421 14.8158 53.6814 14.8638 53.825 14.9133C53.982 15.6845 54.0144 16.4558 53.9657 17.2413C53.9193 17.2893 53.8728 17.3373 53.825 17.3868C53.8015 17.8961 53.8015 17.8961 53.825 18.4053C53.8714 18.4534 53.9179 18.5014 53.9657 18.5508C54.0271 19.4176 54.0225 20.2158 53.6843 21.0244C53.5914 21.0244 53.4985 21.0244 53.4028 21.0244C53.4086 21.1715 53.4144 21.3185 53.4204 21.47C53.402 22.0692 53.2997 22.4967 53.1213 23.0615C53.3535 23.1095 53.5857 23.1575 53.825 23.207C53.825 23.303 53.825 23.399 53.825 23.498C53.9614 23.495 54.0979 23.492 54.2384 23.4889C54.6694 23.498 54.6694 23.498 54.8102 23.6435C54.8159 23.9344 54.8162 24.2256 54.8102 24.5165C54.1768 24.4961 53.5435 24.4746 52.9102 24.4528C52.7317 24.4471 52.5532 24.4414 52.3692 24.4355C52.1951 24.4294 52.0209 24.4233 51.8415 24.417C51.6823 24.4117 51.5231 24.4064 51.359 24.4009C50.8695 24.371 50.8695 24.371 50.3923 24.2975C49.5578 24.1881 48.7216 24.2056 47.8818 24.2074C47.6932 24.2072 47.5047 24.207 47.3161 24.2067C46.9076 24.2063 46.4991 24.2063 46.0905 24.2067C45.4258 24.2073 44.761 24.2069 44.0962 24.2063C43.2561 24.2057 42.416 24.2054 41.576 24.2054C39.9261 24.2054 38.2762 24.2036 36.6263 24.2011C36.3664 24.2007 36.1065 24.2003 35.8466 24.2C35.4528 24.1994 35.059 24.1988 34.6652 24.1982C33.1818 24.1961 31.6985 24.1941 30.2151 24.1923C30.0795 24.1921 29.944 24.192 29.8043 24.1918C27.6052 24.1893 25.406 24.1888 23.2069 24.1891C20.9487 24.1893 18.6905 24.1867 16.4323 24.1817C15.0394 24.1787 13.6466 24.1779 12.2538 24.18C11.3 24.1812 10.3463 24.1798 9.39262 24.1763C8.8421 24.1743 8.29164 24.1736 7.74113 24.176C7.23734 24.1782 6.73367 24.177 6.2299 24.1732C5.96099 24.1721 5.69208 24.1745 5.42319 24.177C4.12158 24.1618 4.12158 24.1618 3.68479 23.7415C3.36266 23.2286 3.35204 22.8896 3.35161 22.2797C3.3501 22.1216 3.3501 22.1216 3.34856 21.9603C3.34619 21.6134 3.34891 21.2668 3.35192 20.9198C3.3518 20.6779 3.35145 20.4361 3.35089 20.1942C3.35048 19.6878 3.35255 19.1815 3.35642 18.6751C3.36122 18.0268 3.36037 17.3786 3.35773 16.7303C3.35624 16.231 3.35751 15.7317 3.35962 15.2324C3.36035 14.9934 3.36028 14.7544 3.3594 14.5154C3.35863 14.181 3.3615 13.8469 3.36535 13.5125C3.36622 13.3224 3.36709 13.1324 3.36799 12.9366C3.45942 12.3094 3.53029 12.1234 4.00338 11.7122C4.60101 11.5986 5.19578 11.6144 5.80187 11.6201C5.99043 11.6193 6.17898 11.6182 6.36753 11.6168C6.88617 11.6138 7.40472 11.6153 7.92336 11.6176C8.48249 11.6192 9.04162 11.6167 9.60075 11.6146C10.5698 11.6116 11.5389 11.6113 12.508 11.6128C13.9101 11.6148 15.3121 11.6128 16.7142 11.6096C18.99 11.6047 21.2659 11.6029 23.5418 11.6031C25.7507 11.6034 27.9596 11.6025 30.1685 11.5999C30.3725 11.5996 30.3725 11.5996 30.5806 11.5994C32.0652 11.5976 33.5499 11.5955 35.0345 11.5934C35.4283 11.5928 35.8221 11.5922 36.2159 11.5916C36.4755 11.5913 36.7351 11.5909 36.9947 11.5905C38.6469 11.5881 40.299 11.5868 41.9512 11.5868C42.7848 11.5867 43.6184 11.5862 44.4521 11.5856C45.1114 11.5851 45.7707 11.5852 46.43 11.5858C46.8301 11.586 47.2301 11.5856 47.6302 11.585C47.9001 11.5848 48.1701 11.5853 48.44 11.5859C48.6007 11.5855 48.7614 11.5852 48.9269 11.5848C49.0652 11.5848 49.2035 11.5848 49.346 11.5848C49.7694 11.5655 50.1711 11.4979 50.588 11.4212C50.7932 11.4185 50.9986 11.4215 51.2037 11.4303C51.9705 11.4424 52.7118 11.3384 53.4684 11.2209C53.9509 11.15 54.3465 11.0999 54.8102 11.2757ZM36.9366 12.3014C32.794 12.3177 28.6513 12.3376 24.5086 12.359C22.7576 12.368 21.0066 12.3767 19.2556 12.3854C15.6727 12.4032 12.0899 12.4213 8.50703 12.4397C8.50703 12.8718 8.50703 13.304 8.50703 13.7492C7.16016 13.7492 5.81329 13.7492 4.4256 13.7492C4.4256 16.7262 4.4256 19.7032 4.4256 22.7705C4.19338 22.7705 3.96116 22.7705 3.72191 22.7705C3.76835 23.0105 3.81479 23.2506 3.86265 23.498C18.9569 23.498 34.0512 23.498 49.6028 23.498C49.6028 23.4019 49.6028 23.3059 49.6028 23.207C49.6895 23.1933 49.7763 23.1796 49.8656 23.1655C50.1754 23.0893 50.1754 23.0893 50.334 22.8438C51.03 21.3412 51.0622 19.8176 51.0542 18.178C51.054 18.0751 51.0539 17.9723 51.0537 17.8663C51.1204 15.0888 51.1204 15.0888 50.1658 12.5852C49.706 12.2792 49.3354 12.2584 48.795 12.26C48.5451 12.2597 48.5451 12.2597 48.2902 12.2594C48.0144 12.2613 48.0144 12.2613 47.733 12.2632C47.5346 12.2636 47.3363 12.2638 47.138 12.2639C46.588 12.2645 46.0382 12.267 45.4882 12.2698C44.8902 12.2726 44.2921 12.2737 43.6941 12.275C42.3451 12.2784 40.9961 12.2842 39.6472 12.2903C38.7437 12.2944 37.8402 12.2979 36.9366 12.3014Z" fill="#C4C4C3"/>
                            <Path d="M25.2539 15.4951C29.0623 15.4951 32.8707 15.4951 36.7945 15.4951C36.7945 17.0797 36.7945 18.6642 36.7945 20.2967C32.9861 20.2967 29.1777 20.2967 25.2539 20.2967C25.2539 18.7122 25.2539 17.1277 25.2539 15.4951Z" fill="#34A853"/>
                            <Path d="M51.9337 12.1306C52.0319 12.1301 52.1302 12.1295 52.2314 12.1289C52.9626 12.1304 52.9626 12.1304 53.1212 12.2943C53.1776 12.5719 53.2262 12.8512 53.2707 13.131C53.2956 13.2833 53.3204 13.4356 53.346 13.5925C53.3965 13.9915 53.4135 14.3664 53.4027 14.7679C53.542 14.8159 53.6813 14.8639 53.8249 14.9134C53.9819 15.6846 54.0143 16.4559 53.9656 17.2415C53.9192 17.2895 53.8727 17.3375 53.8249 17.387C53.8014 17.8962 53.8014 17.8962 53.8249 18.4055C53.8946 18.4775 53.8946 18.4775 53.9656 18.551C54.027 19.4177 54.0224 20.216 53.6841 21.0246C53.5913 21.0246 53.4984 21.0246 53.4027 21.0246C53.4085 21.1716 53.4143 21.3187 53.4203 21.4702C53.4019 22.0694 53.2996 22.4968 53.1212 23.0616C53.307 23.1096 53.4927 23.1576 53.6841 23.2071C53.6841 23.3031 53.6841 23.3992 53.6841 23.4981C53.1099 23.6392 52.5672 23.6677 51.9777 23.6709C51.7203 23.674 51.7203 23.674 51.4576 23.6772C51.0101 23.6436 51.0101 23.6436 50.5879 23.3526C50.6311 23.2344 50.6742 23.1163 50.7187 22.9945C51.6341 19.8653 51.5868 15.3926 50.5879 12.2943C51.0171 12.0725 51.4635 12.1279 51.9337 12.1306Z" fill="#282828"/>
                            <Path d="M22.7208 12.8765C24.9204 12.8731 27.12 12.8705 29.3196 12.869C30.3408 12.8682 31.362 12.8672 32.3833 12.8655C33.2731 12.8641 34.1629 12.8631 35.0527 12.8628C35.5241 12.8626 35.9955 12.8622 36.4669 12.8611C36.9924 12.8601 37.5178 12.8599 38.0432 12.86C38.2006 12.8595 38.358 12.8589 38.5202 12.8584C38.6625 12.8586 38.8048 12.8588 38.9514 12.859C39.1381 12.8588 39.1381 12.8588 39.3284 12.8586C39.6095 12.8765 39.6095 12.8765 39.7503 13.022C39.7635 13.3256 39.7668 13.6296 39.7662 13.9334C39.7663 14.0285 39.7663 14.1236 39.7663 14.2216C39.7662 14.5373 39.7651 14.853 39.764 15.1688C39.7637 15.3871 39.7635 15.6055 39.7634 15.8238C39.7629 16.3996 39.7615 16.9754 39.7599 17.5511C39.7585 18.1383 39.7578 18.7254 39.7571 19.3125C39.7556 20.4652 39.7532 21.618 39.7503 22.7707C37.5323 22.7741 35.3144 22.7767 33.0965 22.7783C32.0667 22.779 31.037 22.7801 30.0072 22.7817C29.11 22.7832 28.2128 22.7841 27.3156 22.7844C26.8402 22.7846 26.3649 22.7851 25.8895 22.7861C25.3597 22.7872 24.8299 22.7873 24.3001 22.7873C24.1413 22.7878 23.9826 22.7883 23.8191 22.7888C23.6038 22.7885 23.6038 22.7885 23.3843 22.7882C23.2588 22.7884 23.1334 22.7885 23.0041 22.7886C22.7208 22.7707 22.7208 22.7707 22.5801 22.6252C22.5661 22.3322 22.5621 22.0386 22.5619 21.7452C22.5614 21.5568 22.561 21.3684 22.5605 21.1742C22.5608 20.967 22.5611 20.7597 22.5614 20.5524C22.5613 20.3412 22.5612 20.1301 22.561 19.919C22.5608 19.4758 22.5611 19.0326 22.5618 18.5895C22.5626 18.0207 22.5621 17.452 22.5613 16.8833C22.5607 16.447 22.5609 16.0108 22.5613 15.5745C22.5614 15.3648 22.5612 15.1551 22.5609 14.9454C22.5606 14.6524 22.5612 14.3594 22.5619 14.0664C22.562 13.8995 22.5621 13.7326 22.5622 13.5606C22.5801 13.1675 22.5801 13.1675 22.7208 12.8765ZM23.1431 13.4585C23.1298 13.7398 23.1265 14.0216 23.1271 14.3032C23.1271 14.4863 23.1271 14.6694 23.1271 14.8581C23.1278 15.0541 23.1286 15.2501 23.1293 15.4461C23.1295 15.6233 23.1296 15.8005 23.1297 15.9831C23.1305 16.6481 23.1324 17.3132 23.1343 17.9782C23.1372 19.4637 23.1401 20.9492 23.1431 22.4797C28.3912 22.4797 33.6394 22.4797 39.0466 22.4797C39.0466 19.4547 39.0466 16.4297 39.0466 13.313C36.2484 13.3088 36.2484 13.3088 33.4503 13.3059C32.3098 13.305 31.1694 13.304 30.029 13.302C29.1101 13.3004 28.1912 13.2996 27.2722 13.2992C26.9208 13.2989 26.5693 13.2984 26.2179 13.2976C25.7275 13.2966 25.2371 13.2964 24.7467 13.2965C24.5999 13.296 24.453 13.2954 24.3016 13.2949C24.1688 13.2951 24.036 13.2953 23.8991 13.2955C23.783 13.2954 23.6669 13.2952 23.5473 13.2951C23.2818 13.2831 23.2818 13.2831 23.1431 13.4585Z" fill="#34A853" fill-opacity="0.6"/>
                            <Path d="M4.7458 11.6182C4.84383 11.6203 4.94185 11.6224 5.04285 11.6246C5.14793 11.624 5.25301 11.6233 5.36127 11.6227C5.71359 11.6215 6.06567 11.6255 6.41796 11.6295C6.6704 11.6297 6.92284 11.6296 7.17528 11.6292C7.86093 11.629 8.54649 11.6332 9.23212 11.6383C9.94851 11.6429 10.6649 11.6433 11.3813 11.6441C12.7381 11.6464 14.0948 11.6524 15.4515 11.6597C16.9961 11.6678 18.5406 11.6718 20.0851 11.6755C23.2625 11.6831 26.4399 11.6959 29.6172 11.7121C29.6172 11.8561 29.6172 12.0002 29.6172 12.1486C29.4879 12.1482 29.3586 12.1478 29.2254 12.1474C26.081 12.1377 22.9367 12.1305 19.7924 12.126C18.2718 12.1237 16.7513 12.1206 15.2307 12.1157C13.9056 12.1113 12.5806 12.1085 11.2555 12.1075C10.5536 12.1069 9.8518 12.1056 9.14997 12.1024C8.48968 12.0995 7.82941 12.0986 7.16911 12.0992C6.92651 12.0991 6.68391 12.0982 6.44131 12.0965C6.11052 12.0944 5.77983 12.0949 5.44904 12.0961C5.26378 12.0957 5.07852 12.0953 4.88765 12.0949C4.3976 12.1518 4.20121 12.2219 3.86199 12.5851C3.81554 12.7291 3.7691 12.8732 3.72125 13.0216C3.95347 13.0216 4.18568 13.0216 4.42494 13.0216C4.47139 12.8295 4.51783 12.6375 4.56568 12.4396C4.56568 12.8237 4.56568 13.2079 4.56568 13.6036C5.77322 13.6036 6.98076 13.6036 8.22489 13.6036C8.22489 13.2195 8.22489 12.8354 8.22489 12.4396C8.27134 12.4396 8.31778 12.4396 8.36563 12.4396C8.36563 12.8717 8.36563 13.3039 8.36563 13.7491C7.0652 13.7491 5.76478 13.7491 4.42494 13.7491C4.42494 16.6781 4.42494 19.6071 4.42494 22.6248C4.09983 22.6248 3.77473 22.6248 3.43977 22.6248C3.42672 21.3094 3.41672 19.994 3.4106 18.6786C3.40766 18.0677 3.40368 17.4569 3.3973 16.8461C3.39118 16.2564 3.38781 15.6668 3.38636 15.0772C3.38532 14.8524 3.38329 14.6276 3.38025 14.4028C3.37615 14.0875 3.3756 13.7724 3.37586 13.4572C3.37461 13.2778 3.37336 13.0985 3.37207 12.9138C3.49683 12.0399 3.87843 11.6321 4.7458 11.6182Z" fill="#BABABA"/>
                            <Path d="M5.42617 11.95C5.57761 11.9493 5.57761 11.9493 5.7321 11.9485C6.07042 11.9475 6.40866 11.9495 6.74697 11.9516C6.98947 11.9515 7.23198 11.9512 7.47448 11.9507C8.13307 11.9499 8.79163 11.9519 9.45022 11.9544C10.1386 11.9566 10.8269 11.9564 11.5153 11.9565C12.6708 11.9571 13.8264 11.9592 14.9819 11.9625C16.4671 11.9667 17.9523 11.9682 19.4375 11.9689C20.7124 11.9695 21.9873 11.9713 23.2622 11.9733C23.6731 11.9739 24.0839 11.9743 24.4948 11.9747C25.139 11.9754 25.7833 11.9769 26.4275 11.979C26.6646 11.9797 26.9017 11.9801 27.1388 11.9802C27.4611 11.9805 27.7833 11.9816 28.1056 11.983C28.2863 11.9834 28.4671 11.9839 28.6533 11.9843C29.0537 12.0034 29.0537 12.0034 29.1945 12.1489C29.4923 12.167 29.7907 12.1748 30.089 12.1788C30.1823 12.1803 30.2757 12.1817 30.3719 12.1832C30.6818 12.1878 30.9917 12.1914 31.3017 12.195C31.5161 12.198 31.7304 12.201 31.9448 12.2041C32.51 12.2122 33.0753 12.2194 33.6405 12.2264C34.2169 12.2337 34.7933 12.2418 35.3697 12.2498C36.5013 12.2655 37.633 12.2803 38.7647 12.2944C38.7647 12.3425 38.7647 12.3905 38.7647 12.44C28.7793 12.44 18.7938 12.44 8.50583 12.44C8.50583 12.8721 8.50583 13.3042 8.50583 13.7495C8.41294 13.7015 8.32005 13.6535 8.22435 13.604C7.94859 13.5916 7.67242 13.5884 7.39641 13.5898C7.15013 13.5905 7.15013 13.5905 6.89888 13.5912C6.72671 13.5924 6.55454 13.5936 6.37715 13.5949C6.20389 13.5955 6.03064 13.5962 5.85213 13.5969C5.42312 13.5986 4.99413 13.601 4.56514 13.604C4.51869 13.4119 4.47225 13.2199 4.4244 13.022C4.19218 13.022 3.95996 13.022 3.7207 13.022C3.77011 12.6517 3.82934 12.4734 4.08691 12.2051C4.54929 11.9288 4.89314 11.9493 5.42617 11.95Z" fill="#CFCFCF"/>
                            <Path d="M3.72168 22.77C3.86101 22.842 3.86101 22.842 4.00316 22.9155C4.00316 23.0596 4.00316 23.2036 4.00316 23.352C12.3631 23.352 20.723 23.352 29.3362 23.352C29.3362 23.256 29.3362 23.16 29.3362 23.061C27.2462 23.013 25.1562 22.965 23.0029 22.9155C23.0029 22.8675 23.0029 22.8195 23.0029 22.77C28.4833 22.77 33.9637 22.77 39.6101 22.77C39.4708 22.9141 39.3315 23.0581 39.1879 23.2065C44.3432 23.2786 44.3432 23.2786 49.6026 23.352C49.6026 23.4001 49.6026 23.4481 49.6026 23.4975C34.5083 23.4975 19.4141 23.4975 3.86242 23.4975C3.81597 23.2575 3.76953 23.0174 3.72168 22.77Z" fill="#34A853"/>
                            <Path d="M3.43945 13.1675C3.76456 13.1675 4.08967 13.1675 4.42463 13.1675C4.42463 16.2885 4.42463 19.4096 4.42463 22.6252C4.09952 22.6252 3.77441 22.6252 3.43945 22.6252C3.43945 19.5042 3.43945 16.3831 3.43945 13.1675Z" fill="#4B4B4B"/>
                            <Path d="M51.889 12.1294C52.0168 12.1298 52.1445 12.1301 52.2761 12.1305C52.4677 12.13 52.4677 12.13 52.6631 12.1294C52.9798 12.1487 52.9798 12.1487 53.1205 12.2942C53.1769 12.5718 53.2255 12.851 53.27 13.1309C53.2949 13.2832 53.3198 13.4355 53.3454 13.5924C53.3958 13.9914 53.4128 14.3662 53.402 14.7678C53.5413 14.8158 53.6806 14.8638 53.8242 14.9133C54.0292 15.92 54.1335 16.8928 53.6835 17.8234C53.1726 17.8234 52.6617 17.8234 52.1353 17.8234C52.1122 17.499 52.1122 17.499 52.0886 17.168C51.9736 15.6429 51.8349 14.1598 51.5004 12.6682C51.4777 12.5448 51.455 12.4214 51.4316 12.2942C51.5724 12.1487 51.5724 12.1487 51.889 12.1294Z" fill="#3E3E3E"/>
                            <Path d="M25.2539 15.4951C29.0623 15.4951 32.8707 15.4951 36.7945 15.4951C36.7945 17.0797 36.7945 18.6642 36.7945 20.2967C32.9861 20.2967 29.1777 20.2967 25.2539 20.2967C25.2539 18.7122 25.2539 17.1277 25.2539 15.4951ZM25.5354 15.7861C25.5354 17.1786 25.5354 18.5711 25.5354 20.0057C29.158 20.0057 32.7806 20.0057 36.513 20.0057C36.513 18.6133 36.513 17.2208 36.513 15.7861C32.8904 15.7861 29.2678 15.7861 25.5354 15.7861Z" fill="#D4D4D4"/>
                            <Path d="M54.8084 11.2762C54.8145 11.5186 54.8142 11.7612 54.8084 12.0037C54.5546 12.2662 54.1658 12.1837 53.8228 12.1952C53.6518 12.2013 53.4807 12.2074 53.3046 12.2137C53.1245 12.2194 52.9444 12.2251 52.7589 12.231C52.5783 12.2373 52.3978 12.2436 52.2117 12.2501C51.7638 12.2656 51.3157 12.2804 50.8677 12.2947C50.8677 12.7303 50.9386 13.1199 51.0179 13.5461C51.3763 15.5465 51.3312 17.5426 51.2901 19.5699C51.2436 19.5699 51.1972 19.5699 51.1493 19.5699C51.1458 19.4569 51.1423 19.344 51.1385 19.2277C51.1221 18.7112 51.1049 18.1948 51.0877 17.6783C51.0821 17.5007 51.0766 17.3231 51.0709 17.1401C50.998 14.7335 50.998 14.7335 50.0233 12.5857C49.6398 12.4535 49.3728 12.4135 48.9749 12.3941C48.8556 12.3881 48.7363 12.382 48.6134 12.3757C48.4894 12.37 48.3655 12.3642 48.2378 12.3583C48.1122 12.3521 47.9864 12.3458 47.857 12.3393C47.547 12.3239 47.2372 12.309 46.9272 12.2947C46.9272 12.1987 46.9272 12.1026 46.9272 12.0037C44.4192 12.0037 41.9111 12.0037 39.3271 12.0037C39.3271 11.9557 39.3271 11.9076 39.3271 11.8582C39.4244 11.8567 39.5217 11.8552 39.6219 11.8536C40.5491 11.8392 41.4762 11.8243 42.4035 11.8088C42.8798 11.8008 43.3562 11.7931 43.8326 11.7858C47.2221 11.7833 47.2221 11.7833 50.5863 11.4217C50.7915 11.419 50.9969 11.422 51.202 11.4308C51.9688 11.4428 52.7102 11.3389 53.4668 11.2213C53.9492 11.1505 54.3448 11.1004 54.8084 11.2762Z" fill="#BAB0A5"/>
                            <Path d="M29.6354 16.2217C29.8049 16.245 29.8049 16.245 29.9779 16.2689C30.148 16.2905 30.148 16.2905 30.3215 16.3126C30.6024 16.3689 30.6024 16.3689 30.7431 16.5144C30.7573 16.9221 30.7627 17.3254 30.7607 17.733C30.7616 17.9035 30.7616 17.9035 30.7624 18.0774C30.7616 18.5626 30.7518 18.9612 30.6024 19.4245C30.3796 19.4324 30.1568 19.438 29.9339 19.4427C29.8098 19.446 29.6857 19.4494 29.5579 19.4529C29.1769 19.423 28.9662 19.3122 28.6321 19.1335C28.5392 19.1815 28.4463 19.2295 28.3506 19.279C28.3506 18.4627 28.3506 17.6464 28.3506 16.8054C28.5828 16.7094 28.815 16.6133 29.0543 16.5144C29.3358 16.2234 29.3358 16.2234 29.6354 16.2217Z" fill="#E5E7E6"/>
                            <Path d="M53.6831 17.9692C54.0814 18.6654 54.0217 19.3655 53.9646 20.1518C53.8239 20.6883 53.8239 20.6883 53.6831 21.0248C53.5902 21.0248 53.4973 21.0248 53.4016 21.0248C53.4104 21.2454 53.4104 21.2454 53.4192 21.4704C53.4008 22.0696 53.2986 22.4971 53.1202 23.0619C53.3059 23.1099 53.4917 23.1579 53.6831 23.2074C53.6831 23.3034 53.6831 23.3994 53.6831 23.4984C53.0626 23.6588 52.4891 23.655 51.8535 23.6439C51.9928 23.5719 51.9928 23.5719 52.135 23.4984C52.1321 23.3333 52.1292 23.1683 52.1262 22.9982C52.135 22.4798 52.135 22.4798 52.2757 22.3343C52.6303 20.9624 52.6409 19.525 52.6979 18.1147C53.1202 17.9692 53.1202 17.9692 53.6831 17.9692Z" fill="#595959"/>
                            <Path d="M51.5721 12.1487C51.9368 14.056 52.2335 15.8747 52.135 17.8233C52.6459 17.8233 53.1568 17.8233 53.6832 17.8233C53.6832 17.8713 53.6832 17.9193 53.6832 17.9688C52.9401 17.9688 52.197 17.9688 51.4313 17.9688C51.394 17.6567 51.3566 17.3446 51.3181 17.023C51.281 16.7172 51.2437 16.4114 51.2063 16.1056C51.1807 15.8948 51.1553 15.684 51.1301 15.4731C50.9403 13.8679 50.9403 13.8679 50.5869 12.2942C50.9335 12.115 51.1892 12.1382 51.5721 12.1487Z" fill="#212121"/>
                            <Path d="M34.1208 16.3687C34.353 16.4167 34.5852 16.4647 34.8245 16.5142C34.8709 16.7062 34.9174 16.8983 34.9652 17.0962C35.151 17.0962 35.3368 17.0962 35.5282 17.0962C35.5282 17.2882 35.5282 17.4803 35.5282 17.6782C35.0529 17.6 34.5857 17.5166 34.1208 17.3872C34.1469 17.4742 34.1731 17.5612 34.2 17.6509C34.2615 17.9692 34.2615 17.9692 34.1208 18.4057C34.353 18.4057 34.5852 18.4057 34.8245 18.4057C34.8245 18.3097 34.8245 18.2136 34.8245 18.1147C35.0567 18.0667 35.2889 18.0187 35.5282 17.9692C35.5282 18.2093 35.5282 18.4494 35.5282 18.6967C35.3424 18.6967 35.1566 18.6967 34.9652 18.6967C34.9188 18.8888 34.8723 19.0808 34.8245 19.2787C34.5923 19.3267 34.3601 19.3748 34.1208 19.4242C34.086 19.3342 34.0511 19.2442 34.0152 19.1514C33.8379 18.7755 33.8379 18.7755 33.2764 18.5512C33.2764 18.023 33.2764 17.4948 33.2764 16.9507C33.5086 16.9027 33.7408 16.8546 33.9801 16.8052C34.0265 16.6611 34.0729 16.5171 34.1208 16.3687Z" fill="#CCCCCC"/>
                            <Path d="M4.70617 12.5854C5.86727 12.5854 7.02836 12.5854 8.22464 12.5854C8.22464 12.9216 8.22464 13.2577 8.22464 13.604C7.0171 13.604 5.80956 13.604 4.56543 13.604C4.61187 13.2679 4.65832 12.9317 4.70617 12.5854Z" fill="#D7D7D7"/>
                            <Path d="M52.416 12.1489C52.7643 12.221 52.7643 12.221 53.1197 12.2944C53.1673 12.5701 53.2141 12.846 53.2604 13.122C53.2866 13.2756 53.3127 13.4292 53.3396 13.5875C53.3942 13.9894 53.4128 14.3631 53.4012 14.768C53.5405 14.816 53.6799 14.864 53.8234 14.9135C53.979 15.6776 54.0406 16.4633 53.9641 17.2416C53.8713 17.3856 53.7784 17.5296 53.6827 17.6781C53.4969 17.6781 53.3111 17.6781 53.1197 17.6781C53.1119 17.5562 53.1041 17.4343 53.0961 17.3087C53.0669 16.8569 53.0372 16.4051 53.0072 15.9534C52.9943 15.7578 52.9816 15.5622 52.9691 15.3666C52.9512 15.0855 52.9324 14.8046 52.9135 14.5236C52.9025 14.3544 52.8914 14.1853 52.88 14.011C52.8622 13.6111 52.8622 13.6111 52.6975 13.313C52.7004 13.1689 52.7033 13.0249 52.7063 12.8764C52.7459 12.4228 52.7459 12.4228 52.416 12.1489Z" fill="#717171"/>
                            <Path d="M54.8093 11.276C54.8153 11.5185 54.815 11.7611 54.8093 12.0035C54.6686 12.149 54.6686 12.149 54.2521 12.1656C54.07 12.1648 53.888 12.164 53.7004 12.1633C53.5555 12.1629 53.5555 12.1629 53.4076 12.1626C53.0978 12.1618 52.7881 12.16 52.4783 12.1581C52.2688 12.1574 52.0592 12.1567 51.8497 12.1562C51.335 12.1545 50.8203 12.152 50.3057 12.149C50.3057 11.909 50.3057 11.6689 50.3057 11.4215C50.4015 11.4249 50.4972 11.4283 50.5959 11.4318C51.577 11.4506 52.5137 11.3733 53.4816 11.2212C53.9603 11.1498 54.3491 11.1025 54.8093 11.276Z" fill="#C0C0C0"/>
                            <Path d="M52.707 17.9595C52.9116 17.964 52.9116 17.964 53.1204 17.9686C52.9811 18.0166 52.8417 18.0646 52.6982 18.1141C52.7014 18.2846 52.7047 18.4551 52.7081 18.6307C52.725 19.9008 52.7012 21.0907 52.4167 22.3337C52.3933 22.4588 52.3699 22.5839 52.3458 22.7128C52.276 23.0612 52.276 23.0612 52.1352 23.4977C51.8449 23.5977 51.8449 23.5977 51.5723 23.6432C51.6453 22.9884 51.7368 22.3451 51.8537 21.6971C52.0057 20.7904 52.0522 19.8876 52.0871 18.9695C52.1279 17.9717 52.1279 17.9717 52.707 17.9595Z" fill="#444444"/>
                            <Path d="M5.40297 11.9605C5.54235 11.9615 5.54235 11.9615 5.68455 11.9624C5.97998 11.9648 6.27528 11.9703 6.57067 11.9759C6.77151 11.9781 6.97236 11.9801 7.17321 11.9818C7.66437 11.9866 8.15546 11.9942 8.64657 12.0032C8.60012 12.5794 8.55368 13.1555 8.50583 13.7492C8.45938 13.7492 8.41294 13.7492 8.36509 13.7492C8.29542 13.173 8.29542 13.173 8.22435 12.5852C7.06325 12.5852 5.90216 12.5852 4.70588 12.5852C4.65943 12.6812 4.61299 12.7772 4.56514 12.8762C4.4244 13.0217 4.4244 13.0217 4.06375 13.0308C3.89394 13.0263 3.89394 13.0263 3.7207 13.0217C3.77026 12.6502 3.82949 12.4728 4.08836 12.2042C4.54428 11.9314 4.8782 11.9536 5.40297 11.9605Z" fill="#C5C5C5"/>
                            <Path d="M53.2614 18.1143C53.4008 18.1143 53.5401 18.1143 53.6836 18.1143C54.1022 18.7633 54.0197 19.3898 53.9651 20.1513C53.8244 20.6879 53.8244 20.6879 53.6836 21.0243C53.5908 21.0243 53.4979 21.0243 53.4022 21.0243C53.4109 21.2449 53.4109 21.2449 53.4198 21.4699C53.4014 22.0692 53.2991 22.4966 53.1207 23.0614C53.3065 23.1094 53.4922 23.1574 53.6836 23.2069C53.6836 23.3029 53.6836 23.3989 53.6836 23.4979C53.0567 23.5699 53.0567 23.5699 52.417 23.6434C52.5099 23.4993 52.6028 23.3553 52.6985 23.2069C52.7546 22.9237 52.8005 22.6383 52.8392 22.352C52.9515 21.525 52.9515 21.525 53.1284 21.1261C53.3251 20.5453 53.2911 19.9885 53.279 19.3783C53.2777 19.2567 53.2765 19.1351 53.2752 19.0097C53.2719 18.7112 53.2668 18.4127 53.2614 18.1143Z" fill="#848484"/>
                            <Path d="M53.6845 23.207C53.7309 23.3031 53.7774 23.3991 53.8252 23.498C53.9617 23.495 54.0981 23.492 54.2386 23.4889C54.6697 23.498 54.6697 23.498 54.8104 23.6435C54.8161 23.9345 54.8164 24.2256 54.8104 24.5166C54.1682 24.4963 53.5261 24.4747 52.884 24.4529C52.702 24.4472 52.5199 24.4415 52.3324 24.4356C52.1568 24.4295 51.9813 24.4234 51.8005 24.4171C51.639 24.4118 51.4776 24.4064 51.3113 24.4009C50.9162 24.3742 50.5513 24.3172 50.166 24.2256C50.2589 24.0335 50.3518 23.8414 50.4475 23.6435C50.4939 23.7396 50.5404 23.8356 50.5882 23.9345C51.61 23.8865 52.6318 23.8385 53.6845 23.789C53.638 23.693 53.5916 23.597 53.5438 23.498C53.5902 23.402 53.6366 23.306 53.6845 23.207Z" fill="#CECCCB"/>
                            <Path d="M52.1357 12.1489C52.4841 12.221 52.4841 12.221 52.8394 12.2944C52.8365 12.4565 52.8336 12.6185 52.8306 12.7855C52.8023 13.2885 52.8023 13.2885 52.9802 13.604C53.0136 13.9897 53.0398 14.3724 53.0593 14.7589C53.0653 14.8696 53.0713 14.9804 53.0774 15.0945C53.1212 15.9561 53.1371 16.8153 53.1209 17.6781C53.3067 17.7261 53.4925 17.7741 53.6839 17.8236C53.4517 17.8236 53.2194 17.8236 52.9802 17.8236C52.7525 17.4061 52.6612 17.0937 52.6454 16.6158C52.6406 16.4975 52.6358 16.3793 52.6308 16.2574C52.6271 16.135 52.6234 16.0126 52.6195 15.8865C52.5906 15.0665 52.5452 14.2689 52.4172 13.4585C52.3708 13.4585 52.3243 13.4585 52.2765 13.4585C52.23 13.0263 52.1836 12.5942 52.1357 12.1489Z" fill="#5C5C5C"/>
                            <Path d="M38.7646 23.498C38.9039 23.498 39.0432 23.498 39.1868 23.498C39.1868 23.5941 39.1868 23.6901 39.1868 23.7891C39.9299 23.7891 40.673 23.7891 41.4386 23.7891C41.4386 23.8371 41.4386 23.8851 41.4386 23.9346C39.0083 24.1361 36.5793 24.0689 34.1446 24.0226C33.585 24.0122 33.0253 24.0028 32.4657 23.9934C31.3752 23.9748 30.2848 23.9551 29.1943 23.9346C29.1943 23.8385 29.1943 23.7425 29.1943 23.6436C29.3122 23.6439 29.43 23.6442 29.5514 23.6445C30.6594 23.6474 31.7674 23.6497 32.8754 23.6511C33.4451 23.6519 34.0148 23.6529 34.5845 23.6545C35.1339 23.6561 35.6832 23.657 36.2325 23.6574C36.4426 23.6576 36.6526 23.6582 36.8627 23.6589C37.1559 23.66 37.4491 23.6601 37.7423 23.6601C37.9931 23.6606 37.9931 23.6606 38.2489 23.661C38.6128 23.6877 38.6128 23.6877 38.7646 23.498Z" fill="#A8A8A8"/>
                            <Path d="M29.3352 16.2231C29.6211 16.2356 29.6211 16.2356 29.9685 16.2777C30.1405 16.2974 30.1405 16.2974 30.316 16.3175C30.6018 16.3686 30.6018 16.3686 30.7426 16.5142C30.7624 16.9027 30.7486 17.2889 30.7426 17.6782C30.4985 17.7731 30.4985 17.7731 30.1796 17.8237C29.8784 17.6787 29.8784 17.6787 29.5815 17.469C29.4821 17.4002 29.3826 17.3313 29.2802 17.2604C29.2055 17.2062 29.1307 17.152 29.0537 17.0962C29.1769 16.3868 29.1769 16.3868 29.3352 16.2231Z" fill="#CBCCCC"/>
                            <Path d="M28.8525 17.9595C29.0223 17.964 29.0223 17.964 29.1956 17.9686C29.1956 18.1126 29.1956 18.2567 29.1956 18.4051C29.4278 18.4531 29.66 18.5011 29.8993 18.5506C29.9872 18.8234 29.9872 18.8234 30.04 19.1326C29.9471 19.2286 29.8542 19.3247 29.7585 19.4236C29.4243 19.369 29.4243 19.369 29.0548 19.2781C28.869 19.2781 28.6833 19.2781 28.4919 19.2781C28.4454 19.2781 28.399 19.2781 28.3511 19.2781C28.3374 18.3829 28.3374 18.3829 28.3511 18.1141C28.4919 17.9686 28.4919 17.9686 28.8525 17.9595Z" fill="#C8C9C9"/>
                            <Path d="M47.4912 23.4983C47.8548 23.4944 48.2183 23.4915 48.5819 23.4892C48.6846 23.488 48.7873 23.4868 48.8931 23.4855C49.3893 23.4832 49.8289 23.5051 50.306 23.6438C50.2595 23.8359 50.2131 24.0279 50.1653 24.2258C49.2828 24.1778 48.4004 24.1298 47.4912 24.0803C47.4912 23.8882 47.4912 23.6962 47.4912 23.4983Z" fill="#B8A898"/>
                            <Path d="M53.6827 18.1142C53.5433 18.1142 53.404 18.1142 53.2604 18.1142C53.2739 18.2948 53.2873 18.4755 53.3011 18.6616C53.317 18.9005 53.3327 19.1394 53.3484 19.3783C53.3575 19.4971 53.3666 19.6159 53.3759 19.7384C53.4173 20.3987 53.4088 20.8542 53.1197 21.4608C53.066 21.7992 53.0177 22.1387 52.979 22.4793C52.9325 22.4793 52.8861 22.4793 52.8382 22.4793C52.8382 21.0388 52.8382 19.5984 52.8382 18.1142C53.1888 17.933 53.3183 18.0012 53.6827 18.1142ZM52.6975 22.4793C52.7439 22.4793 52.7904 22.4793 52.8382 22.4793C52.8382 22.8154 52.8382 23.1516 52.8382 23.4979C52.6989 23.4979 52.5596 23.4979 52.416 23.4979C52.5392 22.8067 52.5392 22.8067 52.6975 22.4793Z" fill="#6C6C6C"/>
                            <Path d="M29.6173 11.7124C29.6173 11.8565 29.6173 12.0005 29.6173 12.1489C26.7842 12.1489 23.9512 12.1489 21.0322 12.1489C21.0322 12.0529 21.0322 11.9568 21.0322 11.8579C22.0892 11.8389 23.1463 11.8199 24.2033 11.801C24.6941 11.7922 25.1849 11.7834 25.6757 11.7746C26.2399 11.7644 26.804 11.7543 27.3682 11.7442C27.5446 11.741 27.721 11.7379 27.9027 11.7346C28.1478 11.7302 28.1478 11.7302 28.3978 11.7258C28.5419 11.7232 28.686 11.7206 28.8344 11.7179C29.0954 11.7139 29.3563 11.7124 29.6173 11.7124Z" fill="#ABABAB"/>
                            <Path d="M39.3281 11.8579C42.0219 11.8579 44.7156 11.8579 47.491 11.8579C47.491 12.002 47.491 12.146 47.491 12.2944C47.3052 12.2944 47.1194 12.2944 46.928 12.2944C46.928 12.1984 46.928 12.1024 46.928 12.0034C44.4201 12.0034 41.9121 12.0034 39.3281 12.0034C39.3281 11.9554 39.3281 11.9074 39.3281 11.8579Z" fill="#B5B5B5"/>
                            <Path d="M33.2764 16.2231C34.0195 16.2231 34.7626 16.2231 35.5282 16.2231C35.5746 16.7033 35.6211 17.1835 35.6689 17.6782C35.4832 17.5821 35.2974 17.4861 35.106 17.3872C35.2453 17.3872 35.3846 17.3872 35.5282 17.3872C35.5282 17.2911 35.5282 17.1951 35.5282 17.0962C35.3424 17.0962 35.1566 17.0962 34.9652 17.0962C34.8723 16.9041 34.7795 16.712 34.6838 16.5142C34.138 16.451 34.138 16.451 33.8745 16.7324C33.8165 16.8044 33.7584 16.8765 33.6986 16.9507C33.5593 16.9026 33.4199 16.8546 33.2764 16.8052C33.2764 16.6131 33.2764 16.421 33.2764 16.2231Z" fill="#DDDEDE"/>
                            <Path d="M33.2765 18.5513C33.7214 18.7506 33.8384 18.8407 34.1209 19.2788C34.3531 19.2308 34.5854 19.1828 34.8246 19.1333C34.8711 18.9892 34.9175 18.8452 34.9653 18.6968C35.1976 18.7448 35.4298 18.7928 35.669 18.8423C35.6226 19.0824 35.5762 19.3224 35.5283 19.5698C34.8316 19.5698 34.135 19.5698 33.4172 19.5698C33.3243 19.3297 33.2314 19.0896 33.1357 18.8423C33.1822 18.7462 33.2286 18.6502 33.2765 18.5513Z" fill="#E0E0E0"/>
                            <Path d="M35.5291 17.9688C35.5291 18.2087 35.5291 18.4489 35.5291 18.6963C35.3433 18.6963 35.1575 18.6963 34.9661 18.6963C34.9197 18.8883 34.8732 19.0803 34.8254 19.2782C34.5932 19.3262 34.3609 19.3742 34.1217 19.4237C33.9633 18.7325 33.9633 18.7326 34.1217 18.4053C34.3539 18.4053 34.5861 18.4053 34.8254 18.4053C34.8254 18.3092 34.8254 18.2132 34.8254 18.1143C35.1069 17.9688 35.1069 17.9688 35.5291 17.9688Z" fill="#9E9E9E"/>
                            <Path d="M12.4479 23.4976C12.4479 23.5936 12.4479 23.6896 12.4479 23.7886C14.3521 23.7886 16.2563 23.7886 18.2182 23.7886C18.2182 23.8366 18.2182 23.8846 18.2182 23.9341C16.0354 23.9821 13.8525 24.0301 11.6035 24.0796C11.6035 23.9355 11.6035 23.7915 11.6035 23.6431C12.0257 23.4976 12.0257 23.4976 12.4479 23.4976Z" fill="#B5B5B5"/>
                            <Path d="M4.98828 12.7305C5.91716 12.7305 6.84604 12.7305 7.80306 12.7305C7.80306 12.8745 7.80306 13.0186 7.80306 13.167C6.87418 13.167 5.94531 13.167 4.98828 13.167C4.98828 13.0229 4.98828 12.8789 4.98828 12.7305Z" fill="#34A853"/>
                            <Path d="M30.744 18.1145C30.6975 18.5466 30.6511 18.9788 30.6032 19.424C30.3246 19.424 30.0459 19.424 29.7588 19.424C29.782 19.316 29.8052 19.208 29.8292 19.0966C29.9163 18.6689 29.9163 18.6689 29.8995 18.1145C30.181 17.969 30.181 17.969 30.744 18.1145Z" fill="#DEDEDE"/>
                            <Path d="M50.7277 13.3135C50.8205 13.3615 50.9134 13.4095 51.0091 13.459C51.5509 15.3849 51.3165 17.5911 51.2906 19.5701C51.2442 19.5701 51.1977 19.5701 51.1499 19.5701C51.1446 19.4008 51.1446 19.4008 51.1392 19.228C51.1228 18.7115 51.1055 18.195 51.0883 17.6786C51.0828 17.501 51.0772 17.3233 51.0715 17.1403C51.0372 15.5402 51.0372 15.5402 50.7101 13.9864C50.6694 13.8604 50.6288 13.7343 50.5869 13.6045C50.6334 13.5085 50.6798 13.4124 50.7277 13.3135Z" fill="#B0B0B0"/>
                            <Path d="M53.1211 23.3525C53.3997 23.4486 53.6784 23.5446 53.9655 23.6435C53.684 23.9346 53.684 23.9346 53.3808 23.9676C53.2584 23.9661 53.1361 23.9645 53.01 23.963C52.8776 23.962 52.7452 23.9611 52.6087 23.9601C52.4701 23.9577 52.3315 23.9553 52.1887 23.9527C52.049 23.9514 51.9093 23.9501 51.7654 23.9488C51.4197 23.9453 51.0741 23.9405 50.7285 23.9346C50.7285 23.7905 50.7285 23.6465 50.7285 23.498C50.8894 23.4997 51.0504 23.5014 51.2162 23.5032C51.426 23.5045 51.6358 23.5058 51.8456 23.5071C51.9519 23.5084 52.0581 23.5096 52.1675 23.5108C52.4385 23.5121 52.7095 23.5056 52.9803 23.498C53.0268 23.45 53.0732 23.402 53.1211 23.3525Z" fill="#B8B8B8"/>
                            <Path d="M52.417 13.3125C52.4634 13.3125 52.5099 13.3125 52.5577 13.3125C52.6893 14.2964 52.7438 15.2723 52.7837 16.2641C52.7889 16.3817 52.7942 16.4993 52.7996 16.6204C52.8039 16.7258 52.8082 16.8312 52.8125 16.9397C52.8397 17.2467 52.9001 17.5266 52.9799 17.8231C52.8406 17.7751 52.7013 17.7271 52.5577 17.6776C52.5099 17.1927 52.4633 16.7076 52.417 16.2226C52.4036 16.0866 52.3901 15.9506 52.3763 15.8105C52.3017 15.0224 52.2479 14.25 52.2763 13.458C52.3227 13.41 52.3691 13.362 52.417 13.3125Z" fill="#4D4D4D"/>
                            <Path d="M50.3047 11.4219C51.28 11.4939 51.28 11.4939 52.275 11.5674C52.275 11.6154 52.275 11.6634 52.275 11.7129C52.693 11.7849 52.693 11.7849 53.1195 11.8584C53.1195 11.9064 53.1195 11.9544 53.1195 12.0039C52.1906 12.0519 51.2617 12.0999 50.3047 12.1494C50.3047 11.9093 50.3047 11.6692 50.3047 11.4219Z" fill="#CCCAC9"/>
                            <Path d="M39.1871 11.7129C39.1871 11.905 39.1871 12.097 39.1871 12.2949C39.1175 12.2718 39.048 12.2488 38.9764 12.225C38.4837 12.1193 37.9929 12.115 37.4916 12.1034C37.3831 12.1003 37.2745 12.0973 37.1627 12.0942C36.8171 12.0847 36.4716 12.0761 36.126 12.0676C35.8912 12.0613 35.6565 12.0549 35.4217 12.0485C34.8473 12.033 34.2728 12.0182 33.6982 12.0039C33.6982 11.9559 33.6982 11.9079 33.6982 11.8584C34.4121 11.8376 35.1259 11.8169 35.8397 11.7962C36.0826 11.7892 36.3255 11.7821 36.5683 11.7751C36.9173 11.7649 37.2663 11.7548 37.6153 11.7447C37.7239 11.7415 37.8326 11.7384 37.9445 11.7351C38.3589 11.7232 38.7725 11.7129 39.1871 11.7129Z" fill="#A2A2A2"/>
                            <Path d="M53.2611 18.1143C53.4004 18.1143 53.5398 18.1143 53.6833 18.1143C53.6833 18.9305 53.6833 19.7468 53.6833 20.5878C53.5904 20.6358 53.4975 20.6839 53.4018 20.7333C53.2321 20.2068 53.2459 19.7257 53.2523 19.1783C53.2529 19.0761 53.2536 18.974 53.2542 18.8688C53.2559 18.6173 53.2584 18.3658 53.2611 18.1143Z" fill="#959595"/>
                            <Path d="M34.8248 17.2412C34.8712 17.3853 34.9177 17.5293 34.9655 17.6777C35.2491 17.7844 35.2491 17.7844 35.5285 17.8232C35.2963 17.9193 35.064 18.0153 34.8248 18.1142C34.8248 18.2103 34.8248 18.3063 34.8248 18.4052C34.5926 18.4052 34.3604 18.4052 34.1211 18.4052C34.1211 18.0691 34.1211 17.733 34.1211 17.3867C34.3533 17.3387 34.5855 17.2907 34.8248 17.2412Z" fill="#E6E6E6"/>
                            <Path d="M29.6175 11.8579C30.9644 11.8579 32.3113 11.8579 33.699 11.8579C33.699 11.9059 33.699 11.9539 33.699 12.0034C33.6175 12.0071 33.5361 12.0107 33.4522 12.0145C31.3205 12.1062 31.3205 12.1062 29.1953 12.2944C29.3346 12.2464 29.474 12.1984 29.6175 12.1489C29.6175 12.0529 29.6175 11.9569 29.6175 11.8579Z" fill="#B8B8B8"/>
                            <Path d="M50.8682 20.4429C50.9611 20.4429 51.054 20.4429 51.1497 20.4429C51.1336 20.7703 51.1156 21.0977 51.0969 21.425C51.0822 21.6985 51.0822 21.6985 51.0672 21.9775C51.0155 22.4232 50.9531 22.6865 50.7275 23.0619C50.5582 22.1168 50.6452 21.3727 50.8682 20.4429Z" fill="#B6B6B6"/>
                            <Path d="M53.2604 14.0405C53.3069 14.0405 53.3533 14.0405 53.4012 14.0405C53.4215 14.2056 53.4418 14.3706 53.4627 14.5407C53.4873 15.0311 53.4873 15.0311 53.6826 15.2046C53.6928 15.4984 53.6944 15.7926 53.6914 16.0867C53.6902 16.2474 53.6889 16.4082 53.6876 16.5738C53.686 16.6981 53.6843 16.8225 53.6826 16.9506C53.6362 16.9506 53.5898 16.9506 53.5419 16.9506C53.5419 16.6625 53.5419 16.3744 53.5419 16.0776C53.449 16.0776 53.3561 16.0776 53.2604 16.0776C53.1319 15.3543 53.1319 14.7638 53.2604 14.0405Z" fill="#A0A0A0"/>
                            <Path d="M53.5431 18.4058C53.6824 18.4538 53.8217 18.5018 53.9653 18.5513C54.0172 20.2277 54.0172 20.2277 53.6838 21.0248C53.5909 21.0248 53.498 21.0248 53.4023 21.0248C53.4488 20.8808 53.4952 20.7367 53.5431 20.5883C53.553 20.214 53.5563 19.8439 53.5519 19.4698C53.5509 19.3166 53.5509 19.3166 53.55 19.1603C53.5483 18.9088 53.5458 18.6573 53.5431 18.4058Z" fill="#5E5E5E"/>
                            <Path d="M28.9135 16.6602C29.0529 16.8522 29.1922 17.0443 29.3358 17.2422C29.1598 17.4604 29.1598 17.4604 28.9135 17.6787C28.7278 17.6787 28.542 17.6787 28.3506 17.6787C28.3506 17.3906 28.3506 17.1025 28.3506 16.8057C28.5364 16.7576 28.7221 16.7096 28.9135 16.6602Z" fill="#CFD0D0"/>
                            <Path d="M53.4014 14.7681C53.5407 14.8161 53.68 14.8641 53.8236 14.9136C53.9824 15.6936 53.978 16.4491 53.9643 17.2416C53.825 17.2896 53.6857 17.3377 53.5421 17.3871C53.5437 17.2346 53.5454 17.0822 53.5471 16.925C53.5484 16.7244 53.5497 16.5238 53.5509 16.3231C53.5521 16.2227 53.5533 16.1223 53.5545 16.0188C53.5566 15.5613 53.5424 15.2054 53.4014 14.7681Z" fill="#5C5C5C"/>
                            <Path d="M34.1212 16.3682C34.3534 16.4162 34.5856 16.4642 34.8249 16.5137C34.7785 16.7537 34.732 16.9938 34.6842 17.2412C34.4519 17.1932 34.2197 17.1452 33.9805 17.0957C34.0269 16.8556 34.0734 16.6155 34.1212 16.3682Z" fill="#7E8080"/>
                            <Path d="M54.8094 11.2762C54.8094 11.3722 54.8094 11.4683 54.8094 11.5672C54.0663 11.5672 53.3232 11.5672 52.5576 11.5672C53.2656 11.2012 54.0347 10.9758 54.8094 11.2762Z" fill="#B5B5B5"/>
                            <Path d="M38.7646 23.4985C38.904 23.4985 39.0434 23.4985 39.187 23.4985C39.187 23.5946 39.187 23.6906 39.187 23.7895C39.9301 23.7895 40.6732 23.7895 41.4388 23.7895C41.4388 23.8376 41.4388 23.8856 41.4388 23.935C40.1151 24.0071 40.115 24.0071 38.7646 24.0805C38.7646 23.8885 38.7646 23.6964 38.7646 23.4985Z" fill="#959595"/>
                            <Path d="M52.2766 17.9688C52.3694 17.9688 52.4623 17.9688 52.558 17.9688C52.4224 19.3378 52.4224 19.3379 52.2766 20.0058C52.2301 20.0058 52.1837 20.0058 52.1358 20.0058C52.132 19.6936 52.1293 19.3813 52.127 19.069C52.1254 18.8951 52.1238 18.7214 52.1221 18.5422C52.1358 18.1143 52.1358 18.1143 52.2766 17.9688Z" fill="#3A3A3A"/>
                            <Path d="M53.2607 16.0776C53.3536 16.0776 53.4465 16.0776 53.5422 16.0776C53.5887 16.6058 53.6351 17.134 53.683 17.6782C53.5436 17.6782 53.4043 17.6782 53.2607 17.6782C53.2607 17.15 53.2607 16.6218 53.2607 16.0776Z" fill="#7A7A7A"/>
                            <Path d="M29.1954 18.5513C29.2883 18.5513 29.3812 18.5513 29.4769 18.5513C29.4769 18.6953 29.4769 18.8394 29.4769 18.9878C29.6162 18.9878 29.7556 18.978 29.8991 18.9878C29.8527 19.1318 29.8062 19.2759 29.7584 19.4243C29.5262 19.3763 29.2939 19.3283 29.0547 19.2788C29.1011 19.0387 29.1476 18.7986 29.1954 18.5513Z" fill="#6A6C6B"/>
                            <Path d="M28.6319 18.9873C29.0073 19.1813 29.3826 19.3753 29.7579 19.5693C29.3399 19.5693 28.9219 19.5693 28.4912 19.5693C28.4912 19.1328 28.4912 19.1328 28.6319 18.9873Z" fill="#E1E2E2"/>
                            <Path d="M30.1798 17.9688C30.4585 18.0407 30.4585 18.0408 30.7428 18.1143C30.6963 18.3063 30.6499 18.4984 30.602 18.6963C30.4162 18.6483 30.2305 18.6002 30.0391 18.5508C30.0855 18.3587 30.132 18.1665 30.1798 17.9688Z" fill="#C5C5C5"/>
                            <Path d="M29.1954 16.3687C29.3348 16.3687 29.4741 16.3687 29.6176 16.3687C29.6641 16.6567 29.7105 16.9448 29.7584 17.2417C29.5262 17.1937 29.2939 17.1456 29.0547 17.0962C29.1011 16.8561 29.1476 16.616 29.1954 16.3687Z" fill="#676969"/>
                            <Path d="M28.4913 16.2236C28.77 16.2236 29.0487 16.2236 29.3358 16.2236C29.1598 16.5146 29.1598 16.5146 28.9135 16.8056C28.7278 16.8056 28.542 16.8056 28.3506 16.8056C28.397 16.6136 28.4435 16.4215 28.4913 16.2236Z" fill="#E1E2E2"/>
                            <Path d="M47.4902 23.4985C47.7225 23.4985 47.9547 23.4985 48.1939 23.4985C48.1939 23.6906 48.1939 23.8827 48.1939 24.0805C47.9617 24.0805 47.7295 24.0805 47.4902 24.0805C47.4902 23.8885 47.4902 23.6964 47.4902 23.4985Z" fill="#5F5F5F"/>
                            <Path d="M47.4912 11.7119C47.7234 11.7119 47.9556 11.7119 48.1949 11.7119C48.1949 11.904 48.1949 12.096 48.1949 12.2939C47.9627 12.2939 47.7305 12.2939 47.4912 12.2939C47.4912 12.1019 47.4912 11.9098 47.4912 11.7119Z" fill="#5E5E5E"/>
                            <Path d="M3.86167 11.8579C3.95456 12.002 4.04745 12.146 4.14315 12.2944C3.94963 12.6582 3.94963 12.6582 3.72093 13.0219C3.62804 13.0219 3.53516 13.0219 3.43945 13.0219C3.54501 12.1853 3.54501 12.1853 3.86167 11.8579Z" fill="#BEBEBE"/>
                            <Path d="M53.6837 23.207C53.7302 23.3031 53.7766 23.3991 53.8244 23.498C54.1031 23.498 54.3818 23.498 54.6689 23.498C54.7153 23.6421 54.7618 23.7861 54.8096 23.9345C54.1826 23.7905 54.1826 23.7905 53.543 23.6435C53.5894 23.4995 53.6359 23.3554 53.6837 23.207Z" fill="#C9C9C9"/>
                            <Path d="M12.4479 23.4976C12.3551 23.6896 12.2622 23.8817 12.1665 24.0796C11.9807 24.0796 11.7949 24.0796 11.6035 24.0796C11.6035 23.9355 11.6035 23.7915 11.6035 23.6431C12.0257 23.4976 12.0257 23.4976 12.4479 23.4976Z" fill="#7E7E7E"/>
                            <Path d="M4.00316 12.2944C4.09605 12.2944 4.18893 12.2944 4.28464 12.2944C4.28464 12.5345 4.28464 12.7746 4.28464 13.022C4.09886 13.022 3.91308 13.022 3.72168 13.022C3.84483 12.4581 3.84483 12.4581 4.00316 12.2944Z" fill="#E4E4E4"/>
                          </G>
                        </Svg> */}

                        <Svg xmlns="http://www.w3.org/2000/svg" width="84" height="27" viewBox="0 0 84 27" fill="none">
                          <Mask id="mask0_933_1781" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="0" width="84" height="27">
                            <Path d="M83.2118 0.595215H0.460938V26.5118H83.2118V0.595215Z" fill="white"/>
                          </Mask>
                          <G mask="url(#mask0_933_1781)">
                            <Path d="M57.5742 5.56278C57.5046 5.70528 57.4365 5.84777 57.3654 5.99472C49.387 6.06596 41.4071 6.13722 33.1859 6.20995C33.1859 10.985 33.1859 15.7614 33.1859 20.6804C33.6613 20.9268 33.9382 20.9283 34.467 20.9372C34.6447 20.9417 34.8224 20.9446 35.0061 20.9491C35.1986 20.9506 35.3911 20.9535 35.5896 20.958C35.7866 20.961 35.985 20.9654 36.1879 20.9699C36.8203 20.9818 37.4528 20.9936 38.0852 21.004C38.916 21.0189 39.7484 21.0352 40.5792 21.0515C40.7718 21.0545 40.9643 21.0574 41.1628 21.0604C41.3405 21.0649 41.5197 21.0678 41.7033 21.0723C41.8603 21.0738 42.0173 21.0767 42.1788 21.0797C42.5668 21.1124 42.5668 21.1124 42.983 21.3291C42.983 21.4716 42.983 21.614 42.983 21.761C30.6014 21.761 18.2199 21.761 5.46372 21.761C5.39559 21.476 5.32597 21.1895 5.25488 20.8971C5.53036 20.8971 5.80584 20.8971 6.08872 20.8971C6.08872 16.4784 6.08872 12.0596 6.08872 7.50573C8.08368 7.50573 10.0786 7.50573 12.1343 7.50573C12.1343 6.86451 12.1343 6.2233 12.1343 5.56278C17.9667 5.52865 23.799 5.49747 29.6314 5.4663C32.3387 5.45294 35.0461 5.43809 37.7549 5.42325C40.1142 5.4084 42.4735 5.39655 44.8328 5.38468C46.0828 5.37874 47.3328 5.37131 48.5828 5.36388C49.7587 5.35646 50.9347 5.35052 52.1091 5.34459C52.5416 5.3431 52.9741 5.34013 53.4065 5.33716C53.9945 5.33419 54.584 5.33123 55.1719 5.32826C55.3452 5.32677 55.517 5.3253 55.6948 5.32382C56.3775 5.32233 56.9225 5.33717 57.5742 5.56278Z" fill="#34A853"/>
                            <Path d="M71.9453 5.466C75.605 4.15833 75.5013 15.7597 75.5013 20.6801C75.9752 20.9265 74.3476 21.0705 74.8748 21.0794C75.054 21.0824 74.5623 21.3273 77.32 20.9473C74.5934 21.3243 74.2765 21.5247 77.4118 21.0349C76.5232 21.1744 75.639 21.3021 74.8748 21.4104C74.8867 21.4104 74.8704 21.4134 74.8304 21.4163C74.3505 21.4846 73.9181 21.544 73.5626 21.593C73.764 21.5885 73.958 21.5841 74.1328 21.5781C74.1713 21.5752 74.2098 21.5707 74.2498 21.5663C74.318 21.5588 74.3876 21.5514 74.4586 21.544C75.091 21.5574 74.2439 21.5321 74.8748 21.544C75.0274 21.547 74.8556 21.5559 74.5209 21.5678C75.5043 21.5722 75.3769 21.6123 75.1888 21.6538C74.9577 21.7058 74.6364 21.7592 76.1263 21.7592H72.4992C71.889 21.777 71.6061 21.7741 71.5469 21.7592H47.7777L47.5703 20.8954H48.4041V7.50543H54.4483V5.56249C60.2806 5.52835 65.913 5.0222 71.9453 5.466Z" fill="#34A853"/>
                            <Path d="M34.4106 6.83203C34.6683 6.83203 34.6683 6.83204 34.9319 6.83353C35.1289 6.83204 35.3259 6.83203 35.5273 6.83203C35.7451 6.83203 35.9628 6.83351 36.1879 6.835C36.4145 6.83351 36.6426 6.83353 36.8781 6.83353C37.6349 6.83501 38.3902 6.83648 39.147 6.83797C39.6713 6.83797 40.1941 6.83797 40.7169 6.83797C41.9551 6.83945 43.1947 6.84093 44.4328 6.8439C46.2279 6.84687 48.0244 6.84688 49.8194 6.84836C52.3342 6.85133 54.8505 6.85579 57.3653 6.85876C57.3653 11.3488 57.3653 15.8388 57.3653 20.4654C49.5928 20.4654 41.8203 20.4654 33.8123 20.4654C33.8078 18.2597 33.8034 16.0555 33.799 13.783C33.7975 13.0869 33.796 12.3893 33.793 11.6709C33.793 11.1217 33.7916 10.574 33.7916 10.0248C33.7916 9.8808 33.7901 9.7383 33.7901 9.58987C33.7886 9.16981 33.7886 8.74975 33.7886 8.3282C33.7886 8.09072 33.7871 7.85324 33.7871 7.60981C33.8212 6.87211 33.8212 6.87211 34.4106 6.83203Z" fill="#34A853"/>
                            <Path d="M80.7109 3.83506C80.7198 4.19426 80.7198 4.55496 80.7109 4.91416C80.3481 5.28969 79.8371 5.21101 79.3439 5.25257C79.027 5.27929 79.027 5.27929 78.7041 5.306C78.5412 5.31936 78.3783 5.33273 78.2095 5.34609C78.2406 5.52124 78.2702 5.69489 78.3013 5.87598C78.3398 6.10605 78.3783 6.33759 78.4183 6.57508C78.4568 6.80218 78.4953 7.03078 78.5353 7.2653C78.6167 7.86199 78.6434 8.41712 78.6271 9.01826C78.833 9.08951 79.0388 9.16074 79.2521 9.23347C79.4846 10.3779 79.532 11.5238 79.4609 12.6889C79.3913 12.7602 79.3232 12.8314 79.2521 12.9056C79.218 13.6611 79.218 13.6612 79.2521 14.4167C79.3202 14.4879 79.3899 14.5592 79.4609 14.6334C79.5513 15.9203 79.5439 17.1047 79.0433 18.3041C78.9056 18.3041 78.7678 18.3041 78.6271 18.3041C78.636 18.5223 78.6434 18.7419 78.6523 18.9661C78.6256 19.8552 78.4746 20.4905 78.2095 21.3276C78.5545 21.3988 78.8981 21.4701 79.2521 21.5443C79.2521 21.6868 79.2521 21.8293 79.2521 21.9762C79.4535 21.9718 79.6564 21.9673 79.8638 21.9629C80.5021 21.9762 80.5021 21.9762 80.7109 22.1915C80.7198 22.6234 80.7198 23.0568 80.7109 23.4873C79.7734 23.4576 78.8359 23.4264 77.897 23.3937C77.6333 23.3848 77.3682 23.3759 77.0957 23.3685C76.838 23.3581 76.5803 23.3492 76.3137 23.3403C76.0782 23.3329 75.8427 23.324 75.5998 23.3166C74.8741 23.272 74.8741 23.272 74.1677 23.1637C72.9325 23.0004 71.6944 23.0271 70.4503 23.0286C70.1704 23.0286 69.8919 23.0286 69.612 23.0286C69.0077 23.0271 68.402 23.0271 67.7977 23.0286C66.8128 23.0286 65.8279 23.0286 64.843 23.0271C63.599 23.0271 62.3549 23.0256 61.1108 23.0256C58.6671 23.0256 56.2234 23.0242 53.7797 23.0197C53.3946 23.0197 53.011 23.0182 52.6259 23.0182C52.0424 23.0167 51.4589 23.0167 50.8753 23.0152C48.6789 23.0123 46.4811 23.0093 44.2847 23.0063C44.0848 23.0063 43.8833 23.0063 43.676 23.0063C40.4192 23.0019 37.1624 23.0019 33.9056 23.0019C30.5614 23.0019 27.2157 22.9989 23.8715 22.9915C21.8084 22.9871 19.7468 22.9856 17.6837 22.9885C16.2708 22.99 14.8579 22.9885 13.4464 22.9826C12.6304 22.9796 11.8158 22.9796 10.9997 22.9826C10.2533 22.9856 9.50833 22.9841 8.76188 22.9781C8.36348 22.9767 7.96509 22.9796 7.56669 22.9841C5.63986 22.9618 5.63985 22.9618 4.99263 22.3384C4.51574 21.577 4.49945 21.0738 4.49945 20.1683C4.49649 19.9338 4.49648 19.9338 4.495 19.6934C4.49056 19.1783 4.49501 18.6647 4.49945 18.1497C4.49945 17.7905 4.49796 17.4313 4.49796 17.0721C4.49648 16.321 4.50093 15.5685 4.50538 14.8174C4.51278 13.8556 4.5113 12.8938 4.50834 11.9305C4.50537 11.1898 4.50833 10.4491 4.5113 9.70696C4.5113 9.35221 4.51129 8.99747 4.5098 8.64272C4.5098 8.14696 4.51427 7.65121 4.51871 7.15545C4.52019 6.87195 4.52166 6.58992 4.52314 6.30048C4.65791 5.36834 4.76308 5.09227 5.46361 4.48222C6.34928 4.3145 7.23049 4.33675 8.128 4.34565C8.40644 4.34417 8.68635 4.3427 8.96627 4.34121C9.73345 4.33676 10.5021 4.33823 11.2693 4.34269C12.0972 4.34417 12.9266 4.34122 13.7545 4.33825C15.1896 4.33379 16.6247 4.33231 18.0599 4.33528C20.1363 4.33825 22.2127 4.33527 24.2891 4.33082C27.66 4.3234 31.0309 4.32042 34.4017 4.32042C37.6733 4.32042 40.9449 4.31895 44.2151 4.31598C44.5172 4.31598 44.5172 4.31597 44.8267 4.31449C47.0246 4.313 49.224 4.31004 51.4233 4.30559C52.0054 4.30559 52.5889 4.30409 53.1724 4.30409C53.5575 4.30261 53.9411 4.30261 54.3262 4.30113C56.7728 4.29816 59.2195 4.29669 61.6662 4.29669C62.9014 4.29669 64.1351 4.29519 65.3703 4.29519C66.3463 4.29371 67.3238 4.29371 68.2998 4.29519C68.8922 4.29519 69.4846 4.2952 70.0771 4.29372C70.4769 4.29372 70.8768 4.29371 71.2767 4.29519C71.5151 4.29519 71.7521 4.29372 71.998 4.29372C72.2023 4.29372 72.4082 4.29372 72.6185 4.29372C73.245 4.26403 73.8404 4.16458 74.458 4.05029C74.7616 4.04732 75.0667 4.05027 75.3703 4.06363C76.5062 4.08144 77.6037 3.92708 78.7234 3.75341C79.4387 3.64803 80.0252 3.57382 80.7109 3.83506ZM54.2403 5.35646C48.1043 5.3817 41.9683 5.41138 35.8339 5.44255C33.2406 5.45591 30.6473 5.46927 28.0539 5.48115C22.7474 5.50786 17.4408 5.53459 12.1342 5.56279C12.1342 6.20401 12.1342 6.84522 12.1342 7.50574C10.1393 7.50574 8.14429 7.50574 6.09008 7.50574C6.09008 11.9245 6.09008 16.3433 6.09008 20.8957C5.745 20.8957 5.4014 20.8957 5.04743 20.8957C5.11556 21.2534 5.18518 21.6096 5.25627 21.9762C27.6111 21.9762 49.966 21.9762 72.9991 21.9762C72.9991 21.8337 72.9991 21.6912 72.9991 21.5443C73.128 21.5235 73.2554 21.5042 73.3887 21.482C73.8463 21.3691 73.8463 21.3691 74.0818 21.0055C75.1126 18.7746 75.16 16.514 75.1481 14.0797C75.1481 13.9268 75.1481 13.774 75.1481 13.6166C75.2459 9.49471 75.2459 9.49472 73.833 5.77802C73.1517 5.32383 72.6022 5.29264 71.8025 5.29561C71.4322 5.29561 71.4322 5.29562 71.0545 5.29413C70.6458 5.2971 70.6458 5.2971 70.2296 5.30007C69.9364 5.30155 69.6416 5.30156 69.3484 5.30156C68.5338 5.30305 67.7192 5.30601 66.9047 5.31046C66.019 5.31492 65.1333 5.31639 64.2477 5.31787C62.2497 5.32232 60.2518 5.33123 58.2539 5.34013C56.9165 5.34607 55.5776 5.35201 54.2403 5.35646Z" fill="#C4C4C3"/>
                            <Path d="M36.9375 10.0977C42.5773 10.0977 48.2186 10.0977 54.0302 10.0977C54.0302 12.4503 54.0302 14.8014 54.0302 17.2253C48.3889 17.2253 42.7491 17.2253 36.9375 17.2253C36.9375 14.8727 36.9375 12.5215 36.9375 10.0977Z" fill="#34A853"/>
                            <Path d="M76.4515 5.10432C76.5966 5.10283 76.7418 5.10284 76.8914 5.10135C77.9755 5.10284 77.9755 5.10285 78.2095 5.34627C78.2939 5.75891 78.365 6.17302 78.4316 6.58862C78.4687 6.81424 78.5042 7.04134 78.5427 7.27438C78.6168 7.86513 78.642 8.42175 78.6271 9.01844C78.833 9.08969 79.0389 9.16092 79.2521 9.23365C79.4847 10.3795 79.5321 11.5239 79.461 12.6891C79.3914 12.7604 79.3232 12.8316 79.2521 12.9058C79.2166 13.6613 79.2166 13.6613 79.2521 14.4169C79.3558 14.5252 79.3558 14.5252 79.461 14.6336C79.5513 15.9204 79.5439 17.1049 79.0433 18.3057C78.9056 18.3057 78.7678 18.3057 78.6271 18.3057C78.6346 18.5239 78.6434 18.7421 78.6523 18.9662C78.6257 19.8553 78.4746 20.4906 78.2095 21.3293C78.485 21.4005 78.7604 21.4718 79.0433 21.5445C79.0433 21.687 79.0433 21.8295 79.0433 21.9764C78.1932 22.1857 77.389 22.2288 76.5167 22.2332C76.1345 22.2377 76.1345 22.2377 75.7465 22.2421C75.083 22.1931 75.083 22.1931 74.458 21.7612C74.5217 21.5846 74.5854 21.4094 74.652 21.2298C76.0072 16.5839 75.9376 9.94613 74.458 5.34627C75.0934 5.01676 75.7539 5.09986 76.4515 5.10432Z" fill="#282828"/>
                            <Path d="M33.1862 6.21179C36.443 6.20585 39.7013 6.20289 42.9596 6.19992C44.4717 6.19844 45.9839 6.19695 47.496 6.19546C48.8141 6.19249 50.1323 6.19102 51.4504 6.19102C52.148 6.19102 52.847 6.18952 53.5446 6.18803C54.3221 6.18655 55.1012 6.18656 55.8787 6.18656C56.1127 6.18508 56.3452 6.18508 56.5852 6.18359C56.797 6.18508 57.0073 6.18507 57.2235 6.18507C57.5005 6.18507 57.5005 6.18507 57.7819 6.18507C58.1995 6.21178 58.1995 6.2118 58.4069 6.42702C58.4276 6.87825 58.432 7.32947 58.4306 7.77922C58.4306 7.92171 58.4306 8.06272 58.4306 8.20818C58.4306 8.67574 58.4291 9.14479 58.4276 9.61383C58.4276 9.93741 58.4276 10.261 58.4261 10.586C58.4261 11.441 58.4231 12.2945 58.4217 13.1494C58.4187 14.0207 58.4187 14.892 58.4172 15.7633C58.4157 17.4747 58.4113 19.1861 58.4069 20.8975C55.1219 20.902 51.8369 20.9064 48.552 20.9079C47.028 20.9094 45.5025 20.9109 43.9771 20.9138C42.6486 20.9153 41.3201 20.9168 39.9916 20.9168C39.2866 20.9183 38.5831 20.9183 37.8781 20.9198C37.0947 20.9212 36.3097 20.9213 35.5247 20.9213C35.2893 20.9227 35.0553 20.9227 34.8124 20.9242C34.4939 20.9242 34.4939 20.9242 34.1681 20.9227C33.983 20.9227 33.7964 20.9242 33.6053 20.9242C33.1862 20.8975 33.1862 20.8975 32.9774 20.6808C32.9566 20.2459 32.9507 19.811 32.9507 19.3746C32.9492 19.0956 32.9492 18.815 32.9492 18.5271C32.9492 18.2198 32.9492 17.9126 32.9492 17.6038C32.9492 17.2906 32.9492 16.9775 32.9492 16.6643C32.9492 16.0067 32.9492 15.3492 32.9507 14.6901C32.9522 13.8471 32.9507 13.0025 32.9492 12.1579C32.9492 11.5108 32.9492 10.8636 32.9492 10.2164C32.9492 9.90474 32.9492 9.59305 32.9492 9.28135C32.9492 8.84645 32.9492 8.41152 32.9507 7.97662C32.9507 7.72874 32.9507 7.48236 32.9507 7.22706C32.9773 6.64373 32.9773 6.64372 33.1862 6.21179ZM33.8112 7.07566C33.7919 7.49275 33.7875 7.91131 33.7875 8.3284C33.7875 8.60003 33.7875 8.87167 33.7875 9.1522C33.789 9.44313 33.7904 9.73405 33.7904 10.025C33.7904 10.2877 33.7919 10.5519 33.7919 10.822C33.7919 11.8091 33.7949 12.7962 33.7979 13.7832C33.8023 15.9889 33.8067 18.1931 33.8112 20.4656C41.5837 20.4656 49.3562 20.4656 57.3657 20.4656C57.3657 15.9755 57.3657 11.4855 57.3657 6.85896C53.2202 6.85302 53.2202 6.85301 49.0763 6.84856C47.3879 6.84708 45.698 6.84559 44.0096 6.84263C42.6486 6.83966 41.2875 6.83965 39.9264 6.83816C39.4066 6.83816 38.8852 6.83669 38.3654 6.83669C37.6382 6.83521 36.9125 6.83372 36.1868 6.83372C35.969 6.83372 35.7513 6.83223 35.5277 6.83223C35.3307 6.83223 35.1338 6.83224 34.9309 6.83372C34.759 6.83224 34.5872 6.83223 34.4095 6.83223C34.017 6.81442 34.0171 6.81442 33.8112 7.07566Z" fill="#34A853" fill-opacity="0.6"/>
                            <Path d="M6.56426 4.34277C6.7094 4.34574 6.85454 4.34872 7.00413 4.35317C7.15964 4.35168 7.31514 4.3502 7.47509 4.3502C7.9979 4.34872 8.51923 4.35465 9.04056 4.3591C9.41378 4.36059 9.78849 4.36059 10.1617 4.3591C11.1777 4.3591 12.1922 4.36504 13.2082 4.37247C14.2701 4.37989 15.3305 4.37988 16.391 4.38137C18.4007 4.38434 20.4105 4.39325 22.4203 4.40513C24.707 4.417 26.9953 4.42294 29.282 4.42739C33.9887 4.43926 38.694 4.45856 43.3993 4.48231C43.3993 4.69605 43.3993 4.90979 43.3993 5.13095C43.2082 5.12946 43.0172 5.12947 42.8187 5.12798C38.1623 5.11462 33.5059 5.10424 28.848 5.09682C26.5969 5.09385 24.3442 5.08938 22.093 5.08196C20.1306 5.07454 18.1682 5.07009 16.2044 5.07009C15.1662 5.06861 14.1265 5.06713 13.0868 5.06119C12.1093 5.05674 11.1303 5.05673 10.1528 5.05673C9.79442 5.05673 9.43451 5.05525 9.07462 5.05376C8.58587 5.04931 8.09566 5.05078 7.60544 5.05227C7.33145 5.05227 7.05745 5.05079 6.77457 5.05079C6.04886 5.1354 5.75709 5.23931 5.25502 5.77811C5.18689 5.99185 5.11727 6.20559 5.04618 6.42675C5.38978 6.42675 5.73488 6.42675 6.08885 6.42675C6.15698 6.14176 6.22657 5.85529 6.29766 5.56288C6.29766 6.13285 6.29766 6.70283 6.29766 7.29061C8.08528 7.29061 9.8744 7.29061 11.7168 7.29061C11.7168 6.71916 11.7168 6.14918 11.7168 5.56288C11.7849 5.56288 11.8545 5.56288 11.9256 5.56288C11.9256 6.2041 11.9256 6.84531 11.9256 7.50582C9.99879 7.50582 8.07345 7.50582 6.08885 7.50582C6.08885 11.8534 6.08885 16.2009 6.08885 20.6805C5.60751 20.6805 5.12617 20.6805 4.63002 20.6805C4.61077 18.7272 4.59595 16.7753 4.58706 14.8235C4.58262 13.9165 4.5767 13.0096 4.56634 12.1027C4.55745 11.227 4.553 10.3527 4.55004 9.47698C4.54856 9.14301 4.5456 8.81054 4.54116 8.47657C4.53524 8.00901 4.53524 7.53997 4.53524 7.07242C4.53376 6.80673 4.53078 6.54104 4.5293 6.26644C4.71443 4.96916 5.27872 4.36355 6.56426 4.34277Z" fill="#BABABA"/>
                            <Path d="M7.57206 4.83595C7.79717 4.83446 7.79717 4.83448 8.02525 4.83448C8.52585 4.83151 9.02792 4.83595 9.52851 4.83892C9.88692 4.83743 10.2468 4.83744 10.6052 4.83744C11.5812 4.83596 12.5572 4.83891 13.5318 4.84188C14.5522 4.84634 15.5712 4.84486 16.5901 4.84634C18.3022 4.84634 20.0128 4.84931 21.7249 4.85525C23.9242 4.86118 26.1236 4.86266 28.3244 4.86415C30.2113 4.86415 32.0996 4.86713 33.9879 4.8701C34.5966 4.87159 35.2053 4.87159 35.8141 4.87307C36.7678 4.87307 37.7216 4.87604 38.6769 4.879C39.0279 4.88049 39.3789 4.88048 39.73 4.88048C40.2068 4.88048 40.6837 4.88345 41.1621 4.88494C41.4287 4.88494 41.6968 4.88641 41.9722 4.88641C42.5661 4.91461 42.5661 4.91462 42.7735 5.13133C43.2148 5.15805 43.6577 5.16992 44.099 5.17586C44.2368 5.17735 44.376 5.18031 44.5181 5.18179C44.9773 5.18922 45.4364 5.19368 45.8955 5.19962C46.2125 5.20407 46.5294 5.20851 46.8478 5.21296C47.6846 5.22483 48.5214 5.23523 49.3597 5.24562C50.2128 5.25749 51.0658 5.26937 51.9204 5.28125C53.5955 5.30351 55.272 5.32578 56.9485 5.34656C56.9485 5.41781 56.9485 5.48905 56.9485 5.56327C42.1589 5.56327 27.3706 5.56327 12.1337 5.56327C12.1337 6.20449 12.1337 6.84569 12.1337 7.50621C11.9959 7.43496 11.8582 7.36373 11.716 7.291C11.3087 7.27319 10.8985 7.26724 10.4897 7.27021C10.1254 7.27021 10.1254 7.27022 9.75364 7.2717C9.4989 7.27319 9.24416 7.27615 8.98053 7.27764C8.72431 7.27912 8.4681 7.27912 8.20299 7.2806C7.56763 7.28357 6.93226 7.28655 6.29689 7.291C6.22876 7.00601 6.15914 6.72103 6.08805 6.42713C5.74445 6.42713 5.40084 6.42713 5.04688 6.42713C5.11945 5.87794 5.20685 5.61225 5.58896 5.21445C6.2732 4.80479 6.78266 4.83446 7.57206 4.83595Z" fill="#CFCFCF"/>
                            <Path d="M5.04785 20.896C5.25372 21.0029 5.25373 21.0029 5.46403 21.1127C5.46403 21.3264 5.46403 21.5402 5.46403 21.7599C17.8455 21.7599 30.2271 21.7599 42.9833 21.7599C42.9833 21.6174 42.9833 21.4749 42.9833 21.3279C39.8879 21.2567 36.7925 21.1854 33.6038 21.1127C33.6038 21.0415 33.6038 20.9687 33.6038 20.896C41.72 20.896 49.8375 20.896 58.1995 20.896C57.9936 21.1097 57.7863 21.3235 57.5745 21.5446C65.2093 21.6515 65.2093 21.6515 72.9996 21.7599C72.9996 21.8311 72.9996 21.9024 72.9996 21.9766C50.6432 21.9766 28.2884 21.9766 5.2552 21.9766C5.18707 21.6188 5.11894 21.2626 5.04785 20.896Z" fill="#34A853"/>
                            <Path d="M4.62891 6.64209C5.11173 6.64209 5.59308 6.64209 6.08923 6.64209C6.08923 11.2761 6.08923 15.9086 6.08923 20.6806C5.60789 20.6806 5.12506 20.6806 4.62891 20.6806C4.62891 16.0481 4.62891 11.4156 4.62891 6.64209Z" fill="#4B4B4B"/>
                            <Path d="M76.3848 5.10156C76.5744 5.10305 76.7625 5.10305 76.958 5.10453C77.2424 5.10305 77.2423 5.10305 77.5312 5.10156C78.0006 5.13125 78.0007 5.13126 78.2095 5.34649C78.2924 5.75912 78.3635 6.17323 78.4302 6.58883C78.4672 6.81445 78.5042 7.04006 78.5412 7.2731C78.6168 7.86533 78.6419 8.42196 78.6256 9.01865C78.8315 9.0899 79.0389 9.16113 79.2507 9.23386C79.5543 10.7286 79.7098 12.1728 79.0418 13.5532C78.2865 13.5532 77.5297 13.5532 76.7492 13.5532C76.7151 13.0723 76.7151 13.0723 76.681 12.581C76.5107 10.3174 76.3049 8.11619 75.8087 5.90161C75.7761 5.71904 75.7421 5.53499 75.708 5.34649C75.9154 5.13126 75.9154 5.13125 76.3848 5.10156Z" fill="#3E3E3E"/>
                            <Path d="M36.9375 10.0977C42.5773 10.0977 48.2186 10.0977 54.0302 10.0977C54.0302 12.4503 54.0302 14.8014 54.0302 17.2253C48.3889 17.2253 42.7491 17.2253 36.9375 17.2253C36.9375 14.8727 36.9375 12.5215 36.9375 10.0977ZM37.3537 10.5296C37.3537 12.5972 37.3537 14.6634 37.3537 16.7934C42.7195 16.7934 48.0853 16.7934 53.6126 16.7934C53.6126 14.7257 53.6126 12.6596 53.6126 10.5296C48.2467 10.5296 42.8824 10.5296 37.3537 10.5296Z" fill="#D4D4D4"/>
                            <Path d="M80.7083 3.83506C80.7172 4.19575 80.7172 4.55494 80.7083 4.91563C80.3336 5.30452 79.7575 5.18282 79.2495 5.19915C78.9962 5.20805 78.7429 5.21695 78.4823 5.22734C78.2157 5.23477 77.9476 5.24367 77.6736 5.25257C77.4056 5.26148 77.139 5.27187 76.8635 5.28077C76.2 5.30452 75.5365 5.3253 74.873 5.34756C74.873 5.99324 74.9782 6.57213 75.0952 7.20444C75.6254 10.1745 75.5587 13.1372 75.498 16.1459C75.4299 16.1459 75.3603 16.1459 75.2892 16.1459C75.2847 15.9782 75.2788 15.8104 75.2744 15.6382C75.2492 14.8709 75.224 14.105 75.1988 13.3376C75.1899 13.0748 75.1825 12.8106 75.1736 12.539C75.0655 8.96778 75.0655 8.96778 73.6215 5.7795C73.0543 5.58357 72.6588 5.52271 72.0694 5.49451C71.8931 5.4856 71.7154 5.47671 71.5333 5.4678C71.3496 5.4589 71.166 5.44999 70.9779 5.44108C70.7913 5.43217 70.6046 5.42327 70.4136 5.41288C69.9544 5.39062 69.4953 5.36834 69.0362 5.34756C69.0362 5.20507 69.0362 5.06258 69.0362 4.91563C65.3218 4.91563 61.6073 4.91563 57.7803 4.91563C57.7803 4.84438 57.7803 4.77314 57.7803 4.69893C57.9239 4.69744 58.0691 4.69448 58.2172 4.69299C59.5901 4.67073 60.963 4.64847 62.336 4.6262C63.0424 4.61433 63.7474 4.60244 64.4538 4.59205C69.4731 4.58759 69.4731 4.5876 74.4553 4.05176C74.7604 4.04731 75.064 4.05177 75.3677 4.06513C76.5036 4.08294 77.6011 3.92856 78.7222 3.75341C79.4361 3.64803 80.0226 3.57382 80.7083 3.83506Z" fill="#BAB0A5"/>
                            <Path d="M43.4251 11.1763C43.6769 11.2104 43.6769 11.2104 43.9331 11.246C44.1849 11.2787 44.1849 11.2787 44.4411 11.3113C44.8573 11.3945 44.8573 11.3945 45.0661 11.6097C45.0868 12.2153 45.0957 12.8135 45.0928 13.4191C45.0942 13.6714 45.0942 13.6714 45.0942 13.9296C45.0942 14.651 45.0794 15.2418 44.8573 15.929C44.5285 15.9409 44.1982 15.9498 43.8679 15.9572C43.6843 15.9617 43.5006 15.9661 43.3111 15.9721C42.7468 15.9275 42.4343 15.7628 41.9396 15.4971C41.8019 15.5683 41.6641 15.6396 41.5234 15.7138C41.5234 14.5026 41.5234 13.2899 41.5234 12.0416C41.867 11.8991 42.2106 11.7566 42.5646 11.6097C42.9823 11.1778 42.9823 11.1778 43.4251 11.1763Z" fill="#E5E7E6"/>
                            <Path d="M79.0418 13.7695C79.6313 14.8026 79.5439 15.8416 79.4595 17.0098C79.2507 17.8054 79.2507 17.8054 79.0418 18.3056C78.9041 18.3056 78.7663 18.3056 78.6256 18.3056C78.6375 18.6321 78.6375 18.6321 78.6508 18.9661C78.6242 19.8567 78.4731 20.4905 78.208 21.3291C78.4835 21.4003 78.7589 21.4716 79.0418 21.5443C79.0418 21.6868 79.0418 21.8293 79.0418 21.9763C78.1236 22.2152 77.2735 22.2093 76.333 22.193C76.5389 22.0861 76.5389 22.0861 76.7492 21.9763C76.7447 21.7314 76.7403 21.4864 76.7359 21.2341C76.7492 20.4652 76.7492 20.4652 76.958 20.2485C77.4823 18.2121 77.4986 16.0791 77.583 13.9863C78.208 13.7695 78.208 13.7695 79.0418 13.7695Z" fill="#595959"/>
                            <Path d="M75.9149 5.13107C76.4555 7.96164 76.8953 10.6616 76.7487 13.553C77.5055 13.553 78.2623 13.553 79.0414 13.553C79.0414 13.6243 79.0414 13.6955 79.0414 13.7697C77.9409 13.7697 76.8405 13.7697 75.706 13.7697C75.6512 13.3066 75.5964 12.8435 75.5387 12.3656C75.4839 11.9114 75.4291 11.4572 75.3728 11.0045C75.3358 10.6913 75.2973 10.3781 75.2603 10.0649C74.9789 7.6826 74.9789 7.68259 74.4561 5.3463C74.97 5.08061 75.3476 5.11474 75.9149 5.13107Z" fill="#212121"/>
                            <Path d="M50.0698 11.395C50.4134 11.4663 50.7571 11.5375 51.111 11.6103C51.1806 11.8952 51.2487 12.1802 51.3198 12.4741C51.5953 12.4741 51.8708 12.4741 52.1537 12.4741C52.1537 12.7591 52.1537 13.0441 52.1537 13.338C51.4502 13.2222 50.7585 13.099 50.0698 12.906C50.1083 13.0352 50.1468 13.1643 50.1868 13.2979C50.2787 13.7699 50.2787 13.7699 50.0698 14.4186C50.4134 14.4186 50.7571 14.4186 51.111 14.4186C51.111 14.2761 51.111 14.1336 51.111 13.9866C51.4561 13.9154 51.7997 13.8441 52.1537 13.7699C52.1537 14.1261 52.1537 14.4824 52.1537 14.8505C51.8782 14.8505 51.6042 14.8505 51.3198 14.8505C51.2517 15.1355 51.1821 15.4205 51.111 15.7144C50.7674 15.7856 50.4238 15.8568 50.0698 15.9296C50.018 15.796 49.9662 15.6624 49.9128 15.5244C49.6507 14.9663 49.6507 14.9662 48.8184 14.6338C48.8184 13.85 48.8184 13.0663 48.8184 12.2589C49.1634 12.1876 49.507 12.1164 49.861 12.0422C49.9306 11.8284 49.9988 11.6147 50.0698 11.395Z" fill="#CCCCCC"/>
                            <Path d="M6.50471 5.77832C8.2242 5.77832 9.94371 5.77832 11.7165 5.77832C11.7165 6.27853 11.7165 6.77725 11.7165 7.29082C9.92742 7.29082 8.1398 7.29082 6.2959 7.29082C6.36551 6.7921 6.43362 6.29337 6.50471 5.77832Z" fill="#D7D7D7"/>
                            <Path d="M77.165 5.13086C77.6804 5.23773 77.6804 5.23774 78.2077 5.34609C78.2773 5.75576 78.3469 6.16541 78.415 6.57508C78.455 6.80366 78.4935 7.03078 78.5335 7.2653C78.6135 7.86199 78.6416 8.41712 78.6239 9.01826C78.8312 9.08951 79.0371 9.16074 79.2489 9.23347C79.4799 10.369 79.5717 11.5342 79.4577 12.6904C79.32 12.9042 79.1822 13.1179 79.0415 13.3376C78.766 13.3376 78.4906 13.3376 78.2077 13.3376C78.1958 13.1565 78.184 12.9754 78.1721 12.7899C78.1292 12.119 78.0848 11.4481 78.0403 10.7772C78.0211 10.4877 78.0033 10.1968 77.984 9.90736C77.9574 9.49027 77.9293 9.07317 77.9026 8.65608C77.8848 8.40375 77.8685 8.1529 77.8522 7.89463C77.8256 7.30091 77.8256 7.30092 77.5812 6.85859C77.5857 6.64485 77.5901 6.43112 77.5945 6.20996C77.6538 5.53757 77.6538 5.53756 77.165 5.13086Z" fill="#717171"/>
                            <Path d="M80.7092 3.83543C80.7181 4.19463 80.7181 4.55531 80.7092 4.916C80.5018 5.13122 80.5018 5.13122 79.8842 5.15646C79.6147 5.15497 79.3451 5.15348 79.0667 5.15199C78.8519 5.15199 78.852 5.15199 78.6342 5.15199C78.1751 5.15051 77.716 5.14756 77.2569 5.14459C76.9473 5.1431 76.6363 5.14311 76.3268 5.14162C75.564 5.14014 74.8013 5.13568 74.04 5.13123C74.04 4.77499 74.04 4.41875 74.04 4.05213C74.1807 4.05658 74.3229 4.06105 74.4695 4.06699C75.9224 4.09519 77.3102 3.97939 78.7438 3.75378C79.4518 3.64839 80.0279 3.57716 80.7092 3.83543Z" fill="#C0C0C0"/>
                            <Path d="M77.596 13.7549C77.8996 13.7623 77.8996 13.7623 78.2077 13.7697C78.0018 13.841 77.796 13.9122 77.5827 13.9849C77.5871 14.2388 77.593 14.4911 77.5975 14.7523C77.6227 16.6374 77.5871 18.4037 77.1665 20.2487C77.131 20.4343 77.0969 20.6198 77.0613 20.8113C76.9577 21.3278 76.9577 21.3278 76.7488 21.9764C76.3193 22.1249 76.3194 22.1249 75.915 22.1917C76.0232 21.2195 76.1594 20.2651 76.3327 19.3032C76.5578 17.957 76.6259 16.6181 76.6778 15.2555C76.7385 13.7742 76.7385 13.7742 77.596 13.7549Z" fill="#444444"/>
                            <Path d="M7.538 4.85208C7.74386 4.85208 7.74386 4.85209 7.95565 4.85357C8.39256 4.85803 8.82947 4.86544 9.26786 4.87434C9.56555 4.87731 9.86176 4.88028 10.1595 4.88324C10.8866 4.89067 11.6138 4.90107 12.3425 4.91443C12.2729 5.76939 12.2048 6.62582 12.1337 7.50601C12.0641 7.50601 11.9959 7.50601 11.9249 7.50601C11.8212 6.65105 11.8212 6.65107 11.716 5.7783C9.99653 5.7783 8.27703 5.7783 6.5057 5.7783C6.43609 5.92079 6.36798 6.06328 6.29689 6.21023C6.08806 6.42694 6.08805 6.42694 5.55488 6.4403C5.3031 6.43288 5.3031 6.43287 5.04688 6.42693C5.11945 5.87477 5.20683 5.61204 5.59042 5.21276C6.26578 4.80754 6.76045 4.84169 7.538 4.85208Z" fill="#C5C5C5"/>
                            <Path d="M78.417 13.9849C78.6243 13.9849 78.8302 13.9849 79.0435 13.9849C79.6625 14.9482 79.5411 15.8788 79.4596 17.0084C79.2508 17.8055 79.2508 17.8055 79.0435 18.3042C78.9057 18.3042 78.768 18.3042 78.6258 18.3042C78.6391 18.6322 78.6391 18.6322 78.6525 18.9662C78.6243 19.8553 78.4733 20.4906 78.2096 21.3277C78.4836 21.399 78.7591 21.4702 79.0435 21.5444C79.0435 21.6869 79.0435 21.8294 79.0435 21.9764C78.1149 22.0832 78.1149 22.0832 77.167 22.1916C77.3047 21.9779 77.4425 21.7641 77.5832 21.5444C77.6676 21.1244 77.7357 20.6999 77.792 20.2754C77.9579 19.0478 77.9579 19.0478 78.22 18.4556C78.5118 17.5932 78.4614 16.7679 78.4437 15.861C78.4422 15.6814 78.4392 15.5003 78.4377 15.3148C78.4333 14.871 78.4259 14.4287 78.417 13.9849Z" fill="#848484"/>
                            <Path d="M79.0433 21.5444C79.1129 21.6869 79.181 21.8294 79.2521 21.9764C79.455 21.9719 79.6565 21.9675 79.8653 21.963C80.5036 21.9764 80.5036 21.9764 80.711 22.1931C80.7199 22.6235 80.7199 23.0569 80.711 23.4889C79.7601 23.4577 78.8093 23.4265 77.8585 23.3939C77.5889 23.385 77.3194 23.3761 77.0409 23.3687C76.7818 23.3583 76.5211 23.3494 76.253 23.3405C76.0146 23.333 75.7761 23.3241 75.5288 23.3167C74.9438 23.2766 74.4032 23.192 73.833 23.0569C73.9707 22.7705 74.1085 22.4855 74.2492 22.1931C74.3188 22.3356 74.3869 22.4781 74.458 22.625C75.9716 22.5538 77.4853 22.4825 79.0433 22.4083C78.9752 22.2658 78.9071 22.1233 78.836 21.9764C78.9041 21.8339 78.9737 21.6914 79.0433 21.5444Z" fill="#CECCCB"/>
                            <Path d="M76.751 5.13086C77.2664 5.23773 77.2664 5.23774 77.7922 5.34609C77.7892 5.58655 77.7847 5.82847 77.7803 6.07635C77.7373 6.82296 77.7373 6.82297 78.001 7.29053C78.0513 7.86347 78.0898 8.43047 78.118 9.0049C78.1269 9.16965 78.1357 9.33292 78.1446 9.50213C78.2098 10.7816 78.2335 12.0566 78.2098 13.3376C78.4853 13.4088 78.7593 13.4801 79.0436 13.5543C78.7 13.5543 78.3549 13.5543 78.001 13.5543C77.6633 12.9339 77.5285 12.4707 77.5048 11.7612C77.4989 11.5861 77.4915 11.4095 77.4841 11.2284C77.4782 11.0473 77.4722 10.8662 77.4678 10.6792C77.4248 9.46205 77.3567 8.27757 77.1672 7.0738C77.099 7.0738 77.0294 7.0738 76.9583 7.0738C76.8902 6.43258 76.8221 5.79138 76.751 5.13086Z" fill="#5C5C5C"/>
                            <Path d="M56.9475 21.9766C57.1534 21.9766 57.3592 21.9766 57.5725 21.9766C57.5725 22.1191 57.5725 22.2615 57.5725 22.4085C58.6729 22.4085 59.7733 22.4085 60.9078 22.4085C60.9078 22.4797 60.9078 22.551 60.9078 22.6252C57.3074 22.9235 53.71 22.8241 50.1051 22.7558C49.2757 22.7395 48.4463 22.7261 47.6184 22.7113C46.0026 22.6846 44.3883 22.6549 42.7725 22.6252C42.7725 22.4827 42.7725 22.3387 42.7725 22.1933C42.9472 22.1933 43.122 22.1933 43.3012 22.1948C44.9422 22.1977 46.5832 22.2022 48.2242 22.2037C49.0684 22.2051 49.9126 22.2066 50.7568 22.2096C51.5699 22.2111 52.3829 22.2126 53.1975 22.2126C53.5085 22.214 53.8196 22.214 54.1306 22.2155C54.5645 22.217 54.9985 22.217 55.4324 22.217C55.8042 22.2185 55.8041 22.2185 56.1833 22.2185C56.7224 22.2586 56.7224 22.2586 56.9475 21.9766Z" fill="#A8A8A8"/>
                            <Path d="M42.9816 11.1777C43.4052 11.197 43.4052 11.197 43.9206 11.2594C44.1753 11.2876 44.1753 11.2876 44.4345 11.3173C44.8581 11.3944 44.8581 11.3944 45.0669 11.6097C45.095 12.1871 45.0758 12.76 45.0669 13.3374C44.704 13.4784 44.704 13.4784 44.2331 13.5541C43.7858 13.3389 43.7858 13.3389 43.3459 13.0272C43.1993 12.9247 43.0527 12.8223 42.9001 12.7169C42.7891 12.6368 42.6795 12.5566 42.5654 12.4735C42.7476 11.4211 42.7476 11.4212 42.9816 11.1777Z" fill="#CBCCCC"/>
                            <Path d="M42.2678 13.7549C42.5181 13.7623 42.5181 13.7623 42.7758 13.7697C42.7758 13.9835 42.7758 14.1972 42.7758 14.4169C43.1194 14.4881 43.463 14.5594 43.817 14.6336C43.9473 15.0373 43.9473 15.0373 44.0258 15.4975C43.8881 15.6399 43.7504 15.7824 43.6097 15.9294C43.1135 15.8477 43.1135 15.8478 42.567 15.7127C42.2915 15.7127 42.0161 15.7127 41.7332 15.7127C41.6636 15.7127 41.5954 15.7127 41.5243 15.7127C41.5036 14.3842 41.5036 14.3842 41.5243 13.9849C41.7332 13.7697 41.7332 13.7697 42.2678 13.7549Z" fill="#C8C9C9"/>
                            <Path d="M69.8721 21.9767C70.4112 21.9708 70.9488 21.9663 71.4879 21.9633C71.6404 21.9618 71.7915 21.9604 71.9485 21.9589C72.6831 21.9544 73.3348 21.9871 74.0412 22.1934C73.9731 22.4784 73.9035 22.7634 73.8324 23.0573C72.5261 22.986 71.2183 22.9148 69.8721 22.8406C69.8721 22.5556 69.8721 22.2706 69.8721 21.9767Z" fill="#B8A898"/>
                            <Path d="M79.0415 13.9851C78.8342 13.9851 78.6283 13.9851 78.415 13.9851C78.4358 14.2538 78.455 14.521 78.4758 14.7985C78.4995 15.1518 78.5232 15.5065 78.5454 15.8613C78.5587 16.0379 78.5735 16.2146 78.5869 16.3956C78.6476 17.3768 78.6357 18.0521 78.2077 18.9531C78.1277 19.4548 78.0566 19.9594 77.9989 20.4641C77.9307 20.4641 77.8611 20.4641 77.79 20.4641C77.79 18.3267 77.79 16.1878 77.79 13.9851C78.3099 13.7165 78.5009 13.8174 79.0415 13.9851ZM77.5812 20.4641C77.6508 20.4641 77.7189 20.4641 77.79 20.4641C77.79 20.9628 77.79 21.463 77.79 21.9766C77.5842 21.9766 77.3783 21.9766 77.165 21.9766C77.3472 20.951 77.3472 20.951 77.5812 20.4641Z" fill="#6C6C6C"/>
                            <Path d="M43.3993 4.48242C43.3993 4.69616 43.3993 4.9099 43.3993 5.13106C39.2035 5.13106 35.0077 5.13106 30.6846 5.13106C30.6846 4.98856 30.6846 4.84607 30.6846 4.69912C32.25 4.67092 33.8155 4.64271 35.381 4.61451C36.1082 4.60115 36.8353 4.58779 37.5625 4.57592C38.3978 4.55959 39.2331 4.54476 40.0685 4.52992C40.3306 4.52546 40.5913 4.52101 40.8608 4.51655C41.2237 4.50913 41.2237 4.50913 41.5939 4.50319C41.8072 4.49874 42.0205 4.49578 42.2397 4.49132C42.6262 4.48539 43.0128 4.48242 43.3993 4.48242Z" fill="#ABABAB"/>
                            <Path d="M57.7812 4.69873C61.7712 4.69873 65.7611 4.69873 69.871 4.69873C69.871 4.91247 69.871 5.12622 69.871 5.34589C69.5955 5.34589 69.32 5.34589 69.0372 5.34589C69.0372 5.2034 69.0372 5.06091 69.0372 4.91396C65.3227 4.91396 61.6083 4.91396 57.7812 4.91396C57.7812 4.84271 57.7812 4.77146 57.7812 4.69873Z" fill="#B5B5B5"/>
                            <Path d="M48.8184 11.1782C49.9188 11.1782 51.0207 11.1782 52.1537 11.1782C52.2233 11.8907 52.2914 12.6031 52.3625 13.3379C52.087 13.1954 51.8115 13.0529 51.5287 12.9059C51.7345 12.9059 51.9419 12.9059 52.1537 12.9059C52.1537 12.7634 52.1537 12.6209 52.1537 12.474C51.8782 12.474 51.6042 12.474 51.3198 12.474C51.1821 12.189 51.0444 11.904 50.9037 11.6102C50.095 11.5166 50.095 11.5166 49.7055 11.9337C49.6181 12.0406 49.5322 12.1475 49.4448 12.2588C49.2375 12.1875 49.0316 12.1163 48.8184 12.0421C48.8184 11.7571 48.8184 11.4721 48.8184 11.1782Z" fill="#DDDEDE"/>
                            <Path d="M48.8177 14.6333C49.4768 14.9302 49.65 15.0638 50.0692 15.7139C50.4128 15.6426 50.7564 15.5714 51.1118 15.4972C51.18 15.2834 51.2481 15.0697 51.3192 14.85C51.6643 14.9213 52.0079 14.9925 52.3618 15.0652C52.2937 15.4215 52.2241 15.7777 52.153 16.1458C51.1222 16.1458 50.0899 16.1458 49.0265 16.1458C48.8888 15.7896 48.7511 15.4333 48.6104 15.0652C48.6785 14.9227 48.7481 14.7802 48.8177 14.6333Z" fill="#E0E0E0"/>
                            <Path d="M52.154 13.7695C52.154 14.1258 52.154 14.482 52.154 14.8486C51.8785 14.8486 51.6045 14.8486 51.3202 14.8486C51.2521 15.1336 51.1824 15.4186 51.1113 15.7125C50.7677 15.7837 50.4241 15.855 50.0702 15.9292C49.8347 14.9035 49.8347 14.9035 50.0702 14.4167C50.4138 14.4167 50.7574 14.4167 51.1113 14.4167C51.1113 14.2742 51.1113 14.1317 51.1113 13.9848C51.529 13.7695 51.529 13.7695 52.154 13.7695Z" fill="#9E9E9E"/>
                            <Path d="M17.9717 21.9766C17.9717 22.1191 17.9717 22.2615 17.9717 22.4085C20.7916 22.4085 23.6115 22.4085 26.5173 22.4085C26.5173 22.4797 26.5173 22.551 26.5173 22.6237C23.2842 22.695 20.0525 22.7662 16.7217 22.8404C16.7217 22.6267 16.7217 22.4115 16.7217 22.1918C17.3467 21.9766 17.3467 21.9766 17.9717 21.9766Z" fill="#B5B5B5"/>
                            <Path d="M6.92285 5.99316C8.29874 5.99316 9.67461 5.99316 11.092 5.99316C11.092 6.20839 11.092 6.42215 11.092 6.64182C9.71608 6.64182 8.34021 6.64182 6.92285 6.64182C6.92285 6.42808 6.92285 6.21433 6.92285 5.99316Z" fill="#34A853"/>
                            <Path d="M45.0682 13.9847C45.0001 14.6274 44.9305 15.2686 44.8594 15.9291C44.4476 15.9291 44.0344 15.9291 43.6094 15.9291C43.6434 15.7688 43.6775 15.6085 43.713 15.4437C43.8419 14.8085 43.8419 14.8084 43.8182 13.9847C44.2344 13.7694 44.2344 13.7694 45.0682 13.9847Z" fill="#DEDEDE"/>
                            <Path d="M74.6649 6.85889C74.8026 6.93013 74.9389 7.00286 75.0811 7.07559C75.8838 9.93436 75.5357 13.2087 75.4987 16.1462C75.4291 16.1462 75.361 16.1462 75.2899 16.1462C75.2825 15.8953 75.2825 15.8953 75.2736 15.6385C75.2499 14.8712 75.2247 14.1053 75.198 13.3394C75.1906 13.0752 75.1818 12.8109 75.1744 12.5393C75.1225 10.1644 75.1225 10.1644 74.6382 7.85781C74.5775 7.67079 74.5183 7.48378 74.4561 7.29082C74.5242 7.14833 74.5938 7.00583 74.6649 6.85889Z" fill="#B0B0B0"/>
                            <Path d="M78.2096 21.7612C78.6229 21.9037 79.0346 22.0462 79.4611 22.1932C79.0435 22.6251 79.0435 22.6251 78.5947 22.6741C78.4125 22.6711 78.2318 22.6696 78.0452 22.6667C77.8497 22.6652 77.6528 22.6637 77.4513 22.6622C77.2455 22.6592 77.0396 22.6548 76.8293 22.6518C76.622 22.6489 76.4146 22.6474 76.2013 22.6459C75.6904 22.64 75.178 22.634 74.667 22.6251C74.667 22.4114 74.667 22.1961 74.667 21.9765C74.904 21.9794 75.1424 21.9809 75.3883 21.9839C75.6993 21.9869 76.0103 21.9883 76.3213 21.9898C76.4783 21.9913 76.6353 21.9943 76.7982 21.9958C77.1981 21.9972 77.5994 21.9883 78.0008 21.9765C78.0704 21.9052 78.1386 21.834 78.2096 21.7612Z" fill="#B8B8B8"/>
                            <Path d="M77.1672 6.85693C77.2354 6.85693 77.305 6.85693 77.376 6.85693C77.5701 8.31749 77.6515 9.76619 77.7108 11.2386C77.7182 11.4138 77.7256 11.5874 77.7345 11.767C77.7404 11.9243 77.7463 12.0802 77.7537 12.242C77.7937 12.6977 77.8826 13.1133 78.001 13.5526C77.7952 13.4814 77.5878 13.4101 77.376 13.3374C77.305 12.6175 77.2354 11.8976 77.1672 11.1778C77.148 10.9759 77.1272 10.774 77.1065 10.5662C76.9969 9.39511 76.9169 8.24921 76.9584 7.07364C77.028 7.00239 77.0961 6.93115 77.1672 6.85693Z" fill="#4D4D4D"/>
                            <Path d="M74.0381 4.05176C75.4821 4.15863 75.4821 4.15863 76.9557 4.26699C76.9557 4.33824 76.9557 4.40948 76.9557 4.48369C77.5748 4.59056 77.5748 4.59057 78.2058 4.69892C78.2058 4.77017 78.2058 4.84141 78.2058 4.91562C76.8313 4.98687 75.4554 5.05812 74.0381 5.13085C74.0381 4.77462 74.0381 4.41838 74.0381 4.05176Z" fill="#CCCAC9"/>
                            <Path d="M57.5728 4.48389C57.5728 4.76887 57.5728 5.05386 57.5728 5.34775C57.4706 5.31361 57.3669 5.27949 57.2603 5.24386C56.5316 5.08653 55.8044 5.08058 55.0624 5.06276C54.901 5.05831 54.741 5.05385 54.5752 5.0494C54.0627 5.03604 53.5518 5.02268 53.0393 5.01081C52.6913 5.00042 52.3432 4.99152 51.9967 4.98261C51.1451 4.95886 50.295 4.9366 49.4434 4.91582C49.4434 4.84457 49.4434 4.77333 49.4434 4.69912C50.5008 4.66943 51.5583 4.63827 52.6158 4.6071C52.9756 4.59671 53.3341 4.5863 53.6939 4.57591C54.2108 4.56107 54.7277 4.54622 55.2446 4.53138C55.406 4.52693 55.5675 4.521 55.7334 4.51655C56.3465 4.49873 56.9596 4.48389 57.5728 4.48389Z" fill="#A2A2A2"/>
                            <Path d="M78.4163 13.9849C78.6222 13.9849 78.8295 13.9849 79.0413 13.9849C79.0413 15.1975 79.0413 16.4087 79.0413 17.657C78.9036 17.7283 78.7673 17.7995 78.6251 17.8723C78.3734 17.0915 78.3941 16.3776 78.403 15.5642C78.4045 15.4128 78.406 15.2614 78.406 15.1055C78.4089 14.7315 78.4119 14.3589 78.4163 13.9849Z" fill="#959595"/>
                            <Path d="M51.112 12.689C51.1801 12.9027 51.2497 13.1164 51.3208 13.3376C51.74 13.4949 51.7399 13.4949 52.1532 13.5528C51.8096 13.6953 51.466 13.8378 51.112 13.9848C51.112 14.1273 51.112 14.2698 51.112 14.4167C50.7684 14.4167 50.4233 14.4167 50.0693 14.4167C50.0693 13.918 50.0693 13.4192 50.0693 12.9057C50.4129 12.8344 50.758 12.7632 51.112 12.689Z" fill="#E6E6E6"/>
                            <Path d="M43.4009 4.69922C45.3944 4.69922 47.3893 4.69922 49.445 4.69922C49.445 4.77047 49.445 4.84172 49.445 4.91445C49.3251 4.92039 49.2036 4.92633 49.0792 4.93078C45.9231 5.06734 45.9231 5.06733 42.7744 5.34638C42.9818 5.27514 43.1876 5.20388 43.4009 5.13115C43.4009 4.98866 43.4009 4.84616 43.4009 4.69922Z" fill="#B8B8B8"/>
                            <Path d="M74.8722 17.4419C75.01 17.4419 75.1477 17.4419 75.2899 17.4419C75.2662 17.9273 75.2395 18.4141 75.2114 18.8995C75.1892 19.3047 75.1892 19.3047 75.167 19.7188C75.0914 20.3808 74.9981 20.7712 74.6634 21.3293C74.4131 19.9266 74.542 18.8223 74.8722 17.4419Z" fill="#B6B6B6"/>
                            <Path d="M78.4146 7.93896C78.4843 7.93896 78.5524 7.93896 78.6235 7.93896C78.6531 8.18388 78.6842 8.42879 78.7153 8.68112C78.7508 9.40843 78.7508 9.40843 79.0411 9.6667C79.0559 10.1016 79.0574 10.5395 79.053 10.9759C79.0515 11.2133 79.05 11.4523 79.0485 11.6987C79.0456 11.8828 79.0426 12.0668 79.0411 12.2583C78.9715 12.2583 78.9034 12.2583 78.8323 12.2583C78.8323 11.8308 78.8323 11.4019 78.8323 10.9625C78.6946 10.9625 78.5568 10.9625 78.4146 10.9625C78.2251 9.88786 78.2251 9.01212 78.4146 7.93896Z" fill="#A0A0A0"/>
                            <Path d="M78.8348 14.4185C79.0407 14.4897 79.248 14.5609 79.4598 14.6337C79.5368 17.1228 79.5368 17.1228 79.0436 18.3058C78.9059 18.3058 78.7682 18.3058 78.626 18.3058C78.6956 18.0921 78.7637 17.8784 78.8348 17.6572C78.8496 17.1021 78.8541 16.5529 78.8481 15.9978C78.8467 15.7707 78.8467 15.7707 78.8452 15.5376C78.8422 15.1651 78.8393 14.791 78.8348 14.4185Z" fill="#5E5E5E"/>
                            <Path d="M42.3573 11.8267C42.5631 12.1116 42.769 12.3966 42.9823 12.6905C42.7216 13.0141 42.7216 13.0141 42.3573 13.3392C42.0818 13.3392 41.8063 13.3392 41.5234 13.3392C41.5234 12.9117 41.5234 12.4827 41.5234 12.0434C41.7974 11.9721 42.0729 11.9009 42.3573 11.8267Z" fill="#CFD0D0"/>
                            <Path d="M78.624 9.01855C78.8314 9.0898 79.0372 9.16104 79.2505 9.23526C79.4845 10.393 79.4786 11.5137 79.4579 12.6907C79.252 12.762 79.0461 12.8332 78.8329 12.9059C78.8358 12.6803 78.8373 12.4532 78.8402 12.2202C78.8417 11.9219 78.8447 11.625 78.8462 11.3266C78.8477 11.1782 78.8491 11.0283 78.8506 10.8754C78.8551 10.1956 78.8329 9.6672 78.624 9.01855Z" fill="#5C5C5C"/>
                            <Path d="M50.0702 11.3931C50.4138 11.4643 50.7588 11.5356 51.1128 11.6098C51.0432 11.966 50.9751 12.3222 50.904 12.6889C50.5604 12.6176 50.2168 12.5464 49.8613 12.4736C49.9309 12.1174 49.9991 11.7612 50.0702 11.3931Z" fill="#7E8080"/>
                            <Path d="M80.7098 3.83522C80.7098 3.97771 80.7098 4.1202 80.7098 4.26715C79.6094 4.26715 78.509 4.26715 77.376 4.26715C78.4246 3.72389 79.5635 3.38992 80.7098 3.83522Z" fill="#B5B5B5"/>
                            <Path d="M56.9473 21.978C57.1531 21.978 57.359 21.978 57.5723 21.978C57.5723 22.1205 57.5723 22.263 57.5723 22.41C58.6727 22.41 59.7731 22.41 60.9076 22.41C60.9076 22.4812 60.9076 22.5525 60.9076 22.6252C58.9467 22.7321 58.9467 22.7321 56.9473 22.8419C56.9473 22.5554 56.9473 22.2704 56.9473 21.978Z" fill="#959595"/>
                            <Path d="M76.9591 13.7695C77.0953 13.7695 77.2331 13.7695 77.3752 13.7695C77.1738 15.8015 77.1738 15.8015 76.9591 16.7931C76.8894 16.7931 76.8213 16.7931 76.7502 16.7931C76.7443 16.33 76.7399 15.8654 76.7369 15.4023C76.7339 15.144 76.7325 14.8857 76.7295 14.6201C76.7502 13.9848 76.7502 13.9848 76.9591 13.7695Z" fill="#3A3A3A"/>
                            <Path d="M78.417 10.9629C78.5547 10.9629 78.6925 10.9629 78.8332 10.9629C78.9028 11.7466 78.9709 12.5303 79.042 13.3378C78.8361 13.3378 78.6288 13.3378 78.417 13.3378C78.417 12.5541 78.417 11.7704 78.417 10.9629Z" fill="#7A7A7A"/>
                            <Path d="M42.7738 14.6333C42.9115 14.6333 43.0492 14.6333 43.1914 14.6333C43.1914 14.847 43.1914 15.0608 43.1914 15.282C43.3973 15.282 43.6046 15.282 43.8164 15.282C43.7483 15.4957 43.6787 15.7094 43.6076 15.9291C43.264 15.8579 42.9204 15.7866 42.5664 15.7139C42.6345 15.3577 42.7042 15.0014 42.7738 14.6333Z" fill="#6A6C6B"/>
                            <Path d="M41.9393 15.2803C42.4947 15.5682 43.0516 15.8562 43.6069 16.1441C42.9879 16.1441 42.3688 16.1441 41.7305 16.1441C41.7305 15.497 41.7305 15.497 41.9393 15.2803Z" fill="#E1E2E2"/>
                            <Path d="M44.2332 13.7695C44.645 13.8764 44.645 13.8764 45.0671 13.9848C44.9975 14.2697 44.9293 14.5547 44.8582 14.8486C44.5828 14.7774 44.3073 14.7061 44.0244 14.6334C44.094 14.3484 44.1621 14.0634 44.2332 13.7695Z" fill="#C5C5C5"/>
                            <Path d="M42.7738 11.395C42.9811 11.395 43.187 11.395 43.4002 11.395C43.4684 11.8225 43.538 12.25 43.6076 12.6908C43.264 12.6196 42.9204 12.5483 42.5664 12.4741C42.6345 12.1179 42.7042 11.7616 42.7738 11.395Z" fill="#676969"/>
                            <Path d="M41.7308 11.1797C42.144 11.1797 42.5572 11.1797 42.9823 11.1797C42.7216 11.6116 42.7216 11.6116 42.3573 12.0436C42.0818 12.0436 41.8063 12.0436 41.5234 12.0436C41.5916 11.7586 41.6597 11.4736 41.7308 11.1797Z" fill="#E1E2E2"/>
                            <Path d="M69.8701 21.978C70.2137 21.978 70.5588 21.978 70.9128 21.978C70.9128 22.263 70.9128 22.548 70.9128 22.8419C70.5692 22.8419 70.2241 22.8419 69.8701 22.8419C69.8701 22.5554 69.8701 22.2704 69.8701 21.978Z" fill="#5F5F5F"/>
                            <Path d="M69.8721 4.48242C70.2157 4.48242 70.5608 4.48242 70.9147 4.48242C70.9147 4.76741 70.9147 5.0524 70.9147 5.34629C70.5711 5.34629 70.226 5.34629 69.8721 5.34629C69.8721 5.0613 69.8721 4.77631 69.8721 4.48242Z" fill="#5E5E5E"/>
                            <Path d="M5.25539 4.69873C5.39313 4.91247 5.52939 5.12622 5.67158 5.34589C5.38573 5.88618 5.38572 5.88618 5.04656 6.42646C4.90882 6.42646 4.77109 6.42646 4.62891 6.42646C4.7859 5.1841 4.7859 5.1841 5.25539 4.69873Z" fill="#BEBEBE"/>
                            <Path d="M79.0428 21.5444C79.1109 21.6869 79.1806 21.8294 79.2502 21.9764C79.6634 21.9764 80.0766 21.9764 80.5016 21.9764C80.5698 22.1901 80.6394 22.4038 80.7105 22.625C79.7818 22.4113 79.7819 22.4113 78.834 22.1931C78.9021 21.9778 78.9717 21.7641 79.0428 21.5444Z" fill="#C9C9C9"/>
                            <Path d="M17.9717 21.9766C17.8339 22.2615 17.6962 22.5465 17.554 22.8404C17.28 22.8404 17.0046 22.8404 16.7217 22.8404C16.7217 22.6267 16.7217 22.4115 16.7217 22.1918C17.3467 21.9766 17.3467 21.9766 17.9717 21.9766Z" fill="#7E7E7E"/>
                            <Path d="M5.46403 5.34619C5.60177 5.34619 5.7395 5.34619 5.88168 5.34619C5.88168 5.70391 5.88168 6.06014 5.88168 6.42676C5.60621 6.42676 5.33073 6.42676 5.04785 6.42676C5.23002 5.58961 5.23003 5.58962 5.46403 5.34619Z" fill="#E4E4E4"/>
                          </G>
                      </Svg>


                      <View style={{
                        width : 50,
                        height : 4,
                        borderRadius : 24,
                        backgroundColor : '#f4f4f4'
                      }}/>

                    </View>

                  <View style={{
                    display : 'flex',
                    gap : 4,
                    alignItems : 'center'
                  }}>
                    <Text style={{
                      fontWeight : '700',
                      fontSize : 14,
                      maxWidth : 100,
                      textAlign : 'center'
                    }}>Phamarcy</Text>
                     <Text style={{
                      fontSize : 10,
                      color : 'rgba(0,0,0,0.5)'
                    }}>Campus</Text>
                    <Text style={{
                      fontSize : 12,
                      color : 'rgba(0,0,0,0.6)',
                      padding : 4,
                      backgroundColor : '#fafafa',
                      borderRadius : 6
                    }}>Stop</Text>
                  </View>

                </View>


{/* 
            <View style={styles.routeInputsContainer}>
              <View style={styles.routeInputWrapper}>
                <Text style={styles.routeInputLabel}>Starting Point</Text>
                <View style={styles.routeInputRow}>
                  <View style={styles.circleContainer}>
                    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M20.6201 8.45C19.5701 3.83 15.5401 1.75 12.0001 1.75C12.0001 1.75 12.0001 1.75 11.9901 1.75C8.4601 1.75 4.4201 3.82 3.3701 8.44C2.2001 13.6 5.3601 17.97 8.2201 20.72C9.2801 21.74 10.6401 22.25 12.0001 22.25C13.3601 22.25 14.7201 21.74 15.7701 20.72C18.6301 17.97 21.7901 13.61 20.6201 8.45ZM12.0001 13.46C10.2601 13.46 8.8501 12.05 8.8501 10.31C8.8501 8.57 10.2601 7.16 12.0001 7.16C13.7401 7.16 15.1501 8.57 15.1501 10.31C15.1501 12.05 13.7401 13.46 12.0001 13.46Z"
                        fill="black"
                        fillOpacity="0.6"
                      />
                    </Svg>
                  </View>
                  {/* <Text style={styles.routeDisplayText}>{startPoint}</Text> */}
                  {/* <StartPoint onLocationSelect={handleStartPointChange} />
                </View>
              </View>

              <View style={styles.dashedLine} />

              <View style={styles.routeInputWrapper}>
                <Text style={styles.routeInputLabel}>Ending Point</Text>
                <View style={styles.routeInputRow}>
                  <View style={styles.circleContainer}>
                    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M20.6202 8.7C19.5802 4.07 15.5402 2 12.0002 2C12.0002 2 12.0002 2 11.9902 2C8.46024 2 4.43024 4.07 3.38024 8.69C2.20024 13.85 5.36024 18.22 8.22024 20.98C9.28024 22 10.6402 22.51 12.0002 22.51C13.3602 22.51 14.7202 22 15.7702 20.98C18.6302 18.22 21.7902 13.86 20.6202 8.7ZM15.2802 9.53L11.2802 13.53C11.1302 13.68 10.9402 13.75 10.7502 13.75C10.5602 13.75 10.3702 13.68 10.2202 13.53L8.72024 12.03C8.43024 11.74 8.43024 11.26 8.72024 10.97C9.01024 10.68 9.49024 10.68 9.78024 10.97L10.7502 11.94L14.2202 8.47C14.5102 8.18 14.9902 8.18 15.2802 8.47C15.5702 8.76 15.5702 9.24 15.2802 9.53Z"
                        fill="black"
                        fillOpacity="0.6"
                      />
                    </Svg>
                  </View>
                  <EndingPoint onLocationSelect={handleEndPointChange} />
                </View>
              </View>
            </View> */} 
          </View>

          {/* <PrimaryButton title="Confirm Route" onPress={handleConfirmRoute} /> */}

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  main: {
    flex: 1,
    backgroundColor: "white",
    paddingHorizontal: 8,
    paddingTop: 30,
  },
  contentWrapper: {
    flex: 1,
    gap: 44,
    marginHorizontal: 12,
  },
  mainContent: {
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: {
    fontSize: 12,
    borderWidth: 1,
    borderColor: "red",
    borderRadius: 12,
    padding: 12,
    color: "red",
    marginTop: 4,
    width: "100%",
  },
  toggleContainer: {
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#f4f4f4",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  toggleText: {
    fontSize: 18,
  },
  circleContainer: {
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    borderStyle: "dashed",
    padding: 12,
    height: 50,
    width: 50,
  },
  dashedLine: {
    height: 60,
    width: 1,
    borderWidth: 1,
    marginHorizontal: 24,
    borderStyle: "dashed",
    borderColor: "rgba(0,0,0,0.2)",
  },
  signOutButton: {
    backgroundColor: "#fd4d36",
    marginTop: "auto",
    marginBottom: 8,
    fontWeight: "600",
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  activeToggleContainer: {
    backgroundColor: "#E8F2FF",
  },
  activeToggleText: {
    color: "#1573FE",
  },
  toggleDescription: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "rgba(0,0,0,0.6)",
    textAlign: "center",
  },
  routesContainer: {
    gap: 12,
  },
  routesTitle: {
    fontWeight: "700",
    fontSize: 18,
  },
  routeInputsContainer: {
    gap: 12,
  },
  routeInputWrapper: {
    gap: 12,
  },
  routeInputLabel: {
    fontSize: 16,
    color: "rgba(0,0,0,0.6)",
  },
  routeInputRow: {
    flexDirection: "row",
    gap: 12,
  },
  routeDisplayContainer: {
    height: 50,
    borderColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    width: "83%",
    justifyContent: "center",
    backgroundColor: "#f8f8f8",
  },
  routeDisplayText: {
    fontSize: 16,
    color: "#333",
  },
  signOutText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
});
