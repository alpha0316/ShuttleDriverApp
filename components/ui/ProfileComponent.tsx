import { Image } from "expo-image";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

const ProfileComponent = () => {
  const [profileImage, setProfileImage] = useState("");
  const fetchDiceBearNotionists = async () => {
    const response = await fetch(
      "https://api.dicebear.com/7.x/notionists/svg?seed=123"
    );
    const data = await response.json();
    setProfileImage(data);
  };
  fetchDiceBearNotionists();
  return (
    <View style={styles.profileContainer}>
      <Image
        source={{
          uri: "https://api.dicebear.com/7.x/notionists/svg?seed=123",
        }}
        style={styles.profileImage}
      />
      <View style={styles.profileTextContainer}>
        <Text style={styles.profileText}>Oi Mandem</Text>
        <Text style={styles.profileSubText}>Tap to view app settings</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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

export default ProfileComponent;
