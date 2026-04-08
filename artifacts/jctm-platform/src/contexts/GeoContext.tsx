import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface GeoInfo {
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

interface GeoContextValue {
  geo: GeoInfo | null;
  isLoading: boolean;
  isNigeria: boolean;
  isWarriRegion: boolean;
  countryCode: string;
  continent: string;
}

const GeoContext = createContext<GeoContextValue | null>(null);

export function GeoProvider({ children }: { children: ReactNode }) {
  const [geo, setGeo] = useState<GeoInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const cached = sessionStorage.getItem("jctm-geo");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as GeoInfo;
        setGeo(parsed);
        setIsLoading(false);
        return;
      } catch {
        sessionStorage.removeItem("jctm-geo");
      }
    }

    fetch(`${BASE}/api/geo`)
      .then(r => r.ok ? r.json() : null)
      .then((data: GeoInfo | null) => {
        if (data && data.country !== "Unknown") {
          setGeo(data);
          sessionStorage.setItem("jctm-geo", JSON.stringify(data));
        }
      })
      .catch(() => null)
      .finally(() => setIsLoading(false));
  }, []);

  const value: GeoContextValue = {
    geo,
    isLoading,
    isNigeria: geo?.isNigeria ?? false,
    isWarriRegion: geo?.isWarriRegion ?? false,
    countryCode: geo?.countryCode ?? "",
    continent: geo?.continent ?? "",
  };

  return <GeoContext.Provider value={value}>{children}</GeoContext.Provider>;
}

export function useGeo() {
  const ctx = useContext(GeoContext);
  if (!ctx) throw new Error("useGeo must be used within GeoProvider");
  return ctx;
}
