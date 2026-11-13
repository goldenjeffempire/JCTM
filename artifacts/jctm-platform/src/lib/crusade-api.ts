import { useQuery } from "@tanstack/react-query";
import type { CrusadeCampaign } from "@workspace/content";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const crusadeKey = ["crusade-2026"] as const;
export async function crusadeRequest(path = "", init?: RequestInit): Promise<CrusadeCampaign> {
  const response = await fetch(`${BASE}/api/crusade-2026${path}`, { ...init, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Unable to load crusade information");
  return body;
}
export function useCrusade() {
  return useQuery({
    queryKey: crusadeKey, queryFn: () => crusadeRequest(), staleTime: 15_000,
    refetchInterval: 30_000, refetchOnWindowFocus: true, retry: 1,
  });
}
