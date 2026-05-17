import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const BACKGROUND_LOCATION_TASK = "shuttle-driver-background-location";

const BASE_URL = "https://shuttle-backend-0.onrender.com";

let isTaskDefined = false;

export function defineBackgroundLocationTask() {
  if (isTaskDefined) return;
  isTaskDefined = true;

  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.error("Background location task error:", error);
      return;
    }
    if (!data) return;

    const typedData = data as { locations?: Location.LocationObject[] };
    if (!typedData.locations || typedData.locations.length === 0) return;

    const lastLocation = typedData.locations[typedData.locations.length - 1];

    try {
      const userDataString = await AsyncStorage.getItem("userData");
      if (!userDataString) return;

      const userData = JSON.parse(userDataString);
      const driverID = userData.driver?.id;
      if (!driverID) return;

      const payload = {
        driverID,
        latitude: lastLocation.coords.latitude,
        longitude: lastLocation.coords.longitude,
        heading: lastLocation.coords.heading || 0,
        speed: lastLocation.coords.speed || 0,
        accuracy: lastLocation.coords.accuracy || 0,
        altitude: lastLocation.coords.altitude || 0,
        timestamp: lastLocation.timestamp,
        source: "background",
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      await fetch(`${BASE_URL}/api/drivers/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Background location send failed:", err.message);
      }
    }
  });
}

export async function requestBackgroundPermissions() {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== "granted") {
    console.warn("Background location permission not granted");
    return false;
  }
  return true;
}

export async function startBackgroundLocationUpdates() {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(
    BACKGROUND_LOCATION_TASK
  );
  if (hasStarted) {
    console.log("Background location updates already running");
    return true;
  }

  defineBackgroundLocationTask();

  const permissionGranted = await requestBackgroundPermissions();
  if (!permissionGranted) return false;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 10,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "ShuttleDriverApp",
      notificationBody: "Location tracking is active in the background",
      notificationColor: "#34A853",
    },
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
  });

  console.log("Background location updates started");
  return true;
}

export async function stopBackgroundLocationUpdates() {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(
    BACKGROUND_LOCATION_TASK
  );
  if (!hasStarted) return;

  await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  console.log("Background location updates stopped");
}
