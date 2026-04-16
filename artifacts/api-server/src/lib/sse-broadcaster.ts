import type { Response } from "express";

export interface SSEClient {
  id: string;
  res: Response;
}

export type SSEEvent = {
  type: "new_sermon";
  data: {
    id: number;
    videoId: string;
    title: string;
    thumbnailUrl: string;
    isFeatured: boolean;
    isLive: boolean;
    publishedAt: string;
  };
} | {
  type: "sync_complete";
  data: { synced: number; featured?: number; source?: string; deleted?: string };
} | {
  type: "broadcast_started";
  data: { videoId: string | null; title: string | null; startedAt: string };
} | {
  type: "broadcast_ended";
  data: { videoId: string | null; endedAt: string };
} | {
  type: "rebroadcast_started";
  data: {
    videoId: string | null;
    title: string | null;
    thumbnailUrl: string | null;
    startedAt: string;
    expiresAt: string;
    strategy?: string;
  };
} | {
  type: "rebroadcast_ended";
  data: { expiredAt: string };
} | {
  type: "gallery_updated";
  data: {
    action: "created" | "updated" | "deleted" | "thumbnail_ready";
    imageId?: number;
    objectPath?: string | null;
    thumbnailPath?: string | null;
    isPublished?: boolean;
    isFeatured?: boolean;
    changedAt: string;
  };
} | {
  type: "ping";
  data: Record<string, never>;
};

class SSEBroadcaster {
  private clients = new Map<string, SSEClient>();

  add(id: string, res: Response): void {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Keep-alive ping every 25 seconds
    const pingInterval = setInterval(() => {
      if (!res.writableEnded) {
        res.write(`event: ping\ndata: {}\n\n`);
      }
    }, 25000);

    this.clients.set(id, { id, res });

    res.on("close", () => {
      clearInterval(pingInterval);
      this.clients.delete(id);
    });
  }

  broadcast(event: SSEEvent): void {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const client of this.clients.values()) {
      if (!client.res.writableEnded) {
        client.res.write(payload);
      }
    }
  }

  size(): number {
    return this.clients.size;
  }
}

export const sseBroadcaster = new SSEBroadcaster();
