import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";

// iOS 26+ uses NativeTabs with liquid glass — system appearance only.
// All other platforms use ClassicTabLayout with full brand theming.
function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sermons">
        <Icon sf={{ default: "play.rectangle", selected: "play.rectangle.fill" }} />
        <Label>Sermons</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="give">
        <Icon sf={{ default: "heart", selected: "heart.fill" }} />
        <Label>Give</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="prayer">
        <Icon sf={{ default: "hands.sparkles", selected: "hands.sparkles.fill" }} />
        <Label>Prayer</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="testimonies">
        <Icon sf={{ default: "star", selected: "star.fill" }} />
        <Label>Testimonies</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const tabBarStyle = {
    position: "absolute" as const,
    backgroundColor: isIOS ? "transparent" : colors.background,
    borderTopWidth: isWeb ? StyleSheet.hairlineWidth : 0,
    borderTopColor: colors.border,
    elevation: 0,
    ...(isWeb ? { height: 84 } : {}),
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle,
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="house.fill" tintColor={color} size={size} />
            ) : (
              <Feather name="home" size={size ?? 22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="sermons"
        options={{
          title: "Sermons",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="play.rectangle.fill" tintColor={color} size={size} />
            ) : (
              <Feather name="play-circle" size={size ?? 22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="give"
        options={{
          title: "Give",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="heart.fill" tintColor={color} size={size} />
            ) : (
              <Feather name="heart" size={size ?? 22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="prayer"
        options={{
          title: "Prayer",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="hands.sparkles.fill" tintColor={color} size={size} />
            ) : (
              <Feather name="message-circle" size={size ?? 22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="testimonies"
        options={{
          title: "Testimonies",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="star.fill" tintColor={color} size={size} />
            ) : (
              <Feather name="star" size={size ?? 22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
