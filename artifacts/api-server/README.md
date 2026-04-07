# JCTM API Server

Express 5 REST API for the JCTM Digital Sanctuary platform.

## Stack

- **Runtime:** Node.js 24
- **Framework:** Express 5
- **Database:** PostgreSQL via Drizzle ORM (`@workspace/db`)
- **Validation:** Zod v4 (`@workspace/api-zod`)
- **Build:** esbuild (ESM bundle, `dist/index.mjs`)
- **Logging:** Pino + pino-http (structured JSON)
- **AI:** OpenAI GPT-4o via `@workspace/integrations-openai-ai-server`

## Running

```bash
# Development (build + watch)
pnpm run dev

# Build only
pnpm run build

# Start built output
pnpm run start
```

In the Replit environment use the **Start Backend** workflow (`PORT=8080`).

## Routes

### Health
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check — returns `{ ok: true }` |

### Global Altar (Real-time SSE)
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/altar/stream` | SSE stream — pushes `{ count, timestamp }` on join/leave/fluctuation |
| `GET` | `/api/altar/count` | Current count snapshot (JSON) |

**How it works:**

Each incoming SSE connection is added to an in-memory `Set<Response>`. The count broadcast to all clients is:

```
count = BASE_COUNT (47) + clients.size + ghostClients
```

`ghostClients` fluctuates ±2 every ~9 seconds via `setInterval` to simulate a realistic "many users online" feel. When any client disconnects the count drops and the new total is broadcast immediately.

### Sermons
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sermons` | Paginated sermon list; optional `?search=` |
| `GET` | `/api/sermons/featured` | Featured sermon |
| `GET` | `/api/sermons/stats` | `{ total, totalViews }` |
| `GET` | `/api/sermons/:id` | Single sermon by ID |
| `GET` | `/api/sermons/stream` | SSE stream — fires on YouTube sync |
| `POST` | `/api/sermons/sync` | Incremental YouTube sync (latest 50) |
| `POST` | `/api/sermons/harvest` | Full YouTube channel harvest |
| `GET` | `/api/sermons/websub` | WebSub verification |
| `POST` | `/api/sermons/websub` | WebSub push notification |

### Testimonies
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/testimonies` | List approved testimonies |
| `POST` | `/api/testimonies` | Submit testimony (pending review) |
| `POST` | `/api/testimonies/:id/like` | Increment Amen count |

### Events
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/events/upcoming` | Upcoming ministry events |

### Members & Auth
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/members` | Member directory |
| `POST` | `/api/auth/register` | Register member |
| `POST` | `/api/auth/login` | Login — returns Bearer token |
| `GET` | `/api/auth/me` | Profile from `Authorization: Bearer <token>` |

### Chat (TempleBots AI)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | Send a message; body: `{ message, sessionId? }` |

**Response:** `{ reply, sessionId, sources? }`

The AI is instructed to act as TempleBots — a knowledgeable guide for JCTM doctrine, the Correction Mandate, giving, and Primitive Christianity.

### Giving
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/giving/initiate` | Create a payment session (Paystack/Stripe) |

### Livestream
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/livestream/status` | `{ isLive, videoId?, title? }` |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | OpenAI API key for TempleBots |
| `PORT` | Yes | Server port (set to `8080` by the workflow) |
| `YOUTUBE_API_KEY` | Optional | YouTube Data API v3 for sermon sync |
| `PAYSTACK_SECRET_KEY` | Optional | Live NGN payments |
| `STRIPE_SECRET_KEY` | Optional | Live USD payments |

## Important Notes

### Date Serialization
Drizzle ORM returns `Date` objects from PostgreSQL. Every route that returns date fields must call `.toISOString()` before Zod validation. Skipping this breaks the Zod schema parse.

### SSE Pattern
All SSE endpoints follow this pattern:

```typescript
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");
res.setHeader("X-Accel-Buffering", "no");
res.flushHeaders();
// send data
res.write(`data: ${JSON.stringify(payload)}\n\n`);
// clean up on disconnect
req.on("close", () => { /* remove from registry */ });
```

### YouTube Sync
`lib/youtube-sync.ts` fetches from the JCTM uploads playlist and upserts into the `sermons` table. It filters out videos shorter than 120 seconds (Shorts). Triggered manually via `/api/sermons/sync` or on a 30-minute cron.
