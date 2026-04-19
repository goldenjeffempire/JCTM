import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useListSermons, useGetLivestreamStatus } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const BASE = DOMAIN ? `https://${DOMAIN}` : "";

async function openVideo(videoId?: string | null, fallbackUrl?: string | null) {
  if (videoId) {
    const appUrl = `youtube://watch?v=${videoId}`;
    const webUrl = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      if (await Linking.canOpenURL(appUrl)) {
        await Linking.openURL(appUrl);
        return;
      }
    } catch {
      undefined;
    }
    await Linking.openURL(webUrl);
    return;
  }
  await Linking.openURL(fallbackUrl || `${BASE}/sermons`);
}

type Sermon = {
  id: number;
  title: string;
  youtubeVideoId?: string | null;
  thumbnailUrl?: string | null;
  viewCount?: number | null;
  publishedAt?: string | null;
  duration?: string | null;
  category?: string | null;
};

function SermonRow({ sermon, colors }: { sermon: Sermon; colors: ReturnType<typeof useColors> }) {
  const thumb =
    sermon.thumbnailUrl ??
    (sermon.youtubeVideoId
      ? `https://img.youtube.com/vi/${sermon.youtubeVideoId}/mqdefault.jpg`
      : null);
  const url = sermon.youtubeVideoId
    ? `https://www.youtube.com/watch?v=${sermon.youtubeVideoId}`
    : `${BASE}/sermons/${sermon.id}`;

  const date = sermon.publishedAt
    ? new Date(sermon.publishedAt).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => openVideo(sermon.youtubeVideoId, url)}
      activeOpacity={0.8}
    >
      {thumb ? (
        <View style={styles.thumbWrap}>
          <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
          <View style={styles.thumbPlayOverlay}>
            <Text style={styles.thumbPlay}>▶</Text>
          </View>
          {sermon.duration && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{sermon.duration}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.thumbWrap, { backgroundColor: colors.muted }]}>
          <Text style={{ fontSize: 28 }}>📺</Text>
        </View>
      )}
      <View style={styles.rowMeta}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={2}>
          {sermon.title}
        </Text>
        <View style={styles.rowSubRow}>
          {date && (
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{date}</Text>
          )}
          {sermon.viewCount != null && (
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
              {" · "}{sermon.viewCount.toLocaleString()} views
            </Text>
          )}
        </View>
        {sermon.category && (
          <View style={[styles.categoryBadge, { backgroundColor: colors.accent + "22", borderColor: colors.accent + "44" }]}>
            <Text style={[styles.categoryText, { color: colors.accent }]}>{sermon.category}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function SermonsScreen() {
  const colors = useColors();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const { data, isLoading, isFetching } = useListSermons(
    { search: search || undefined, offset, limit: LIMIT },
  );

  const { data: liveData } = useGetLivestreamStatus({ query: { refetchInterval: 30_000, staleTime: 15_000 } });
  const liveStatus = liveData as {
    isLive?: boolean;
    title?: string | null;
    videoId?: string | null;
    rebroadcast?: { available?: boolean; videoId?: string | null; title?: string | null; mode?: string };
  } | undefined;
  const isLive = liveStatus?.isLive ?? false;
  const isRebroadcast = !isLive && (liveStatus?.rebroadcast?.available ?? false);

  const sermons = (data as { sermons?: Sermon[] } | undefined)?.sermons ?? [];
  const total = (data as { total?: number } | undefined)?.total ?? 0;
  const hasMore = offset + LIMIT < total;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Sermons</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {total > 0 ? `${total} teachings` : "Temple TV Library"}
        </Text>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Text style={{ fontSize: 16 }}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search sermons..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={(t) => { setSearch(t); setOffset(0); }}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(""); setOffset(0); }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Live / Rebroadcast banner */}
      {(isLive || isRebroadcast) && (
        <TouchableOpacity
          onPress={() => openVideo(isLive ? liveStatus?.videoId : liveStatus?.rebroadcast?.videoId, `${BASE}/sermons`)}
          activeOpacity={0.85}
          style={{
            marginHorizontal: 16,
            marginBottom: 8,
            borderRadius: 12,
            backgroundColor: isLive ? "#E53E3E" : liveStatus?.rebroadcast?.mode === "scheduled" ? "#D97706" : "#4F46E5",
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 10,
            gap: 8,
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff", opacity: 0.9 }} />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, flex: 1 }} numberOfLines={1}>
            {isLive
              ? `🔴 Live — ${liveStatus?.title ?? "Holy Spirit Sunday Service"}`
              : `📺 ${liveStatus?.rebroadcast?.mode === "scheduled" ? "Rebroadcast" : "Now Playing"} — ${liveStatus?.rebroadcast?.title ?? "Temple TV"}`}
          </Text>
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 12, opacity: 0.85 }}>
            {isLive ? "Watch →" : "View →"}
          </Text>
        </TouchableOpacity>
      )}

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loaderText, { color: colors.mutedForeground }]}>
            Loading sermons...
          </Text>
        </View>
      ) : (
        <FlatList
          data={sermons}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <SermonRow sermon={item} colors={colors} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📭</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {search ? `No sermons found for "${search}"` : "No sermons yet"}
              </Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={[styles.loadMore, { backgroundColor: colors.primary }]}
                onPress={() => setOffset((o) => o + LIMIT)}
                disabled={isFetching}
              >
                {isFetching ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loadMoreText}>Load More</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
        />
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 15 },
  list: { paddingHorizontal: 16, paddingBottom: 104, gap: 10 },
  row: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    gap: 12,
  },
  thumbWrap: {
    width: 120,
    aspectRatio: 16 / 9,
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: { width: "100%", height: "100%" },
  thumbPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  thumbPlay: { color: "#fff", fontSize: 18 },
  durationBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durationText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  rowMeta: { flex: 1, paddingVertical: 10, paddingRight: 12, justifyContent: "center", gap: 4 },
  rowTitle: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  rowSubRow: { flexDirection: "row", flexWrap: "wrap" },
  rowSub: { fontSize: 11 },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
  },
  categoryText: { fontSize: 10, fontWeight: "700" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loaderText: { fontSize: 14 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 14, textAlign: "center" },
  loadMore: {
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  loadMoreText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
