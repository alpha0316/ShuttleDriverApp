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
  G, 
  ClipPath
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
  const [busID, setBusID] = useState<string>("bus_001");    
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [busRoute, setBusRoute] = useState([])
  const [route1, setRoute1]= useState(false)
  const [route2, setRoute2]= useState(false)
  const [route3, setRoute3]= useState(false)
  const [firstName, setFirstName] = useState('')
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
        console.log("Drivers fetched successfully:", data.drivers[2].busRoute[0].stops);
       

        const matchingDriver = data.drivers.find((driver: any) => driver.driverID === busID)
        //  console.log("Matching:", matchingDriver);
         
        if (!matchingDriver) {
          console.warn("No matching driver found with ID:", busID);
          setBusRoute([]); 
          return; 
        }

        if (matchingDriver.busRoute && matchingDriver.busRoute.length > 0) {

          const stops = matchingDriver.busRoute[0].stops;
          setBusRoute(stops);
          // console.log("Bus routes set:", busRoute);
        } else {
          // console.log("No bus routes found for driver");
          setBusRoute([]);
        }


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
    fetchDrivers();
  }, [busID]);



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

useEffect(() => {
  console.log("Current busRoute:", busRoute);
  
  setRoute1(false);
  setRoute2(false);
  setRoute3(false);

  if (JSON.stringify(busRoute) === JSON.stringify(["Main Library", "Brunei", "Pentecost Busstop", "KSB", "SRC Busstop", "Main Library"])) {
    setRoute1(true);
    console.log('Route1 matched - setting to true');
  } else if (JSON.stringify(busRoute) === JSON.stringify(["Commercial Area", "Hall 7", "Pentecost Busstop", "KSB", "SRC Busstop", "Conti Busstop", "Commercial Area"])) {
    setRoute2(true);
    console.log('Route2 matched - setting to true');
  } else if (JSON.stringify(busRoute) === JSON.stringify(["Gaza", "Pharmacy Busstop", "Medical Village", "Gaza"])) {
    setRoute3(true);
    // console.log('Route3 matched - setting to true');
  } else {
    console.log('No route matched');
  }
}, [busRoute]);
  // const handleStartPointChange = (selectedLocation: string) => {
  //   setStartPoint(selectedLocation);
  // };

  // const handleEndPointChange = (selectedLocation: string) => {
  //   setEndPoint(selectedLocation);
  // };

  // const handleConfirmRoute = () => {
  //   console.log("Start Point:", startPoint);
  //   console.log("End Point:", endPoint);
  //   if (location) {
  //     console.log("Current Location:", location.coords);
  //   }
  // };

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
            // console.log("Bus ID:", userData.driver.id);
            setFirstName(userData.driver.fullName.split(' ')[0]);
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
                <View style={styles.profileContainer}>
                    {/* <Image
                      source={{
                        uri: "https://api.dicebear.com/7.x/notionists/svg?seed=123",
                      }}
                      style={styles.profileImage}
                    /> */}
                    <View style={styles.profileTextContainer}>
                      <Text style={styles.profileText}>Hello {firstName}</Text>
                      <Text style={styles.profileSubText}>Tap to view app settings</Text>
                    </View>
                  </View>
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
                    fill={isActiveTrip ? "#34A853" : "#D9D9D9"}
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
                      <Stop stopColor="#34A853" stopOpacity="0.0252353" />
                      <Stop offset="1" stopColor="#EEEEEE" />
                    </LinearGradient>
                  </Defs>
                </Svg>
              </TouchableOpacity>
            </View>

            { isActiveTrip ?

            <View style={{
              display : 'flex',
              gap : 8,
              flexDirection : 'row',
              padding : 12,
              borderRadius : 12,
              // borderWidth : 1,
              // borderColor : 'rgba(0,0,0,0.1)',
              backgroundColor : '#6996350D'
            }}>
              <Svg width="24" height="24" viewBox="0 0 16 16" fill="none">
                <Path d="M14.3736 7.16012L13.4669 6.10679C13.2936 5.90679 13.1536 5.53345 13.1536 5.26679V4.13345C13.1536 3.42679 12.5736 2.84679 11.8669 2.84679H10.7336C10.4736 2.84679 10.0936 2.70679 9.89358 2.53345L8.84025 1.62679C8.38025 1.23345 7.62691 1.23345 7.16025 1.62679L6.11358 2.54012C5.91358 2.70679 5.53358 2.84679 5.27358 2.84679H4.12025C3.41358 2.84679 2.83358 3.42679 2.83358 4.13345V5.27345C2.83358 5.53345 2.69358 5.90679 2.52691 6.10679L1.62691 7.16679C1.24025 7.62679 1.24025 8.37345 1.62691 8.83345L2.52691 9.89345C2.69358 10.0935 2.83358 10.4668 2.83358 10.7268V11.8668C2.83358 12.5735 3.41358 13.1535 4.12025 13.1535H5.27358C5.53358 13.1535 5.91358 13.2935 6.11358 13.4668L7.16691 14.3735C7.62691 14.7668 8.38025 14.7668 8.84691 14.3735L9.90025 13.4668C10.1002 13.2935 10.4736 13.1535 10.7402 13.1535H11.8736C12.5802 13.1535 13.1602 12.5735 13.1602 11.8668V10.7335C13.1602 10.4735 13.3002 10.0935 13.4736 9.89345L14.3802 8.84012C14.7669 8.38012 14.7669 7.62012 14.3736 7.16012ZM10.7736 6.74012L7.55358 9.96012C7.46025 10.0535 7.33358 10.1068 7.20025 10.1068C7.06691 10.1068 6.94025 10.0535 6.84691 9.96012L5.23358 8.34679C5.04025 8.15345 5.04025 7.83345 5.23358 7.64012C5.42691 7.44679 5.74691 7.44679 5.94025 7.64012L7.20025 8.90012L10.0669 6.03345C10.2602 5.84012 10.5802 5.84012 10.7736 6.03345C10.9669 6.22679 10.9669 6.54679 10.7736 6.74012Z" fill="#34A853"/>
              </Svg>

                <View style={{
                  display : 'flex',
                  gap : 8
                }}>
                  <Text style={{
                    fontSize : 16,
                    fontWeight : '700',
                    color : '#34A853'
                  }}>You are currently on an active ride</Text>
                        <Text style={{
                    fontSize : 14,
                    color : 'rgba(0,0,0,0.5)'
                  }}>Switch the button on when you're on an active ride</Text>
                </View>

            </View>
            :
             <View style={{
              display : 'flex',
              gap : 8,
              flexDirection : 'row',
              padding : 12,
              borderRadius : 12,
              // borderWidth : 1,
              // borderColor : 'rgba(0,0,0,0.1)',
              backgroundColor : '#D2AA190D'
            }}>
                <Svg width="24" height="24" viewBox="0 0 16 16" fill="none">
                  <Path d="M13.4605 9.37337L12.7071 8.12003C12.5405 7.8467 12.3938 7.32003 12.3938 7.00003V5.75337C12.3938 3.33337 10.4271 1.3667 8.01379 1.3667C5.59379 1.37337 3.62713 3.33337 3.62713 5.75337V6.99337C3.62713 7.31337 3.48046 7.84003 3.32046 8.11337L2.56713 9.3667C2.28046 9.85337 2.21379 10.4067 2.39379 10.8867C2.57379 11.3734 2.98046 11.76 3.51379 11.9334C4.23379 12.1734 4.96046 12.3467 5.70046 12.4734C5.77379 12.4867 5.84713 12.4934 5.92046 12.5067C6.01379 12.52 6.11379 12.5334 6.21379 12.5467C6.38713 12.5734 6.56046 12.5934 6.74046 12.6067C7.16046 12.6467 7.58713 12.6667 8.01379 12.6667C8.43379 12.6667 8.85379 12.6467 9.26713 12.6067C9.42046 12.5934 9.57379 12.58 9.72046 12.56C9.84046 12.5467 9.96046 12.5334 10.0805 12.5134C10.1538 12.5067 10.2271 12.4934 10.3005 12.48C11.0471 12.36 11.7871 12.1734 12.5071 11.9334C13.0205 11.76 13.4138 11.3734 13.6005 10.88C13.7871 10.38 13.7338 9.83337 13.4605 9.37337ZM8.50046 6.6667C8.50046 6.9467 8.27379 7.17337 7.99379 7.17337C7.71379 7.17337 7.48713 6.9467 7.48713 6.6667V4.60003C7.48713 4.32003 7.71379 4.09337 7.99379 4.09337C8.27379 4.09337 8.50046 4.32003 8.50046 4.60003V6.6667Z" fill="#D2AA19"/>
                  <Path d="M9.88678 13.3399C9.60678 14.1133 8.86678 14.6666 8.00012 14.6666C7.47345 14.6666 6.95345 14.4533 6.58678 14.0733C6.37345 13.8733 6.21345 13.6066 6.12012 13.3333C6.20678 13.3466 6.29345 13.3533 6.38678 13.3666C6.54012 13.3866 6.70012 13.4066 6.86012 13.4199C7.24012 13.4533 7.62678 13.4733 8.01345 13.4733C8.39345 13.4733 8.77345 13.4533 9.14678 13.4199C9.28678 13.4066 9.42678 13.3999 9.56012 13.3799C9.66678 13.3666 9.77345 13.3533 9.88678 13.3399Z" fill="#D2AA19"/>
                </Svg>

                <View style={{
                  display : 'flex',
                  gap : 8
                }}>
                  <Text style={{
                    fontSize : 16,
                    fontWeight : '700',
                    color : '#D2AA19'
                  }}>You are currently not an active ride</Text>
                        <Text style={{
                    fontSize : 14,
                    color : 'rgba(0,0,0,0.5)'
                  }}>Switch the button on when you're on an active ride</Text>
                </View>

            </View>
            }



          </View>

          <View style={styles.routesContainer}>
            <Text style={styles.routesTitle}>Your Routes</Text>


                <View style={{
                  display : 'flex',
                  flexDirection : 'row',
                  alignItems : 'center',
                  justifyContent : 'space-between',
                  padding : 16,
                  borderWidth : 1,
                  borderRadius : 16,
                  borderColor : route1 ? '#34A853' : 'rgba(0,0,0,0.1)',
                  backgroundColor : route1 ? '#fafafa' : '#fff'
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
                        <Svg width="84" height="27" viewBox="0 0 84 27" fill="none">
                          <Mask id="mask0_933_1781" maskType="luminance" maskUnits="userSpaceOnUse" x="0" y="0" width="84" height="27">
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
                       borderColor : route2 ? '#34A853' : 'rgba(0,0,0,0.1)',
                  backgroundColor : route2 ? '#fafafa' : '#fff'
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
                        width : 10,
                        height : 2,
                        borderRadius : 24,
                        backgroundColor : '#34A853'
                      }}/>


                        <Svg width="84" height="27" viewBox="0 0 84 27" fill="none">
                          <Mask id="mask0_933_1781"  maskUnits="userSpaceOnUse" x="0" y="0" width="84" height="27">
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
                  borderColor : route3 ? '#34A853' : 'rgba(0,0,0,0.1)',
                  backgroundColor : route3 ? '#fafafa' : '#fff'
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
                        width : 40,
                        height : 2,
                        borderRadius : 24,
                        backgroundColor : '#34A853'
                      }}/>

                        <Svg width="84" height="27" viewBox="0 0 84 27" fill="none">
                          <Mask id="mask0_933_1781"  maskUnits="userSpaceOnUse" x="0" y="0" width="84" height="27">
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
                        width : 20,
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

          </View>

          {/* <PrimaryButton title="Confirm Route" onPress={handleConfirmRoute} /> */}
{/* 
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity> */}

          <TouchableOpacity
            onPress={handleSignOut}
            style={{
                 marginTop: "auto",
                 marginBottom: 24,
            }}
          >
            <Text style={{
              color : 'red'
            }}>Sign Out</Text>
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
    gap: 24,
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
    color : '#D2AA19'
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
    backgroundColor: "#6996350D",
  },
  activeToggleText: {
    color: "#34A853",
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
    profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  profileTextContainer: {
    flexDirection: "column",
    gap: 4,
  },
  profileText: {
    fontWeight: "600",
    fontSize: 16,
  },
  profileSubText: {
    fontSize: 12,
    color: "#4F4F4F",
  },
});
