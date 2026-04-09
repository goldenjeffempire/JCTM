/**
 * Lightweight YouTube Data API v3 OAuth helper.
 *
 * Required environment variables (all optional — features degrade gracefully):
 *   YOUTUBE_OAUTH_CLIENT_ID
 *   YOUTUBE_OAUTH_CLIENT_SECRET
 *   YOUTUBE_REFRESH_TOKEN      — offline refresh token for the channel owner account
 *
 * Posting comments requires the channel owner to have granted the app
 * the `youtube.force-ssl` scope and stored a refresh token here.
 */

import { logger } from "./logger.js";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const YT_COMMENTS_ENDPOINT = "https://www.googleapis.com/youtube/v3/commentThreads";

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env["YOUTUBE_OAUTH_CLIENT_ID"];
  const clientSecret = process.env["YOUTUBE_OAUTH_CLIENT_SECRET"];
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
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "YouTube OAuth token refresh failed");
      return null;
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedAccessToken = data.access_token;
    tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return cachedAccessToken;
  } catch (err) {
    logger.warn({ err }, "YouTube OAuth token refresh error");
    return null;
  }
}

/**
 * Posts a top-level comment thread on a YouTube video.
 * Returns the YouTube comment id on success, or null if credentials are missing / request fails.
 */
export async function postYouTubeComment(
  videoId: string,
  authorName: string,
  text: string,
): Promise<string | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  try {
    const body = {
      snippet: {
        videoId,
        topLevelComment: {
          snippet: {
            textOriginal: `${authorName}: ${text}`,
          },
        },
      },
    };

    const res = await fetch(`${YT_COMMENTS_ENDPOINT}?part=snippet`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
