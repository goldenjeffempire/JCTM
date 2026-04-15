import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const BASE = DOMAIN ? `https://${DOMAIN}` : "";

type PrayerRequest = {
  id: number;
  name?: string | null;
  request: string;
  prayCount?: number | null;
  createdAt?: string | null;
  isAnonymous?: boolean | null;
};

function PrayerWallTab({ colors }: { colors: ReturnType<typeof useColors> }) {
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [request, setRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [prayedIds, setPrayedIds] = useState<Set<number>>(new Set());

  const fetchPrayers = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/prayer/requests?limit=30`);
      const d = await r.json();
      setPrayers(d.requests ?? d ?? []);
    } catch { /* network error */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchPrayers(); }, [fetchPrayers]);

  const handlePray = async (id: number) => {
    if (prayedIds.has(id)) return;
    setPrayedIds((prev) => new Set([...prev, id]));
    try {
      await fetch(`${BASE}/api/prayer/requests/${id}/pray`, { method: "POST" });
      setPrayers((prev) =>
        prev.map((p) => p.id === id ? { ...p, prayCount: (p.prayCount ?? 0) + 1 } : p)
      );
    } catch { setPrayedIds((prev) => { const s = new Set(prev); s.delete(id); return s; }); }
  };

  const handleSubmit = async () => {
    if (!request.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${BASE}/api/prayer/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null, request: request.trim(), isAnonymous: !name.trim() }),
      });
      if (r.ok) {
        setName(""); setRequest("");
        fetchPrayers();
      }
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  return (
    <FlatList
      data={prayers}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPrayers(); }} tintColor={colors.accent} />
      }
      ListHeaderComponent={
        <View>
          {/* Submit Form */}
          <View style={[styles.submitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.submitTitle, { color: colors.foreground }]}>Share Your Prayer Need</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Your name (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={[styles.input, styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Share your prayer request with the community..."
              placeholderTextColor={colors.mutedForeground}
              value={request}
              onChangeText={setRequest}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: request.trim() ? 1 : 0.5 }]}
              onPress={handleSubmit}
              disabled={!request.trim() || submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.submitBtnText}>🙏 Submit Prayer Request</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={[styles.wallTitle, { color: colors.foreground }]}>Community Prayer Wall</Text>
          {loading && <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />}
        </View>
      }
      ListEmptyComponent={
        !loading ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 36 }}>🙏</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No prayer requests yet. Be the first to share.
            </Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <View style={[styles.prayerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.prayerHeader}>
            <View style={[styles.avatar, { backgroundColor: colors.accent + "33" }]}>
              <Text style={[styles.avatarText, { color: colors.accent }]}>
                {(item.name ?? "A")[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prayerName, { color: colors.foreground }]}>
                {item.name ?? "Anonymous"}
              </Text>
              {item.createdAt && (
                <Text style={[styles.prayerDate, { color: colors.mutedForeground }]}>
                  {new Date(item.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.prayBtn,
                { backgroundColor: prayedIds.has(item.id) ? colors.accent : colors.muted },
              ]}
              onPress={() => handlePray(item.id)}
            >
              <Text style={styles.prayBtnText}>
                🙏 {item.prayCount ?? 0}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.prayerRequest, { color: colors.foreground }]}>{item.request}</Text>
        </View>
      )}
    />
  );
}

function AIPrayerTab({ colors }: { colors: ReturnType<typeof useColors> }) {
  const [need, setNeed] = useState("");
  const [prayer, setPrayer] = useState("");
  const [generating, setGenerating] = useState(false);

  const generatePrayer = async () => {
    if (!need.trim()) return;
    setGenerating(true);
    setPrayer("");
    try {
      const r = await fetch(`${BASE}/api/prayer/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ need: need.trim() }),
      });
      const text = await r.text();
      // Handle SSE or plain text
      const lines = text.split("\n");
      let result = "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const d = JSON.parse(line.slice(6));
            if (d.prayer) { result = d.prayer; break; }
            if (d.delta) result += d.delta;
            if (d.done) break;
          } catch { result += line.slice(6); }
        }
      }
      setPrayer(result || text.replace(/data:\s*/g, "").trim());
    } catch {
      setPrayer("Unable to generate prayer right now. Please try again or visit jctm.org.ng/prayer.");
    } finally { setGenerating(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.aiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.aiTitle, { color: colors.foreground }]}>✨ AI Prayer Generator</Text>
          <Text style={[styles.aiDesc, { color: colors.mutedForeground }]}>
            Describe your prayer need and receive a Spirit-filled, scripture-anchored prayer crafted by TempleBots.
          </Text>
          <TextInput
            style={[styles.input, styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Describe your prayer need (e.g. healing, breakthrough, guidance)..."
            placeholderTextColor={colors.mutedForeground}
            value={need}
            onChangeText={setNeed}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.accent, opacity: need.trim() ? 1 : 0.5 }]}
            onPress={generatePrayer}
            disabled={!need.trim() || generating}
          >
            {generating ? (
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.submitBtnText}>Generating prayer...</Text>
              </View>
            ) : (
              <Text style={styles.submitBtnText}>🙏 Generate My Prayer</Text>
            )}
          </TouchableOpacity>
        </View>

        {prayer.length > 0 && (
          <View style={[styles.prayerResult, { backgroundColor: colors.primary }]}>
            <Text style={styles.prayerResultLabel}>YOUR PRAYER</Text>
            <Text style={styles.prayerResultText}>{prayer}</Text>
            <TouchableOpacity
              style={styles.fullPrayerBtn}
              onPress={() => Linking.openURL(`${BASE}/prayer`)}
            >
              <Text style={styles.fullPrayerBtnText}>More in Prayer Room →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function PrayerScreen() {
  const colors = useColors();
  const [tab, setTab] = useState<"wall" | "ai">("wall");

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Prayer</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Intercession & AI Prayer Generator
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        {(["wall", "ai"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.tabBtn,
              { backgroundColor: tab === t ? colors.primary : "transparent" },
            ]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabBtnText, { color: tab === t ? "#fff" : colors.mutedForeground }]}>
              {t === "wall" ? "🙏 Prayer Wall" : "✨ AI Prayer"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "wall" ? <PrayerWallTab colors={colors} /> : <AIPrayerTab colors={colors} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 24, fontWeight: "800" },
  headerSub: { fontSize: 12, marginTop: 2 },
  tabBar: {
    flexDirection: "row",
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tabBtn: { flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: "center" },
  tabBtnText: { fontWeight: "700", fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingBottom: 104, gap: 12 },
  submitCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10, marginBottom: 8 },
  submitTitle: { fontSize: 16, fontWeight: "700" },
  input: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 14 },
  inputMulti: { height: 90, textAlignVertical: "top" },
  submitBtn: { borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  wallTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  empty: { alignItems: "center", paddingTop: 40, gap: 8 },
  emptyText: { fontSize: 13, textAlign: "center" },
  prayerCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  prayerHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700" },
  prayerName: { fontSize: 13, fontWeight: "700" },
  prayerDate: { fontSize: 11 },
  prayBtn: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  prayBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  prayerRequest: { fontSize: 14, lineHeight: 21 },
  aiCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  aiTitle: { fontSize: 18, fontWeight: "800" },
  aiDesc: { fontSize: 13, lineHeight: 20 },
  prayerResult: { borderRadius: 16, padding: 18, gap: 10 },
  prayerResultLabel: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  prayerResultText: { color: "#fff", fontSize: 14, lineHeight: 22 },
  fullPrayerBtn: { marginTop: 4 },
  fullPrayerBtnText: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
});
