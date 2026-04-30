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
  type: "event_notification_dispatched";
  data: {
    logId: number;
    eventId: number;
    eventTitle: string;
    milestoneHours: number;
    channel: "push" | "email" | "sse";
    status: "pending" | "sent" | "failed" | "skipped";
    attempts: number;
    successCount: number;
    failureCount: number;
    recipientCount: number;
    lastError?: string | null;
    at: string;
  };
} | {
  type: "event_notification_tick";
  data: {
    startedAt: string;
    finishedAt: string;
    eventsScanned: number;
    dispatchesAttempted: number;
    dispatchesSucceeded: number;
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

    const pingInterval = setInterval(() => {
      if (!res.writableEnded) {
        res.write(`event: ping\ndata: {}\n\n`);
      } else {
        clearInterval(pingInterval);
        this.clients.delete(id);
      }
    }, 25000);

    this.clients.set(id, { id, res });

    const cleanup = () => {
      clearInterval(pingInterval);
      this.clients.delete(id);
    };
    res.once("close", cleanup);
    res.once("finish", cleanup);
    res.once("error", cleanup);
  }

  broadcast(event: SSEEvent): void {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const client of this.clients.values()) {
      if (!client.res.writableEnded) {
        try {
          client.res.write(payload);
        } catch {
          this.clients.delete(client.id);
        }
      } else {
        this.clients.delete(client.id);
      }
    }
  }

  size(): number {
    return this.clients.size;
  }
}

export const sseBroadcaster = new SSEBroadcaster();
