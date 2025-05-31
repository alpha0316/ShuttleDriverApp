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

  useEffect(() => {
    const getToken = async () => {
      let result = await AsyncStorage.getItem("userToken");
      console.log("User Token:", result);
      if (result) {
        // navigation.navigate("Home");
      } else {
        // navigation.navigate('Register');
      }
    };
    getToken();
  }, []);

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
      console.log("Switch Status Response:", data);

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
                  <StartPoint onLocationSelect={handleStartPointChange} />
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
            </View>
          </View>

          <PrimaryButton title="Confirm Route" onPress={handleConfirmRoute} />

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
    gap: 2,
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
