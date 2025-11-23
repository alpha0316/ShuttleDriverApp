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

type RegisterScreenNavigationProp = NativeStackNavigationProp<any>;

const Register = ({ navigation }: { navigation: RegisterScreenNavigationProp }) => {
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  type Errors = {
    fullName?: string | null;
    phoneNumber?: string | null;
    password?: string | null;
    confirmPassword?: string | null;
  };
  
  const [errors, setErrors] = useState<Errors>({});

  const BASE_CUSTOMER_URL = "https://shuttle-backend-0.onrender.com";

  // Validation function
  const validateInputs = () => {
    const newErrors: Errors = {};

    // Full name validation
    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (fullName.trim().length < 3) {
      newErrors.fullName = "Full name must be at least 3 characters";
    } else if (!/^[a-zA-Z\s]+$/.test(fullName)) {
      newErrors.fullName = "Full name can only contain letters and spaces";
    }

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

    // Confirm password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    // Validate inputs first
    if (!validateInputs()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${BASE_CUSTOMER_URL}/api/auth/driver/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: fullName.trim(),
            phoneNumber: phoneNumber,
            password: password,
          }),
        }
      );

      // Check content type before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(
          "Server returned an unexpected response. Please try again later."
        );
      }

      const data = await response.json();
      console.log("Registration response:", data);

      if (response.ok) {
        // Store user data and token
        await AsyncStorage.setItem("userData", JSON.stringify(data));

        // Store token separately for easy access
        if (data.token) {
          await AsyncStorage.setItem("authToken", data.token);
        }

        Alert.alert(
          "Success",
          "Registration successful! Welcome to Shuttle Driver App.",
          [
            {
              text: "OK",
              onPress: () => navigation.navigate("DriverBottomNav"),
            },
          ]
        );
      } else {
        // Handle specific error cases
        let errorMessage = "Registration failed. Please try again.";
        
        if (data.message) {
          errorMessage = data.message;
        } else if (response.status === 409) {
          errorMessage = "This phone number is already registered.";
        } else if (response.status === 400) {
          errorMessage = "Invalid registration details. Please check your information.";
        }

        Alert.alert("Registration Failed", errorMessage);
      }
    } catch (error) {
      console.error("Registration error:", error);
      
      let errorMessage = "Unable to connect to the server. Please check your internet connection and try again.";
      
      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as any).message === "string" &&
        !(error as any).message.includes("fetch")
      ) {
        errorMessage = (error as any).message;
      }

      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle full name input
  const handleFullNameChange = (text: React.SetStateAction<string>) => {
    setFullName(text);
    if (errors.fullName) {
      setErrors((prev) => ({ ...prev, fullName: null }));
    }
  };

  // Handle phone number input (only allow digits)
  const handlePhoneNumberChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    setPhoneNumber(cleaned);
    if (errors.phoneNumber) {
      setErrors((prev) => ({ ...prev, phoneNumber: null }));
    }
  };

  // Handle password input
  const handlePasswordChange = (text: React.SetStateAction<string>) => {
    setPassword(text);
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: null }));
    }
    // Also clear confirm password error if passwords now match
    if (confirmPassword && text === confirmPassword && errors.confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: null }));
    }
  };

  // Handle confirm password input
  const handleConfirmPasswordChange = (text: React.SetStateAction<string>) => {
    setConfirmPassword(text);
    if (errors.confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: null }));
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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <Text style={styles.title}>Welcome To The Shuttle Driver App</Text>
            <Text style={styles.subtitle}>Enter Your Details To Register</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {/* Full Name Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={[
                  styles.input,
                  fullName && styles.inputFilled,
                  errors.fullName && styles.inputError,
                ]}
                value={fullName}
                onChangeText={handleFullNameChange}
                placeholder="Enter your full name"
                placeholderTextColor="rgba(0,0,0,0.5)"
                autoCapitalize="words"
                returnKeyType="next"
                editable={!isLoading}
              />
              {errors.fullName && (
                <Text style={styles.errorText}>{errors.fullName}</Text>
              )}
            </View>

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
                placeholder="Enter your phone number"
                placeholderTextColor="rgba(0,0,0,0.5)"
                maxLength={10}
                returnKeyType="next"
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
                  placeholder="Enter password (min 6 characters)"
                  placeholderTextColor="rgba(0,0,0,0.5)"
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                  editable={!isLoading}
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

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[
                    styles.input,
                    styles.passwordInput,
                    confirmPassword && styles.inputFilled,
                    errors.confirmPassword && styles.inputError,
                  ]}
                  value={confirmPassword}
                  onChangeText={handleConfirmPasswordChange}
                  placeholder="Re-enter your password"
                  placeholderTextColor="rgba(0,0,0,0.5)"
                  secureTextEntry={!showConfirmPassword}
                  returnKeyType="done"
                  editable={!isLoading}
                  onSubmitEditing={handleRegister}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                  disabled={isLoading}
                >
                  <Icon
                    name={showConfirmPassword ? "eye-slash" : "eye"}
                    size={20}
                    color="rgba(0,0,0,0.5)"
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            {/* Password Strength Indicator (optional) */}
            {password.length > 0 && (
              <View style={styles.passwordStrengthContainer}>
                <View style={styles.passwordStrengthBar}>
                  <View
                    style={[
                      styles.passwordStrengthFill,
                      password.length >= 8
                        ? styles.strongPassword
                        : password.length >= 6
                        ? styles.mediumPassword
                        : styles.weakPassword,
                      { width: `${Math.min((password.length / 8) * 100, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.passwordStrengthText}>
                  {password.length >= 8
                    ? "Strong password"
                    : password.length >= 6
                    ? "Medium password"
                    : "Weak password"}
                </Text>
              </View>
            )}

            {/* Sign Up Button */}
            <View style={styles.buttonContainer}>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#000" />
                  <Text style={styles.loadingText}>Creating your account...</Text>
                </View>
              ) : (
                <PrimaryButton
                  title="Sign Up"
                  onPress={handleRegister}
                  disabled={isLoading}
                />
              )}
            </View>

            {/* Sign In Link */}
            <View style={styles.signInContainer}>
              <Text style={styles.signInText}>
                Do you already have an account?
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("SignIn")}
                disabled={isLoading}
              >
                <Text style={styles.signInLink}>Sign In</Text>
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
  passwordStrengthContainer: {
    gap: 8,
    marginTop: -8,
  },
  passwordStrengthBar: {
    height: 4,
    backgroundColor: "#E5E5E5",
    borderRadius: 2,
    overflow: "hidden",
  },
  passwordStrengthFill: {
    height: "100%",
    borderRadius: 2,
  },
  weakPassword: {
    backgroundColor: "#FF3B30",
  },
  mediumPassword: {
    backgroundColor: "#FF9500",
  },
  strongPassword: {
    backgroundColor: "#34C759",
  },
  passwordStrengthText: {
    fontSize: 12,
    color: "rgba(0,0,0,0.6)",
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
  signInContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  signInText: {
    fontSize: 16,
    color: "rgba(0,0,0,0.6)",
  },
  signInLink: {
    fontSize: 16,
    color: "#000",
    fontWeight: "700",
  },
});

export default Register;