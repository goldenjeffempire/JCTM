import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGetFeaturedSermon, useGetLivestreamStatus } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useCrusadeCountdown } from "@/hooks/useCrusadeCountdown";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";

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

function LiveBanner({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { data } = useGetLivestreamStatus({ query: { refetchInterval: 30_000, staleTime: 15_000 } });
  // The status endpoint now returns the full SSE-equivalent payload including rebroadcast data
  const status = data as {
    isLive?: boolean;
    title?: string | null;
    videoId?: string | null;
    streamUrl?: string | null;
    rebroadcast?: { available?: boolean; videoId?: string | null; title?: string | null; mode?: string };
  } | undefined;

  const isLive = status?.isLive ?? false;
  const isRebroadcast = !isLive && (status?.rebroadcast?.available ?? false);

  if (!isLive && !isRebroadcast) return null;

  const bannerText = isLive
    ? `🔴 ${status?.title ?? "Holy Spirit Sunday Service — Live"}`
    : `📺 ${status?.rebroadcast?.mode === "scheduled" ? "Rebroadcast" : "Temple TV"} — ${status?.rebroadcast?.title ?? "Now Playing"}`;
  const liveUrl = status?.videoId
    ? `https://www.youtube.com/watch?v=${status.videoId}`
    : status?.streamUrl ?? `${BASE}/sermons`;
  const rebroadcastUrl = status?.rebroadcast?.videoId
    ? `https://www.youtube.com/watch?v=${status.rebroadcast.videoId}`
    : `${BASE}/sermons`;

  return (
    <TouchableOpacity
      style={[
        styles.liveBanner,
        { backgroundColor: isLive ? "#E53E3E" : isRebroadcast && status?.rebroadcast?.mode === "scheduled" ? "#D97706" : "#4F46E5" },
      ]}
      onPress={() => openVideo(isLive ? status?.videoId : status?.rebroadcast?.videoId, isLive ? liveUrl : rebroadcastUrl)}
      activeOpacity={0.85}
    >
      <View style={[styles.liveDot, { backgroundColor: isLive ? "#fff" : "#fff" }]} />
      <Text style={styles.liveBannerText} numberOfLines={1}>{bannerText}</Text>
      <Text style={styles.liveBannerSub}>{isLive ? "Watch Live →" : "Watch →"}</Text>
    </TouchableOpacity>
  );
}

type Sermon = {
  id: number;
  title: string;
  youtubeVideoId?: string | null;
  thumbnailUrl?: string | null;
  viewCount?: number | null;
};

function FeaturedCard({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { data, isLoading } = useGetFeaturedSermon();
  const sermon = data as Sermon | undefined;

  if (isLoading) {
    return (
      <View style={[styles.featuredSkeleton, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!sermon) return null;

  const thumb =
    sermon.thumbnailUrl ??
    `https://img.youtube.com/vi/${sermon.youtubeVideoId}/hqdefault.jpg`;
  const url = sermon.youtubeVideoId
    ? `https://www.youtube.com/watch?v=${sermon.youtubeVideoId}`
    : `${BASE}/sermons/${sermon.id}`;

  return (
    <View style={[styles.featuredCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>FEATURED SERMON</Text>
      <TouchableOpacity onPress={() => openVideo(sermon.youtubeVideoId, url)} activeOpacity={0.85}>
        <Image source={{ uri: thumb }} style={styles.featuredThumb} resizeMode="cover" />
        <View style={styles.playOverlay}>
          <View style={styles.playBtn}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
        </View>
      </TouchableOpacity>
      <View style={{ padding: 14 }}>
        <Text style={[styles.featuredTitle, { color: colors.foreground }]} numberOfLines={2}>
          {sermon.title}
        </Text>
        {sermon.viewCount != null && (
          <Text style={[styles.featuredSub, { color: colors.mutedForeground }]}>
            {sermon.viewCount.toLocaleString()} views
          </Text>
        )}
      </View>
    </View>
  );
}

type Devotion = {
  title?: string;
  scripture?: string;
  reference?: string;
  declaration?: string;
};

function DevotionCard({ colors }: { colors: ReturnType<typeof useColors> }) {
  const [devotion, setDevotion] = useState<Devotion | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/devotion/daily`)
      .then((r) => r.json())
      .then((data: { devotion?: Devotion }) => {
        if (data?.devotion) setDevotion(data.devotion);
      })
      .catch(() => {});
  }, []);

  if (!devotion) return null;

  return (
    <View style={[styles.devotionCard, { backgroundColor: colors.primary }]}>
      <Text style={styles.devotionLabel}>TODAY'S DEVOTION</Text>
      {devotion.title && (
        <Text style={styles.devotionTitle} numberOfLines={2}>{devotion.title}</Text>
      )}
      {devotion.scripture && (
        <Text style={styles.devotionVerse} numberOfLines={3}>"{devotion.scripture}"</Text>
      )}
      {devotion.reference && (
        <Text style={styles.devotionRef}>— {devotion.reference}</Text>
      )}
      {devotion.declaration && (
        <Text style={[styles.devotionDeclaration]} numberOfLines={2}>
          ✦ {devotion.declaration}
        </Text>
      )}
      <TouchableOpacity
        style={styles.devotionReadBtn}
        onPress={() => Linking.openURL(`${BASE}/devotion`)}
        activeOpacity={0.85}
      >
        <Text style={[styles.devotionReadBtnText, { color: colors.primary }]}>
          Read Full Devotion
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const QUICK_ACTIONS = [
  { icon: "📺", label: "Sermons", href: "/sermons" },
  { icon: "🙏", label: "Prayer", href: "/prayer" },
  { icon: "💝", label: "Give", href: "/give" },
  { icon: "✨", label: "Stories", href: "/testimonies" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function CrusadeBanner({ colors }: { colors: ReturnType<typeof useColors> }) {
  const cd = useCrusadeCountdown();
  const isEnded = cd.phase === "ended";
  const isLive  = cd.phase === "live";

  const badgeText = isEnded ? "GLORY!" : isLive ? "LIVE" : "UPCOMING EVENT";
  const badgeColor = isEnded ? "#10B981" : isLive ? "#E53E3E" : "#F6C90E";

  return (
    <TouchableOpacity
      style={styles.crusadeBanner}
      onPress={() => Linking.openURL(`${BASE}/crusade`)}
      activeOpacity={0.88}
    >
      <Image
        source={{ uri: `${BASE}/warri-crusade-flyer2.jpeg` }}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <View style={styles.crusadeOverlay} />
      <View style={styles.crusadeContent}>
        <Text style={[styles.crusadeBadge, { color: badgeColor }]}>{badgeText}</Text>
        <Text style={styles.crusadeTitle}>Warri City Crusade 2026</Text>
        <Text style={styles.crusadeSub}>Apr 30 – May 1 • Warri, Delta State</Text>

        {/* Live countdown clock */}
        {!isEnded && (
          <View style={styles.countdownRow}>
            {isLive ? (
              <View style={styles.countdownLiveWrap}>
                <View style={[styles.countdownLiveDot, { backgroundColor: "#E53E3E" }]} />
                <Text style={styles.countdownLiveText}>
                  Ends in {pad(cd.hours)}:{pad(cd.minutes)}:{pad(cd.seconds)}
                </Text>
              </View>
            ) : (
              <>
                {cd.days > 0 && (
                  <View style={styles.countdownUnit}>
                    <Text style={styles.countdownNum}>{pad(cd.days)}</Text>
                    <Text style={styles.countdownLabel}>DAYS</Text>
                  </View>
                )}
                <View style={styles.countdownUnit}>
                  <Text style={styles.countdownNum}>{pad(cd.hours)}</Text>
                  <Text style={styles.countdownLabel}>HRS</Text>
                </View>
                <View style={styles.countdownUnit}>
                  <Text style={styles.countdownNum}>{pad(cd.minutes)}</Text>
                  <Text style={styles.countdownLabel}>MIN</Text>
                </View>
                <View style={styles.countdownUnit}>
                  <Text style={styles.countdownNum}>{pad(cd.seconds)}</Text>
                  <Text style={styles.countdownLabel}>SEC</Text>
                </View>
              </>
            )}
          </View>
        )}

        <View style={[styles.crusadeRegBtn, { backgroundColor: isLive ? "#E53E3E" : "#F6C90E" }]}>
          <Text style={styles.crusadeRegText}>
            {isEnded ? "Watch Replay →" : isLive ? "Watch Live →" : "Register Free →"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerMinistry, { color: colors.foreground }]}>JCTM</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              Jesus Christ Temple Ministry
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.prayNowBtn, { backgroundColor: colors.accent }]}
            onPress={() => Linking.openURL(`${BASE}/prayer`)}
          >
            <Text style={styles.prayNowText}>Pray Now</Text>
          </TouchableOpacity>
        </View>

        <LiveBanner colors={colors} />
        <PushPermissionPrompt />

        {/* Quick Actions */}
        <View style={styles.quickRow}>
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={[styles.quickItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => Linking.openURL(`${BASE}${a.href}`)}
              activeOpacity={0.75}
            >
              <Text style={styles.quickIcon}>{a.icon}</Text>
              <Text style={[styles.quickLabel, { color: colors.foreground }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FeaturedCard colors={colors} />
        <DevotionCard colors={colors} />
        <CrusadeBanner colors={colors} />

        <TouchableOpacity
          style={styles.webLink}
          onPress={() => Linking.openURL(`${BASE}`)}
        >
          <Text style={[styles.webLinkText, { color: colors.mutedForeground }]}>
            jctm.org.ng — Full Website →
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 104 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerMinistry: { fontSize: 26, fontWeight: "900", letterSpacing: 1.5 },
  headerSub: { fontSize: 11, marginTop: 1 },
  prayNowBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  prayNowText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  liveBanner: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  liveBannerText: { color: "#fff", fontWeight: "700", fontSize: 13, flex: 1 },
  liveBannerSub: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
  quickRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  quickItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  quickIcon: { fontSize: 22 },
  quickLabel: { fontSize: 11, fontWeight: "600" },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    paddingHorizontal: 14,
    paddingTop: 14,
    marginBottom: 8,
  },
  featuredCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  featuredSkeleton: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredThumb: { width: "100%", aspectRatio: 16 / 9 },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: { color: "#fff", fontSize: 20, marginLeft: 3 },
  featuredTitle: { fontSize: 15, fontWeight: "700", lineHeight: 21, marginBottom: 4 },
  featuredSub: { fontSize: 12 },
  devotionCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 18,
  },
  devotionLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  devotionTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  devotionVerse: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    lineHeight: 20,
    fontStyle: "italic",
    marginBottom: 6,
  },
  devotionRef: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 14 },
  devotionDeclaration: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontStyle: "italic",
    lineHeight: 16,
    marginBottom: 12,
  },
  devotionReadBtn: { backgroundColor: "#fff", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  devotionReadBtnText: { fontWeight: "700", fontSize: 13 },
  crusadeBanner: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    height: 220,
    overflow: "hidden",
  },
  crusadeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,15,50,0.68)",
  },
  crusadeContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: 16,
    gap: 4,
  },
  crusadeBadge: { fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  crusadeTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  crusadeSub: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
  countdownRow: {
    flexDirection: "row",
    gap: 10,
    marginVertical: 6,
    alignItems: "center",
  },
  countdownUnit: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    minWidth: 44,
  },
  countdownNum: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 0.5 },
  countdownLabel: { color: "rgba(255,255,255,0.6)", fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  countdownLiveWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  countdownLiveDot: { width: 8, height: 8, borderRadius: 4 },
  countdownLiveText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  crusadeRegBtn: { marginTop: 4, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, alignSelf: "flex-start" },
  crusadeRegText: { color: "#001533", fontWeight: "800", fontSize: 13 },
  webLink: { alignItems: "center", paddingVertical: 16 },
  webLinkText: { fontSize: 12 },
});
