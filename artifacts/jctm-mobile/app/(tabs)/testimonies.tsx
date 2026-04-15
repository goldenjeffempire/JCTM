import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useListTestimonies, useSubmitTestimony } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const BASE = DOMAIN ? `https://${DOMAIN}` : "";

type Testimony = {
  id: number;
  name: string;
  title?: string | null;
  content: string;
  category?: string | null;
  likeCount: number;
  createdAt: string;
};

const CATEGORIES = ["Healing", "Breakthrough", "Deliverance", "Provision", "Restoration", "Salvation", "Other"];

const CATEGORY_COLORS: Record<string, string> = {
  Healing: "#10B981",
  Breakthrough: "#8B5CF6",
  Deliverance: "#F59E0B",
  Provision: "#3B82F6",
  Restoration: "#EC4899",
  Salvation: "#EF4444",
  Other: "#6B7280",
};

function TestimonyCard({ item, colors, onAmen }: { item: Testimony; colors: ReturnType<typeof useColors>; onAmen: (id: number) => void }) {
  const catColor = CATEGORY_COLORS[item.category ?? "Other"] ?? "#6B7280";
  const date = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
        {item.category && (
          <Text style={[styles.categoryLabel, { color: catColor }]}>{item.category}</Text>
        )}
        {date && <Text style={[styles.dateText, { color: colors.mutedForeground }]}>{date}</Text>}
      </View>
      <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={[styles.cardStory, { color: colors.mutedForeground }]} numberOfLines={4}>
        {item.content}
      </Text>
      <View style={styles.cardFooter}>
        <View style={styles.authorRow}>
          <View style={[styles.avatar, { backgroundColor: colors.accent + "33" }]}>
            <Text style={[styles.avatarText, { color: colors.accent }]}>
              {item.name[0]?.toUpperCase() ?? "✨"}
            </Text>
          </View>
          <Text style={[styles.authorName, { color: colors.mutedForeground }]}>
            {item.name}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.amenBtn, { backgroundColor: colors.accent + "22", borderColor: colors.accent + "44" }]}
          onPress={() => onAmen(item.id)}
          activeOpacity={0.75}
        >
          <Text style={[styles.amenBtnText, { color: colors.accent }]}>
            🙌 Amen · {item.likeCount}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SubmitForm({ colors, onSuccess }: { colors: ReturnType<typeof useColors>; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", title: "", content: "", category: "Other" });
  const { mutateAsync, isPending } = useSubmitTestimony();

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.title.trim() || !form.content.trim()) return;
    try {
      await mutateAsync({ data: { ...form } });
      setForm({ name: "", title: "", content: "", category: "Other" });
      onSuccess();
    } catch { /* ignore */ }
  };

  return (
    <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
      <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.formTitle, { color: colors.foreground }]}>Share Your Miracle</Text>
        <Text style={[styles.formDesc, { color: colors.mutedForeground }]}>
          Your testimony will be reviewed and added to the Testimony Vault after approval.
        </Text>

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Your Name *</Text>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          placeholder="Full name"
          placeholderTextColor={colors.mutedForeground}
          value={form.name}
          onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
        />

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Testimony Title *</Text>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          placeholder="e.g. God healed my daughter"
          placeholderTextColor={colors.mutedForeground}
          value={form.title}
          onChangeText={(t) => setForm((p) => ({ ...p, title: t }))}
        />

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Category *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.catChip,
                  {
                    backgroundColor: form.category === c ? (CATEGORY_COLORS[c] ?? colors.accent) : colors.muted,
                    borderColor: form.category === c ? (CATEGORY_COLORS[c] ?? colors.accent) : colors.border,
                  },
                ]}
                onPress={() => setForm((p) => ({ ...p, category: c }))}
              >
                <Text style={[styles.catChipText, { color: form.category === c ? "#fff" : colors.foreground }]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Your Story *</Text>
        <TextInput
          style={[styles.input, styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          placeholder="Share the full story of what God did..."
          placeholderTextColor={colors.mutedForeground}
          value={form.content}
          onChangeText={(t) => setForm((p) => ({ ...p, content: t }))}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[
            styles.submitBtn,
            {
              backgroundColor: colors.primary,
              opacity: form.name.trim() && form.title.trim() && form.content.trim() ? 1 : 0.5,
            },
          ]}
          onPress={handleSubmit}
          disabled={isPending || !form.name.trim() || !form.title.trim() || !form.content.trim()}
        >
          {isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Testimony ✨</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export default function TestimoniesScreen() {
  const colors = useColors();
  const [tab, setTab] = useState<"vault" | "submit">("vault");
  const [amenedIds, setAmenedIds] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useListTestimonies({ limit: 30 });
  const testimonies = (data as { testimonies?: Testimony[] } | undefined)?.testimonies ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAmen = useCallback(
    async (id: number) => {
      if (amenedIds.has(id)) return;
      setAmenedIds((prev) => new Set([...prev, id]));
      try {
        await fetch(`${BASE}/api/testimonies/${id}/like`, { method: "POST" });
      } catch { setAmenedIds((prev) => { const s = new Set(prev); s.delete(id); return s; }); }
    },
    [amenedIds]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Testimonies</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Miracle stories from the JCTM family
        </Text>
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        {(["vault", "submit"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.tabBtn,
              { backgroundColor: tab === t ? colors.primary : "transparent" },
            ]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabBtnText, { color: tab === t ? "#fff" : colors.mutedForeground }]}>
              {t === "vault" ? "✨ Testimony Vault" : "📝 Share Yours"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "vault" ? (
        isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={testimonies}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
            }
            renderItem={({ item }) => (
              <TestimonyCard item={item} colors={colors} onAmen={handleAmen} />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={{ fontSize: 40 }}>✨</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No testimonies yet. Be the first to share your miracle!
                </Text>
              </View>
            }
          />
        )
      ) : (
        <SubmitForm colors={colors} onSuccess={() => setTab("vault")} />
      )}
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
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  categoryLabel: { fontSize: 11, fontWeight: "700", flex: 1 },
  dateText: { fontSize: 11 },
  cardTitle: { fontSize: 15, fontWeight: "800", lineHeight: 21 },
  cardStory: { fontSize: 13, lineHeight: 20 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "700" },
  authorName: { fontSize: 12 },
  amenBtn: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  amenBtnText: { fontWeight: "700", fontSize: 12 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 21 },
  formCard: { borderRadius: 16, borderWidth: 1, padding: 16, margin: 16, gap: 10 },
  formTitle: { fontSize: 18, fontWeight: "800" },
  formDesc: { fontSize: 13, lineHeight: 20 },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: -4 },
  input: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 14 },
  inputMulti: { height: 130, textAlignVertical: "top" },
  catChip: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  catChipText: { fontSize: 12, fontWeight: "700" },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
