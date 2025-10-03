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
import PrimaryButton from "@/components/PrimaryButton";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "http://159.223.20.22:5001/api/riders";

import type { StackNavigationProp } from "@react-navigation/stack";

type RegisterProps = {
  navigation: StackNavigationProp<any>;
};

const Register = ({ navigation }: RegisterProps) => {
  const [formData, setFormData] = useState({
    username: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    location: "",
  });
  type FieldNames = "username" | "firstName" | "lastName" | "phoneNumber" | "location";
  type ErrorsType = Partial<Record<FieldNames, string | null>>;
  type TouchedType = Partial<Record<FieldNames, boolean>>;

  const [errors, setErrors] = useState<ErrorsType>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState<TouchedType>({});

  // Input validation functions
  const validateUsername = (username: string) => {
    if (!username) return "Username is required";
    if (username.length < 3) return "Username must be at least 3 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(username))
      return "Username can only contain letters, numbers, and underscores";
    return null;
  };

  const validateFirstName = (firstName: string) => {
    if (!firstName) return "First name is required";
    if (firstName.trim().length < 2) return "Please enter a valid first name";
    if (!/^[a-zA-Z\s]+$/.test(firstName))
      return "First name can only contain letters";
    return null;
  };

  const validateLastName = (lastName: string) => {
    if (!lastName) return "Last name is required";
    if (lastName.trim().length < 2) return "Please enter a valid last name";
    if (!/^[a-zA-Z\s]+$/.test(lastName))
      return "Last name can only contain letters";
    return null;
  };

  const validatePhoneNumber = (phoneNumber: string) => {
    if (!phoneNumber) return "Phone number is required";
    // Ghana phone number format: +233XXXXXXXXX or 0XXXXXXXXX
    const ghanaPhoneRegex = /^(\+233|0)[2-5][0-9]{8}$/;
    if (!ghanaPhoneRegex.test(phoneNumber.replace(/\s/g, "")))
      return "Please enter a valid Ghana phone number";
    return null;
  };

  const validateLocation = (location: string) => {
    if (!location) return "Location is required";
    if (location.trim().length < 2) return "Please enter a valid location";
    return null;
  };

  // Handle input change with validation
  const handleInputChange = (field: FieldNames, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Real-time validation for touched fields
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  };

  // Handle input blur
  const handleBlur = (field: FieldNames) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  // Validate individual field
  const validateField = (field: FieldNames, value: string) => {
    switch (field) {
      case "username":
        return validateUsername(value);
      case "firstName":
        return validateFirstName(value);
      case "lastName":
        return validateLastName(value);
      case "phoneNumber":
        return validatePhoneNumber(value);
      case "location":
        return validateLocation(value);
      default:
        return null;
    }
  };

  // Validate all fields
  const validateForm = () => {
    const newErrors = {
      username: validateUsername(formData.username),
      firstName: validateFirstName(formData.firstName),
      lastName: validateLastName(formData.lastName),
      phoneNumber: validatePhoneNumber(formData.phoneNumber),
      location: validateLocation(formData.location),
    };

    setErrors(newErrors);
    setTouched({
      username: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      location: true,
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

  // Handle registration
  const handleRegister = async () => {
    console.log("🚀 Register button clicked");

    // Validate form
    if (!validateForm()) {
      console.log("❌ Validation failed:", errors);
      Alert.alert("Validation Error", "Please fix the errors before continuing");
      return;
    }

    // FIXED: Send firstName and lastName separately (not as fullName)
    const payload = {
      username: formData.username.trim().toLowerCase(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      phoneNumber: formatPhoneNumber(formData.phoneNumber),
      location: formData.location.trim(),
    };

    console.log("📤 Sending registration request:", payload);

    try {
      setIsLoading(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(`${BASE_URL}/signup`, {
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
        console.log("❌ Registration failed:", data);

        // Handle specific error cases
        if (response.status === 409) {
          throw new Error("Username or phone number already exists");
        } else if (response.status === 400) {
          throw new Error(data.message || "Invalid registration data");
        } else if (response.status === 500) {
          throw new Error("Server error. Please try again later");
        } else {
          throw new Error(data.message || data.error || "Registration failed");
        }
      }

      console.log("✅ Registration successful!");
      

      // Clear form
      setFormData({
        username: "",
        firstName: "",
        lastName: "",
        phoneNumber: "",
        location: "",
      });
      setErrors({});
      setTouched({});

     // ✅ Save Rider Data properly
      await AsyncStorage.setItem("riderData", JSON.stringify({
        userId: data?.id || Date.now().toString(), // fallback if no id in response
        username: payload.username,
        fullName: `${formData.firstName} ${formData.lastName}`,
        phoneNumber: payload.phoneNumber,
        location: payload.location,
      }));
      console.log("✅ Rider data saved to AsyncStorage");


      Alert.alert(
        "Success",
        "Rider account created successfully! Please sign in to continue.",
        [
          {
            text: "Sign In",
            onPress: () => navigation.navigate("HomeDelivery"),
          },
        ]
      );
    } catch (error) {
      console.log("❌ Error during registration:", error);

      let errorMessage = "An unexpected error occurred";

      if (error.name === "AbortError") {
        errorMessage =
          "Request timeout. Please check your internet connection and try again.";
      } else if (
        error instanceof TypeError &&
        error.message === "Network request failed"
      ) {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      Alert.alert("Registration Failed", errorMessage, [
        { text: "Try Again", style: "default" },
      ]);
    } finally {
      setIsLoading(false);
      console.log("🏁 Registration process completed");
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
          <Text style={styles.title}>Register As A Rider</Text>
          <Text style={styles.subtitle}>Enter your details to continue</Text>
        </View>

        {/* Username */}
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>
            Username <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              errors.username && touched.username && styles.inputError,
            ]}
            value={formData.username}
            onChangeText={(value) => handleInputChange("username", value)}
            onBlur={() => handleBlur("username")}
            placeholder="Enter username"
            placeholderTextColor="rgba(0,0,0,0.4)"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
          {errors.username && touched.username && (
            <Text style={styles.errorText}>{errors.username}</Text>
          )}
        </View>

        {/* First Name */}
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>
            First Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              errors.firstName && touched.firstName && styles.inputError,
            ]}
            value={formData.firstName}
            onChangeText={(value) => handleInputChange("firstName", value)}
            onBlur={() => handleBlur("firstName")}
            placeholder="Enter your first name"
            placeholderTextColor="rgba(0,0,0,0.4)"
            autoCapitalize="words"
            editable={!isLoading}
          />
          {errors.firstName && touched.firstName && (
            <Text style={styles.errorText}>{errors.firstName}</Text>
          )}
        </View>

        {/* Last Name */}
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>
            Last Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              errors.lastName && touched.lastName && styles.inputError,
            ]}
            value={formData.lastName}
            onChangeText={(value) => handleInputChange("lastName", value)}
            onBlur={() => handleBlur("lastName")}
            placeholder="Enter your last name"
            placeholderTextColor="rgba(0,0,0,0.4)"
            autoCapitalize="words"
            editable={!isLoading}
          />
          {errors.lastName && touched.lastName && (
            <Text style={styles.errorText}>{errors.lastName}</Text>
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

        {/* Location */}
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>
            Location <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              errors.location && touched.location && styles.inputError,
            ]}
            value={formData.location}
            onChangeText={(value) => handleInputChange("location", value)}
            onBlur={() => handleBlur("location")}
            placeholder="Enter location (e.g., Accra)"
            placeholderTextColor="rgba(0,0,0,0.4)"
            autoCapitalize="words"
            editable={!isLoading}
          />
          {errors.location && touched.location && (
            <Text style={styles.errorText}>{errors.location}</Text>
          )}
        </View>

        <PrimaryButton
          title={isLoading ? "Signing Up..." : "Sign Up"}
          onPress={handleRegister}
          disabled={isLoading}
          style={styles.submitButton}
        />

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#000" />
            <Text style={styles.loadingText}>Creating your account...</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("SignInDelivery")}
            disabled={isLoading}
          >
            <Text
              style={[styles.footerLink, isLoading && styles.disabledLink]}
            >
              Sign In
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
    marginBottom: 24,
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

export default Register;