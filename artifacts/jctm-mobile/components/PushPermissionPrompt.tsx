/**
 * PushPermissionPrompt
 *
 * A bottom-sheet–style card that appears once on the Home screen to ask the
 * user if they want crusade and live-service alerts. It respects the stored
 * permission decision so it shows at most once per install.
 *
 * Rules:
 *  - Only shown when `decision === "undecided"` (i.e. user hasn't been asked yet)
 *  - Tapping "Yes, Notify Me" triggers the OS permission dialog
 *  - Tapping "Not Now" stores "denied" so we never show this again
 */

import React from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { usePushToken } from "@/hooks/usePushToken";
import { useColors } from "@/hooks/useColors";

export function PushPermissionPrompt() {
  const colors   = useColors();
  const { decision, requestPermission, declinePermission } = usePushToken();

  // Only render when user hasn't been asked yet
  if (decision !== "undecided") return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Bell icon */}
      <View style={[styles.iconWrap, { backgroundColor: "#1E40AF22" }]}>
        <Text style={styles.icon}>🔔</Text>
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Get Crusade Alerts
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>
          Be the first to know when the{"\n"}Warri City Crusade goes live — straight to your phone.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: "#1E40AF" }]}
          onPress={requestPermission}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Yes, Notify Me</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={declinePermission}
          activeOpacity={0.7}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.mutedForeground }]}>
            Not Now
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  icon: { fontSize: 22 },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: "800", lineHeight: 19 },
  desc:  { fontSize: 12, lineHeight: 17 },
  actions: { gap: 6, alignItems: "center", flexShrink: 0 },
  primaryBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  secondaryBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
  },
  secondaryBtnText: { fontSize: 11 },
});
