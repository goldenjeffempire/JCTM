/**
 * Lightweight YouTube Data API v3 OAuth helper.
 *
 * Required environment variables:
 *   YOUTUBE_CLIENT_ID       — OAuth 2.0 client ID
 *   YOUTUBE_CLIENT_SECRET   — OAuth 2.0 client secret
 *   YOUTUBE_REFRESH_TOKEN   — offline refresh token for the channel owner account
 *
 * Posting/updating comments requires the youtube.force-ssl scope.
 */

import { logger } from "./logger.js";

const TOKEN_ENDPOINT    = "https://oauth2.googleapis.com/token";
const YT_COMMENTS_URL   = "https://www.googleapis.com/youtube/v3/commentThreads";
const YT_COMMENT_UPDATE = "https://www.googleapis.com/youtube/v3/comments";

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string | null> {
  const clientId     = process.env["YOUTUBE_CLIENT_ID"];
  const clientSecret = process.env["YOUTUBE_CLIENT_SECRET"];
  const refreshToken = process.env["YOUTUBE_REFRESH_TOKEN"];

  if (!clientId || !clientSecret || !refreshToken) return null;

  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    "refresh_token",
      }),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "YouTube OAuth token refresh failed");
      return null;
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedAccessToken = data.access_token;
    tokenExpiresAt    = Date.now() + data.expires_in * 1000;
    return cachedAccessToken;
  } catch (err) {
    logger.warn({ err }, "YouTube OAuth token refresh error");
    return null;
  }
}

/**
 * Posts a top-level comment thread on a YouTube video.
 * Returns the YouTube comment id on success, or null if credentials are
 * missing / request fails.
 */
export async function postYouTubeComment(
  videoId:    string,
  authorName: string,
  text:       string,
): Promise<string | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  try {
    const res = await fetch(`${YT_COMMENTS_URL}?part=snippet`, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: {
          videoId,
          topLevelComment: {
            snippet: { textOriginal: `${authorName}: ${text}` },
          },
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.warn({ status: res.status, body: errBody }, "YouTube comment post failed");
      return null;
    }

    const data = (await res.json()) as { id: string };
    logger.info({ videoId, ytCommentId: data.id }, "Comment mirrored to YouTube");
    return data.id;
  } catch (err) {
    logger.warn({ err }, "YouTube comment post error");
    return null;
  }
}

/**
 * Builds the engagement comment text shown on YouTube from platform stats.
 */
function buildEngagementText(likeCount: number, shareCount: number): string {
  const lines: string[] = [];
  if (likeCount > 0) {
    lines.push(`❤️ ${likeCount} ${likeCount === 1 ? "person" : "people"} loved this message on our ministry platform`);
  }
  if (shareCount > 0) {
    lines.push(`🔗 Shared ${shareCount} ${shareCount === 1 ? "time" : "times"} from jctm.org`);
  }
  lines.push("Join us at Jesus Christ Temple Ministry · Warri, Nigeria");
  return lines.join("\n");
}

/**
 * Creates or updates a single "engagement summary" comment on a YouTube video
 * that reflects the cumulative likes and shares from the ministry platform.
 *
 * Pass `existingCommentId` (the top-level comment's id, not the thread id)
 * if a comment was already posted for this video.
 *
 * Returns the top-level comment id to store for future updates,
 * or null if credentials are missing / request fails.
 */
export async function syncEngagementComment(
  videoId:           string,
  existingCommentId: string | null,
  likeCount:         number,
  shareCount:        number,
): Promise<string | null> {
  if (likeCount === 0 && shareCount === 0) return existingCommentId;

  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const text = buildEngagementText(likeCount, shareCount);

  // ── Update existing comment ──────────────────────────────────────────────
  if (existingCommentId) {
    try {
      const res = await fetch(`${YT_COMMENT_UPDATE}?part=snippet`, {
        method: "PUT",
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: existingCommentId,
          snippet: { textOriginal: text },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        logger.warn({ status: res.status, body: errBody }, "YouTube engagement comment update failed");
        return existingCommentId;
      }

      logger.info({ videoId, existingCommentId, likeCount, shareCount }, "YouTube engagement comment updated");
      return existingCommentId;
    } catch (err) {
      logger.warn({ err }, "YouTube engagement comment update error");
      return existingCommentId;
    }
  }

  // ── Create new comment thread ────────────────────────────────────────────
  try {
    const res = await fetch(`${YT_COMMENTS_URL}?part=snippet`, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: {
          videoId,
          topLevelComment: {
            snippet: { textOriginal: text },
          },
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.warn({ status: res.status, body: errBody }, "YouTube engagement comment create failed");
      return null;
    }

    const data = (await res.json()) as {
      snippet: { topLevelComment: { id: string } };
    };
    const commentId = data.snippet.topLevelComment.id;
    logger.info({ videoId, commentId, likeCount, shareCount }, "YouTube engagement comment created");
    return commentId;
  } catch (err) {
    logger.warn({ err }, "YouTube engagement comment create error");
    return null;
  }
}
