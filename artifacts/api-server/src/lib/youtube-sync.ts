import { db, sermonsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import type { Logger } from "pino";

export const CHANNEL_ID = "UCPFFvkE-KGpR37qJgvYriJg";
// Uploads playlist = UU + channel_id without the leading UC
export const UPLOADS_PLAYLIST_ID = "UUPFFvkE-KGpR37qJgvYriJg";

const FEATURED_KEYWORDS = ["live", "sunday service", "prophetic", "live now", "special service", "breaking"];

interface PlaylistItem {
  snippet: {
    resourceId: { videoId: string };
    title: string;
    description: string;
    publishedAt: string;
    thumbnails: {
      maxres?: { url: string };
      standard?: { url: string };
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
}

interface VideoDetail {
  id: string;
  contentDetails: { duration: string };
  statistics: { viewCount?: string };
  snippet?: { liveBroadcastContent?: string };
}

export function iso8601ToSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] ?? "0") * 3600) + (parseInt(match[2] ?? "0") * 60) + parseInt(match[3] ?? "0");
}

export function bestThumbnail(thumbnails: PlaylistItem["snippet"]["thumbnails"], videoId: string): string {
  return (
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
  );
}

export function classifyTitle(title: string): { isFeatured: boolean; isLive: boolean } {
  const lower = title.toLowerCase();
  const isLive = lower.includes("live") || lower.includes("live now") || lower.includes("live stream");
  const isFeatured =
    isLive ||
    FEATURED_KEYWORDS.some(kw => lower.includes(kw));
  return { isFeatured, isLive };
}

export class QuotaExceededError extends Error {
  constructor() {
    super("YouTube API quota exceeded for today");
    this.name = "QuotaExceededError";
  }
}

async function fetchWithRetry<T>(
  url: string,
  retries = 2,
  delayMs = 1500
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 403) {
        const body = await res.text();
        if (body.includes("quota")) throw new QuotaExceededError();
        throw new Error(`HTTP 403: ${body.slice(0, 200)}`);
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      return await res.json() as T;
    } catch (err) {
      if (err instanceof QuotaExceededError) throw err;
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
}

async function fetchPlaylistItems(apiKey: string): Promise<PlaylistItem[]> {
  const items: PlaylistItem[] = [];
  let pageToken: string | undefined;

  while (true) {
    const params = new URLSearchParams({
      key: apiKey,
      playlistId: UPLOADS_PLAYLIST_ID,
      part: "snippet",
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });

    const data = await fetchWithRetry<{
      items?: PlaylistItem[];
      nextPageToken?: string;
      error?: { message: string };
    }>(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`);

    if (data.error) throw new Error(`YouTube API: ${data.error.message}`);
    if (!data.items || data.items.length === 0) break;

    items.push(...data.items);
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return items;
}

async function fetchVideoDetails(apiKey: string, videoIds: string[]): Promise<VideoDetail[]> {
  const details: VideoDetail[] = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      key: apiKey,
      id: batch.join(","),
      part: "contentDetails,statistics,snippet",
    });

    const data = await fetchWithRetry<{
      items?: VideoDetail[];
      error?: { message: string };
    }>(`https://www.googleapis.com/youtube/v3/videos?${params}`);

    if (data.error) throw new Error(`YouTube API: ${data.error.message}`);
    if (data.items) details.push(...data.items);
  }

  return details;
}

export interface SyncResult {
  synced: number;
  featured: number;
  live: number;
  message: string;
}

/**
 * Incremental upsert: fetches latest videos, upserts into DB (insert or update on conflict).
 * Does NOT purge existing records. Filters out Shorts (<= 60s).
 */
export async function syncIncremental(apiKey: string, log?: Logger): Promise<SyncResult> {
  log?.info("Starting incremental YouTube sync");

  const playlistItems = await fetchPlaylistItems(apiKey);
  if (playlistItems.length === 0) {
    return { synced: 0, featured: 0, live: 0, message: "No videos on channel" };
  }

  const videoIds = playlistItems.map(i => i.snippet.resourceId.videoId);
  const detailMap = new Map<string, VideoDetail>();
  const details = await fetchVideoDetails(apiKey, videoIds);
  for (const d of details) detailMap.set(d.id, d);

  const validVideos = playlistItems.filter(item => {
    const detail = detailMap.get(item.snippet.resourceId.videoId);
    if (!detail) return false;
    return iso8601ToSeconds(detail.contentDetails.duration) > 60;
  });

  let featured = 0;
  let live = 0;

  for (const item of validVideos) {
    const videoId = item.snippet.resourceId.videoId;
    const detail = detailMap.get(videoId)!;
    const { isFeatured, isLive } = classifyTitle(item.snippet.title);

    if (isFeatured) featured++;
    if (isLive) live++;

    // Check for live broadcast status from API
    const liveStatus = detail.snippet?.liveBroadcastContent;
    const actuallyLive = isLive || liveStatus === "live";

    await db
      .insert(sermonsTable)
      .values({
        videoId,
        title: item.snippet.title,
        thumbnailUrl: bestThumbnail(item.snippet.thumbnails, videoId),
        description: item.snippet.description.slice(0, 1000),
        publishedAt: new Date(item.snippet.publishedAt),
        viewCount: detail.statistics?.viewCount ? parseInt(detail.statistics.viewCount) : null,
        duration: detail.contentDetails.duration,
        isFeatured,
        isLive: actuallyLive,
      })
      .onConflictDoUpdate({
        target: sermonsTable.videoId,
        set: {
          title: item.snippet.title,
          thumbnailUrl: bestThumbnail(item.snippet.thumbnails, videoId),
          viewCount: detail.statistics?.viewCount ? parseInt(detail.statistics.viewCount) : null,
          isFeatured,
          isLive: actuallyLive,
          broadcastEndedAt: sql`CASE WHEN sermon_data.is_live = true AND ${actuallyLive} = false THEN NOW() ELSE sermon_data.broadcast_ended_at END`,
        },
      });
  }

  log?.info({ synced: validVideos.length, featured, live }, "Incremental sync complete");
  return {
    synced: validVideos.length,
    featured,
    live,
    message: `Synced ${validVideos.length} sermons (${featured} featured, ${live} live)`,
  };
}

/**
 * Full harvest: purges all existing records, fetches the entire channel history.
 * Use only for initial population or manual reset.
 */
export async function harvestAll(apiKey: string, log?: Logger): Promise<SyncResult> {
  log?.info("Starting full harvest (purge + repopulate)");

  const playlistItems = await fetchPlaylistItems(apiKey);
  if (playlistItems.length === 0) {
    return { synced: 0, featured: 0, live: 0, message: "No videos on channel" };
  }

  const videoIds = playlistItems.map(i => i.snippet.resourceId.videoId);
  const detailMap = new Map<string, VideoDetail>();
  const details = await fetchVideoDetails(apiKey, videoIds);
  for (const d of details) detailMap.set(d.id, d);

  const validVideos = playlistItems.filter(item => {
    const detail = detailMap.get(item.snippet.resourceId.videoId);
    if (!detail) return false;
    return iso8601ToSeconds(detail.contentDetails.duration) > 60;
  });

  // Purge existing data
  await db.delete(sermonsTable);

  let featured = 0;
  let live = 0;
  const inserts = validVideos.map(item => {
    const videoId = item.snippet.resourceId.videoId;
    const detail = detailMap.get(videoId)!;
    const { isFeatured, isLive } = classifyTitle(item.snippet.title);
    if (isFeatured) featured++;
    if (isLive) live++;
    return {
      videoId,
      title: item.snippet.title,
      thumbnailUrl: bestThumbnail(item.snippet.thumbnails, videoId),
      description: item.snippet.description.slice(0, 1000),
      publishedAt: new Date(item.snippet.publishedAt),
      viewCount: detail.statistics?.viewCount ? parseInt(detail.statistics.viewCount) : null,
      duration: detail.contentDetails.duration,
      isFeatured,
      isLive,
    };
  });

  if (inserts.length > 0) {
    // Insert in batches of 100
    for (let i = 0; i < inserts.length; i += 100) {
      await db.insert(sermonsTable).values(inserts.slice(i, i + 100));
    }
  }

  log?.info({ synced: inserts.length, featured, live }, "Full harvest complete");
  return {
    synced: inserts.length,
    featured,
    live,
    message: `Harvested ${inserts.length} sermons from full channel history (${featured} featured, ${live} live)`,
  };
}

/**
 * Sync a single video by ID. Used by WebSub push notifications.
 */
export async function syncSingleVideo(apiKey: string, videoId: string, log?: Logger): Promise<void> {
  log?.info({ videoId }, "Syncing single video from WebSub notification");

  const params = new URLSearchParams({
    key: apiKey,
    id: videoId,
    part: "snippet,contentDetails,statistics",
  });

  const data = await fetchWithRetry<{
    items?: Array<{
      id: string;
      snippet: {
        title: string;
        description: string;
        publishedAt: string;
        thumbnails: PlaylistItem["snippet"]["thumbnails"];
        liveBroadcastContent?: string;
        channelId: string;
      };
      contentDetails: { duration: string };
      statistics: { viewCount?: string };
    }>;
  }>(`https://www.googleapis.com/youtube/v3/videos?${params}`);

  if (!data.items || data.items.length === 0) {
    log?.warn({ videoId }, "Video not found via API");
    return;
  }

  const item = data.items[0];
  if (item.snippet.channelId !== CHANNEL_ID) {
    log?.warn({ videoId }, "Video not from JCTM channel, skipping");
    return;
  }

  const durationSecs = iso8601ToSeconds(item.contentDetails.duration);
  if (durationSecs > 0 && durationSecs <= 60) {
    log?.info({ videoId }, "Skipping Short video");
    return;
  }

  const { isFeatured, isLive } = classifyTitle(item.snippet.title);
  const actuallyLive = isLive || item.snippet.liveBroadcastContent === "live";

  await db
    .insert(sermonsTable)
    .values({
      videoId,
      title: item.snippet.title,
      thumbnailUrl: bestThumbnail(item.snippet.thumbnails, videoId),
      description: item.snippet.description.slice(0, 1000),
      publishedAt: new Date(item.snippet.publishedAt),
      viewCount: item.statistics?.viewCount ? parseInt(item.statistics.viewCount) : null,
      duration: item.contentDetails.duration,
      isFeatured,
      isLive: actuallyLive,
    })
    .onConflictDoUpdate({
      target: sermonsTable.videoId,
      set: {
        title: item.snippet.title,
        thumbnailUrl: bestThumbnail(item.snippet.thumbnails, videoId),
        viewCount: item.statistics?.viewCount ? parseInt(item.statistics.viewCount) : null,
        isFeatured,
        isLive: actuallyLive,
        broadcastEndedAt: sql`CASE WHEN sermon_data.is_live = true AND ${actuallyLive} = false THEN NOW() ELSE sermon_data.broadcast_ended_at END`,
      },
    });

  log?.info({ videoId, isFeatured, isLive: actuallyLive }, "Single video synced");
}

/**
 * Subscribe to YouTube PubSubHubbub (WebSub) for push notifications.
 * Call once on server startup.
 */
export async function subscribeToWebSub(callbackUrl: string, log?: Logger): Promise<void> {
  const HUB = "https://pubsubhubbub.appspot.com/subscribe";
  const TOPIC = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

  const body = new URLSearchParams({
    "hub.callback": callbackUrl,
    "hub.mode": "subscribe",
    "hub.topic": TOPIC,
    "hub.verify": "async",
    "hub.lease_seconds": "86400",
  });

  try {
    const res = await fetch(HUB, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (res.status === 202 || res.status === 200) {
      log?.info({ callbackUrl }, "WebSub subscription submitted successfully");
    } else {
      const text = await res.text();
      log?.warn({ status: res.status, text }, "WebSub subscription returned unexpected status");
    }
  } catch (err) {
    log?.warn({ err }, "WebSub subscription failed (non-fatal)");
  }
}
