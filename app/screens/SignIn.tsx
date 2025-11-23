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
import Icon from "react-native-vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

type SignInScreenNavigationProp = NativeStackNavigationProp<any>;

const SignIn = ({ navigation }: { navigation: SignInScreenNavigationProp }) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ phoneNumber?: string; password?: string }>({});

  const BASE_CUSTOMER_URL = "https://shuttle-backend-0.onrender.com";

  // Validation function
  const validateInputs = () => {
    const newErrors: { phoneNumber?: string; password?: string } = {};

    // Phone number validation
    if (!phoneNumber) {
      newErrors.phoneNumber = "Phone number is required";
    } else if (phoneNumber.length !== 10) {
      newErrors.phoneNumber = "Phone number must be exactly 10 digits";
    } else if (!/^\d+$/.test(phoneNumber)) {
      newErrors.phoneNumber = "Phone number must contain only digits";
    }

    // Password validation
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    // Validate inputs first
    if (!validateInputs()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${BASE_CUSTOMER_URL}/api/auth/driver/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          password: password,
        }),
      });

      const data = await response.json();
      console.log("Login response:", data);

      if (response.ok) {
        // Store user data and token
        await AsyncStorage.setItem("userData", JSON.stringify(data));
        
        // Store token separately for easy access
        if (data.token) {
          await AsyncStorage.setItem("authToken", data.token);
        }

        Alert.alert("Success", "Login successful!", [
          {
            text: "OK",
            onPress: () => navigation.navigate("DriverBottomNav"),
          },
        ]);
      } else {
        Alert.alert(
          "Login Failed",
          data.message || "Invalid credentials. Please try again."
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert(
        "Error",
        "Unable to connect to the server. Please check your internet connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle phone number input (only allow digits)
  const handlePhoneNumberChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    setPhoneNumber(cleaned);
    // Clear error when user starts typing
    if (errors.phoneNumber) {
      setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
    }
  };

  // Handle password input
  const handlePasswordChange = (text: React.SetStateAction<string>) => {
    setPassword(text);
    // Clear error when user starts typing
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: undefined }));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <Text style={styles.title}>Welcome Back To The Shuttle Driver App</Text>
            <Text style={styles.subtitle}>Enter Your Details To Login</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {/* Phone Number Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={[
                  styles.input,
                  phoneNumber && styles.inputFilled,
                  errors.phoneNumber && styles.inputError,
                ]}
                value={phoneNumber}
                onChangeText={handlePhoneNumberChange}
                keyboardType="phone-pad"
                autoCapitalize="none"
                placeholder="Enter your phone number"
                placeholderTextColor="rgba(0,0,0,0.5)"
                returnKeyType="next"
                maxLength={10}
                editable={!isLoading}
              />
              {errors.phoneNumber && (
                <Text style={styles.errorText}>{errors.phoneNumber}</Text>
              )}
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    password && styles.inputFilled,
                    errors.password && styles.inputError,
                  ]}
                  value={password}
                  onChangeText={handlePasswordChange}
                  autoCapitalize="none"
                  placeholder="Enter password"
                  placeholderTextColor="rgba(0,0,0,0.5)"
                  returnKeyType="done"
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                  onSubmitEditing={handleSignIn}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                  disabled={isLoading}
                >
                  <Icon
                    name={showPassword ? "eye-slash" : "eye"}
                    size={20}
                    color="rgba(0,0,0,0.5)"
                  />
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>

            {/* Sign In Button */}
            <View style={styles.buttonContainer}>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#000" />
                  <Text style={styles.loadingText}>Signing in...</Text>
                </View>
              ) : (
                <PrimaryButton
                  title="Sign In"
                  onPress={handleSignIn}
                  disabled={isLoading}
                />
              )}
            </View>

            {/* Forgot Password Link (optional) */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => navigation.navigate("ForgotPassword")}
              disabled={isLoading}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Are you new here?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Register")}
                disabled={isLoading}
              >
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  headerSection: {
    marginTop: 30,
    marginBottom: 32,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(0,0,0,0.6)",
    marginTop: 4,
  },
  formSection: {
    gap: 16,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  input: {
    height: 50,
    borderColor: "rgba(0, 0, 0, 0.20)",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    fontSize: 16,
  },
  inputFilled: {
    borderColor: "#000",
    backgroundColor: "#fff",
  },
  inputError: {
    borderColor: "#FF3B30",
    backgroundColor: "#FFF5F5",
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: "absolute",
    right: 16,
    top: 15,
    padding: 4,
  },
  errorText: {
    fontSize: 14,
    color: "#FF3B30",
    marginTop: 4,
  },
  buttonContainer: {
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: "rgba(0,0,0,0.6)",
  },
  forgotPassword: {
    alignSelf: "flex-end",
    paddingVertical: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: "rgba(0,0,0,0.7)",
    fontWeight: "600",
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  signUpText: {
    fontSize: 16,
    color: "rgba(0,0,0,1)",
  },
  signUpLink: {
    fontSize: 16,
    color: "#000",
    fontWeight: "700",
  },
});

export default SignIn;