import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import PrimaryButton from "@/components/PrimaryButton";

const BASE_URL = "http://159.223.20.22:5001/api/riders";

const SignIn = ({ navigation }) => {
  const [formData, setFormData] = useState({
    username: "",
    phoneNumber: "",
  });
  const [errors, setErrors] = useState<{ username?: string | null; phoneNumber?: string | null }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState<{ username?: boolean; phoneNumber?: boolean }>({});

  // Validation functions
  const validateUsername = (username: string | any[]) => {
    if (!username) return "Username is required";
    if (username.length < 3) return "Username must be at least 3 characters";
    return null;
  };

  const validatePhoneNumber = (phoneNumber: string) => {
    if (!phoneNumber) return "Phone number is required";
    const ghanaPhoneRegex = /^(\+233|0)[2-5][0-9]{8}$/;
    if (!ghanaPhoneRegex.test(phoneNumber.replace(/\s/g, "")))
      return "Please enter a valid Ghana phone number";
    return null;
  };

  // Handle input change with validation
  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (touched[field]) {
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  };

  // Handle input blur
  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  // Validate individual field
  const validateField = (field: string, value: string) => {
    switch (field) {
      case "username":
        return validateUsername(value);
      case "phoneNumber":
        return validatePhoneNumber(value);
      default:
        return null;
    }
  };

  // Validate all fields
  const validateForm = () => {
    const newErrors = {
      username: validateUsername(formData.username),
      phoneNumber: validatePhoneNumber(formData.phoneNumber),
    };

    setErrors(newErrors);
    setTouched({
      username: true,
      phoneNumber: true,
    });

    return !Object.values(newErrors).some((error) => error !== null);
  };

  // Format phone number to include country code if needed
  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\s/g, "");
    if (cleaned.startsWith("0")) {
      return "+233" + cleaned.substring(1);
    }
    if (!cleaned.startsWith("+")) {
      return "+233" + cleaned;
    }
    return cleaned;
  };

  // Save rider data to AsyncStorage
  const saveRiderData = async (riderData: { _id: string; username: string; }) => {
    try {
      await AsyncStorage.setItem("riderData", JSON.stringify(riderData));
      await AsyncStorage.setItem("riderId", riderData._id);
      await AsyncStorage.setItem("riderUsername", riderData.username);
      console.log("✅ Rider data saved to AsyncStorage");
    } catch (error) {
      console.error("❌ Failed to save rider data:", error);
    }
  };

  // Handle sign in
  const handleSignIn = async () => {
    console.log("🚀 Sign In button clicked");

    // Validate form
    if (!validateForm()) {
      console.log("❌ Validation failed:", errors);
      Alert.alert("Validation Error", "Please fix the errors before continuing");
      return;
    }

    const payload = {
      username: formData.username.trim().toLowerCase(),
      phoneNumber: formatPhoneNumber(formData.phoneNumber),
    };

    console.log("📤 Sending login request:", payload);

    try {
      setIsLoading(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log("📥 Response status:", response.status);

      const data = await response.json();
      console.log("📥 Response data:", data);

      if (!response.ok) {
        console.log("❌ Login failed:", data);

        // Handle specific error cases
        if (response.status === 401) {
          throw new Error("Invalid username or phone number");
        } else if (response.status === 404) {
          throw new Error("Rider account not found. Please register first.");
        } else if (response.status === 400) {
          throw new Error(data.message || "Invalid login credentials");
        } else if (response.status === 500) {
          throw new Error("Server error. Please try again later");
        } else {
          throw new Error(data.message || data.error || "Login failed");
        }
      }

      console.log("✅ Login successful!");

      // Save rider data
      await saveRiderData(data.data);

      // Clear form
      setFormData({
        username: "",
        phoneNumber: "",
      });
      setErrors({});
      setTouched({});

      // Navigate to rider dashboard/home
      Alert.alert(
        "Success",
        `Welcome back, ${data.data.firstName}!`,
        [
          {
            text: "Continue",
            onPress: () => navigation.navigate("HomeDelivery"),
          },
        ]
      );
    } catch (error) {
      console.log("❌ Error during login:", error);

      let errorMessage = "An unexpected error occurred";

      if (error.name === "AbortError") {
        errorMessage = "Request timeout. Please check your internet connection and try again.";
      } else if (error instanceof TypeError && error.message === "Network request failed") {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      Alert.alert("Login Failed", errorMessage, [
        { text: "Try Again", style: "default" },
      ]);
    } finally {
      setIsLoading(false);
      console.log("🏁 Login process completed");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Rider Sign In</Text>
          <Text style={styles.subtitle}>Welcome back! Sign in to continue</Text>
        </View>

        {/* Username */}
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>
            Username <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.username && touched.username && styles.inputError]}
            value={formData.username}
            onChangeText={(value) => handleInputChange("username", value)}
            onBlur={() => handleBlur("username")}
            placeholder="Enter your username"
            placeholderTextColor="rgba(0,0,0,0.4)"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
          {errors.username && touched.username && (
            <Text style={styles.errorText}>{errors.username}</Text>
          )}
        </View>

        {/* Phone Number */}
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>
            Phone Number <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              errors.phoneNumber && touched.phoneNumber && styles.inputError,
            ]}
            value={formData.phoneNumber}
            onChangeText={(value) => handleInputChange("phoneNumber", value)}
            onBlur={() => handleBlur("phoneNumber")}
            placeholder="+233 or 0XXXXXXXXX"
            keyboardType="phone-pad"
            placeholderTextColor="rgba(0,0,0,0.4)"
            editable={!isLoading}
          />
          {errors.phoneNumber && touched.phoneNumber && (
            <Text style={styles.errorText}>{errors.phoneNumber}</Text>
          )}
        </View>

        <PrimaryButton
          title={isLoading ? "Signing In..." : "Sign In"}
          onPress={handleSignIn}
          disabled={isLoading}
          style={styles.submitButton}
        />

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#000" />
            <Text style={styles.loadingText}>Signing you in...</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("RegisterDelivery")}
            disabled={isLoading}
          >
            <Text style={[styles.footerLink, isLoading && styles.disabledLink]}>
              Register
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  scrollContent: {
    padding: 16,
    paddingTop: 30,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    color: "#000",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(0,0,0,0.6)",
    lineHeight: 22,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#000",
  },
  required: {
    color: "#EF4444",
  },
  input: {
    height: 52,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderColor: "rgba(0,0,0,0.15)",
    backgroundColor: "#F9FAFB",
    fontSize: 16,
    color: "#000",
  },
  inputError: {
    borderColor: "#EF4444",
    borderWidth: 1.5,
    backgroundColor: "#FEF2F2",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: "rgba(0,0,0,0.6)",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 32,
  },
  footerText: {
    fontSize: 16,
    color: "rgba(0,0,0,0.6)",
  },
  footerLink: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginLeft: 6,
  },
  disabledLink: {
    opacity: 0.5,
  },
});

export default SignIn;