import { useQuery } from "@tanstack/react-query";
import type { CrusadeCampaign } from "@workspace/content";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const crusadeKey = ["crusade-2026"] as const;

export class CrusadeRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "CrusadeRequestError";
  }
}

export function isCrusadeNotFound(error: unknown): boolean {
  return error instanceof CrusadeRequestError && error.status === 404;
}

export function shouldRetryCrusadeLoad(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (!(error instanceof CrusadeRequestError)) return true;
  return error.status === 408 || error.status === 429 || error.status >= 500;
}

export function crusadeRetryDelay(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 2_000);
}

function isCampaignPayload(value: unknown): value is CrusadeCampaign {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const campaign = value as Partial<CrusadeCampaign>;
  return typeof campaign.title === "string"
    && typeof campaign.minister === "string"
    && typeof campaign.venue === "string"
    && typeof campaign.flyerUrl === "string"
    && typeof campaign.contactPhone === "string"
    && typeof campaign.contactEmail === "string"
    && typeof campaign.published === "boolean"
    && Number.isInteger(campaign.revision)
    && Array.isArray(campaign.programs)
    && campaign.programs.every(program =>
      typeof program.id === "string"
      && typeof program.title === "string"
      && typeof program.description === "string"
      && typeof program.published === "boolean"
      && Array.isArray(program.startsAt)
      && program.startsAt.every(start => typeof start === "string"));
}

export async function crusadeRequest(path = "", init?: RequestInit): Promise<CrusadeCampaign> {
  const response = await fetch(`${BASE}/api/crusade-2026${path}`, { cache: "no-store", ...init });
  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : "Unable to load crusade information";
    throw new CrusadeRequestError(response.status, message);
  }
  if (!isCampaignPayload(body)) {
    throw new CrusadeRequestError(502, "The crusade details arrived incomplete. Please try again.");
  }
  return body;
}
export function useCrusade() {
  return useQuery({
    queryKey: crusadeKey, queryFn: ({ signal }) => crusadeRequest("", { signal }),
    retry: shouldRetryCrusadeLoad, retryDelay: crusadeRetryDelay, staleTime: 15_000,
    refetchInterval: 30_000, refetchOnWindowFocus: true,
  });
}
