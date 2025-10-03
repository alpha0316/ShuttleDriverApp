import AsyncStorage from "@react-native-async-storage/async-storage";

// AsyncStorage Keys
export const STORAGE_KEYS = {
  RIDER_DATA: "@rider_data",
  RIDER_ID: "@rider_id",
  RIDER_USERNAME: "@rider_username",
  RIDER_PHONE: "@rider_phone",
  RIDER_LOCATION: "@rider_location",
  RIDER_STATUS: "@rider_status",
  IS_LOGGED_IN: "@rider_is_logged_in",
  LOGIN_TIMESTAMP: "@rider_login_timestamp",
};

/**
 * Save rider login data to AsyncStorage
 * @param {Object} riderData - The rider data from login response
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise
 */
export const saveRiderData = async (riderData) => {
  try {
    console.log("💾 Saving rider data to AsyncStorage...");

    // Validate rider data
    if (!riderData || !riderData._id) {
      throw new Error("Invalid rider data provided");
    }

    // Save complete rider object
    await AsyncStorage.setItem(
      STORAGE_KEYS.RIDER_DATA,
      JSON.stringify(riderData)
    );

    // Save individual fields for quick access
    await AsyncStorage.setItem(STORAGE_KEYS.RIDER_ID, riderData._id);
    await AsyncStorage.setItem(STORAGE_KEYS.RIDER_USERNAME, riderData.username || "");
    await AsyncStorage.setItem(STORAGE_KEYS.RIDER_PHONE, riderData.phoneNumber || "");
    await AsyncStorage.setItem(STORAGE_KEYS.RIDER_LOCATION, riderData.location || "");
    await AsyncStorage.setItem(STORAGE_KEYS.RIDER_STATUS, riderData.status || "active");
    await AsyncStorage.setItem(STORAGE_KEYS.IS_LOGGED_IN, "true");
    await AsyncStorage.setItem(
      STORAGE_KEYS.LOGIN_TIMESTAMP,
      new Date().toISOString()
    );

    console.log("✅ Rider data saved successfully!");
    console.log("📦 Saved data:", {
      id: riderData._id,
      username: riderData.username,
      firstName: riderData.firstName,
      lastName: riderData.lastName,
      phoneNumber: riderData.phoneNumber,
      location: riderData.location,
      status: riderData.status,
    });

    return true;
  } catch (error) {
    console.error("❌ Failed to save rider data:", error);
    return false;
  }
};

/**
 * Get complete rider data from AsyncStorage
 * @returns {Promise<Object|null>} - Returns rider data or null if not found
 */
export const getRiderData = async () => {
  try {
    const riderDataString = await AsyncStorage.getItem(STORAGE_KEYS.RIDER_DATA);
    
    if (!riderDataString) {
      console.log("ℹ️ No rider data found in storage");
      return null;
    }

    const riderData = JSON.parse(riderDataString);
    console.log("📦 Retrieved rider data:", riderData);
    return riderData;
  } catch (error) {
    console.error("❌ Failed to retrieve rider data:", error);
    return null;
  }
};

/**
 * Get rider ID from AsyncStorage
 * @returns {Promise<string|null>} - Returns rider ID or null
 */
export const getRiderId = async () => {
  try {
    const riderId = await AsyncStorage.getItem(STORAGE_KEYS.RIDER_ID);
    return riderId;
  } catch (error) {
    console.error("❌ Failed to retrieve rider ID:", error);
    return null;
  }
};

/**
 * Get rider username from AsyncStorage
 * @returns {Promise<string|null>} - Returns username or null
 */
export const getRiderUsername = async () => {
  try {
    const username = await AsyncStorage.getItem(STORAGE_KEYS.RIDER_USERNAME);
    return username;
  } catch (error) {
    console.error("❌ Failed to retrieve username:", error);
    return null;
  }
};

/**
 * Check if rider is logged in
 * @returns {Promise<boolean>} - Returns true if logged in, false otherwise
 */
export const isRiderLoggedIn = async () => {
  try {
    const isLoggedIn = await AsyncStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN);
    return isLoggedIn === "true";
  } catch (error) {
    console.error("❌ Failed to check login status:", error);
    return false;
  }
};

/**
 * Update rider location in AsyncStorage
 * @param {string} location - New location
 * @returns {Promise<boolean>} - Returns true if successful
 */
export const updateRiderLocation = async (location) => {
  try {
    // Update in individual field
    await AsyncStorage.setItem(STORAGE_KEYS.RIDER_LOCATION, location);

    // Update in complete rider data
    const riderData = await getRiderData();
    if (riderData) {
      riderData.location = location;
      await AsyncStorage.setItem(
        STORAGE_KEYS.RIDER_DATA,
        JSON.stringify(riderData)
      );
    }

    console.log("✅ Rider location updated:", location);
    return true;
  } catch (error) {
    console.error("❌ Failed to update location:", error);
    return false;
  }
};

/**
 * Update rider status in AsyncStorage
 * @param {string} status - New status (active/inactive)
 * @returns {Promise<boolean>} - Returns true if successful
 */
export const updateRiderStatus = async (status) => {
  try {
    // Update in individual field
    await AsyncStorage.setItem(STORAGE_KEYS.RIDER_STATUS, status);

    // Update in complete rider data
    const riderData = await getRiderData();
    if (riderData) {
      riderData.status = status;
      await AsyncStorage.setItem(
        STORAGE_KEYS.RIDER_DATA,
        JSON.stringify(riderData)
      );
    }

    console.log("✅ Rider status updated:", status);
    return true;
  } catch (error) {
    console.error("❌ Failed to update status:", error);
    return false;
  }
};

/**
 * Update complete rider data in AsyncStorage
 * @param {Object} updatedData - Updated rider data
 * @returns {Promise<boolean>} - Returns true if successful
 */
export const updateRiderData = async (updatedData) => {
  try {
    const currentData = await getRiderData();
    
    if (!currentData) {
      throw new Error("No existing rider data found");
    }

    const mergedData = { ...currentData, ...updatedData };
    
    // Save updated complete data
    await AsyncStorage.setItem(
      STORAGE_KEYS.RIDER_DATA,
      JSON.stringify(mergedData)
    );

    // Update individual fields if they exist in updatedData
    if (updatedData.username) {
      await AsyncStorage.setItem(STORAGE_KEYS.RIDER_USERNAME, updatedData.username);
    }
    if (updatedData.phoneNumber) {
      await AsyncStorage.setItem(STORAGE_KEYS.RIDER_PHONE, updatedData.phoneNumber);
    }
    if (updatedData.location) {
      await AsyncStorage.setItem(STORAGE_KEYS.RIDER_LOCATION, updatedData.location);
    }
    if (updatedData.status) {
      await AsyncStorage.setItem(STORAGE_KEYS.RIDER_STATUS, updatedData.status);
    }

    console.log("✅ Rider data updated successfully!");
    return true;
  } catch (error) {
    console.error("❌ Failed to update rider data:", error);
    return false;
  }
};

/**
 * Clear all rider data from AsyncStorage (logout)
 * @returns {Promise<boolean>} - Returns true if successful
 */
export const clearRiderData = async () => {
  try {
    console.log("🗑️ Clearing rider data from AsyncStorage...");

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.RIDER_DATA,
      STORAGE_KEYS.RIDER_ID,
      STORAGE_KEYS.RIDER_USERNAME,
      STORAGE_KEYS.RIDER_PHONE,
      STORAGE_KEYS.RIDER_LOCATION,
      STORAGE_KEYS.RIDER_STATUS,
      STORAGE_KEYS.IS_LOGGED_IN,
      STORAGE_KEYS.LOGIN_TIMESTAMP,
    ]);

    console.log("✅ Rider data cleared successfully!");
    return true;
  } catch (error) {
    console.error("❌ Failed to clear rider data:", error);
    return false;
  }
};

/**
 * Get login timestamp
 * @returns {Promise<string|null>} - Returns ISO timestamp or null
 */
export const getLoginTimestamp = async () => {
  try {
    const timestamp = await AsyncStorage.getItem(STORAGE_KEYS.LOGIN_TIMESTAMP);
    return timestamp;
  } catch (error) {
    console.error("❌ Failed to retrieve login timestamp:", error);
    return null;
  }
};

/**
 * Check if login session is still valid (optional: implement session expiry)
 * @param {number} maxAgeInHours - Maximum age of session in hours (default: 24)
 * @returns {Promise<boolean>} - Returns true if session is valid
 */
export const isSessionValid = async (maxAgeInHours = 24) => {
  try {
    const isLoggedIn = await isRiderLoggedIn();
    if (!isLoggedIn) return false;

    const timestamp = await getLoginTimestamp();
    if (!timestamp) return false;

    const loginTime = new Date(timestamp);
    const now = new Date();
    const hoursSinceLogin = (now - loginTime) / (1000 * 60 * 60);

    const isValid = hoursSinceLogin < maxAgeInHours;
    
    if (!isValid) {
      console.log("⚠️ Session expired. Please login again.");
      await clearRiderData();
    }

    return isValid;
  } catch (error) {
    console.error("❌ Failed to check session validity:", error);
    return false;
  }
};

/**
 * Get all stored rider data (for debugging)
 * @returns {Promise<Object>} - Returns all stored data
 */
export const getAllStoredData = async () => {
  try {
    const keys = Object.values(STORAGE_KEYS);
    const values = await AsyncStorage.multiGet(keys);
    
    const data = {};
    values.forEach(([key, value]) => {
      data[key] = value;
    });
    
    console.log("📦 All stored rider data:", data);
    return data;
  } catch (error) {
    console.error("❌ Failed to get all stored data:", error);
    return {};
  }
};