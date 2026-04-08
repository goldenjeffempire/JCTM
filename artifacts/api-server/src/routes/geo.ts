import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

interface GeoResult {
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  region: string;
  timezone: string;
  continent: string;
  isNigeria: boolean;
  isWarriRegion: boolean;
  latitude: number | null;
  longitude: number | null;
}

const geoCache = new Map<string, { data: GeoResult; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getClientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket?.remoteAddress ??
    ""
  );
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.") ||
    ip === "localhost" ||
    ip === ""
  );
}

const WARRI_REGION_STATES = ["Delta", "Rivers", "Bayelsa", "Edo"];

router.get("/geo", async (req: Request, res: Response): Promise<void> => {
  const ip = getClientIp(req);

  if (isPrivateIp(ip)) {
    res.json({
      ip: "local",
      country: "Unknown",
      countryCode: "",
      city: "Unknown",
      region: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      continent: "Unknown",
      isNigeria: false,
      isWarriRegion: false,
      latitude: null,
      longitude: null,
    } satisfies GeoResult);
    return;
  }

  const cached = geoCache.get(ip);
  if (cached && Date.now() < cached.expiresAt) {
    res.json(cached.data);
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`https://ipwho.is/${ip}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`ipwho.is returned ${response.status}`);
    }

    const raw = (await response.json()) as {
      success?: boolean;
      ip?: string;
      country?: string;
      country_code?: string;
      city?: string;
      region?: string;
      timezone?: { id?: string };
      continent?: string;
      latitude?: number;
      longitude?: number;
    };

    if (!raw.success) {
      throw new Error("ipwho.is lookup failed");
    }

    const countryCode = raw.country_code ?? "";
    const region = raw.region ?? "";
    const isNigeria = countryCode === "NG";
    const isWarriRegion = isNigeria && WARRI_REGION_STATES.some(s => region.includes(s));

    const result: GeoResult = {
      ip: raw.ip ?? ip,
      country: raw.country ?? "Unknown",
      countryCode,
      city: raw.city ?? "Unknown",
      region,
      timezone: raw.timezone?.id ?? "UTC",
      continent: raw.continent ?? "Unknown",
      isNigeria,
      isWarriRegion,
      latitude: raw.latitude ?? null,
      longitude: raw.longitude ?? null,
    };

    geoCache.set(ip, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    res.json(result);
  } catch {
    res.json({
      ip,
      country: "Unknown",
      countryCode: "",
      city: "Unknown",
      region: "",
      timezone: "UTC",
      continent: "Unknown",
      isNigeria: false,
      isWarriRegion: false,
      latitude: null,
      longitude: null,
    } satisfies GeoResult);
  }
});

export default router;
