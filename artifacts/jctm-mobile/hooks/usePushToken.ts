/**
 * usePushToken
 *
 * Requests Expo push notification permission and registers the device token
 * with the JCTM API backend so the server can send crusade + service alerts.
 *
 * Flow:
 *  1. On first render, check if permission has already been decided (AsyncStorage).
 *  2. If undecided, surface a UI prompt (see PushPermissionPrompt component).
 *  3. If user accepts: request OS permission → get Expo push token → POST to API.
 *  4. If user declines: store the decision so we never ask again this install.
 *
 * Works on physical devices only. Expo Go on simulators returns no token.
 */

import { useCallback, useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const BASE   = DOMAIN ? `https://${DOMAIN}` : "";

const STORAGE_KEY = "jctm_push_decision";  // "granted" | "denied"
const TOKEN_KEY   = "jctm_push_token";

export type PushDecision = "undecided" | "granted" | "denied";

export interface PushTokenState {
  /** Current permission decision — drives whether the prompt shows */
  decision: PushDecision;
  /** Whether the token has been successfully registered with the server */
  registered: boolean;
  /** Request OS permission + register token */
  requestPermission: () => Promise<void>;
  /** User explicitly declined — store so we never prompt again */
  declinePermission: () => void;
}

// Configure how notifications behave when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushToken(): PushTokenState {
  const [decision, setDecision] = useState<PushDecision>("undecided");
  const [registered, setRegistered] = useState(false);

  // Load stored decision on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "granted" || stored === "denied") {
        setDecision(stored);
      }
    });
    AsyncStorage.getItem(TOKEN_KEY).then((t) => {
      if (t) setRegistered(true);
    });
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      // Push tokens only work on physical devices
      if (!Device.isDevice) {
        setDecision("denied");
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        await AsyncStorage.setItem(STORAGE_KEY, "denied");
        setDecision("denied");
        return;
      }

      // Android requires a notification channel
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("jctm-alerts", {
          name: "JCTM Service & Crusade Alerts",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#1E40AF",
          sound: "default",
        });
      }

      // Get the Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;

      // Register with our backend
      if (BASE) {
        await fetch(`${BASE}/api/push/expo-register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            platform: Platform.OS,
            deviceId: Device.deviceName ?? undefined,
          }),
        });
      }

      await AsyncStorage.setItem(STORAGE_KEY, "granted");
      await AsyncStorage.setItem(TOKEN_KEY, token);
      setDecision("granted");
      setRegistered(true);
    } catch {
      // Fail silently — push notifications are a bonus, not required
    }
  }, []);

  const declinePermission = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "denied");
    setDecision("denied");
  }, []);

  return { decision, registered, requestPermission, declinePermission };
}
