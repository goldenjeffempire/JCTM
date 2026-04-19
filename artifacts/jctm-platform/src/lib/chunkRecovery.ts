const RECOVERY_KEY = "jctm:chunk-recovery-at";
const RECOVERY_WINDOW_MS = 30_000;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk .* failed|Unable to preload CSS/i.test(message);
}

export async function recoverFromChunkLoadError(error: unknown): Promise<boolean> {
  if (!isChunkLoadError(error)) return false;
  const lastRecovery = getLastRecoveryAt();
  if (Date.now() - lastRecovery < RECOVERY_WINDOW_MS) return false;
  setLastRecoveryAt(Date.now());

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    }

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith("jctm-")).map(key => caches.delete(key)));
    }
  } catch {
    undefined;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("appVersion", String(Date.now()));
  window.location.replace(url.toString());
  return true;
}

function getLastRecoveryAt(): number {
  try {
    return Number(sessionStorage.getItem(RECOVERY_KEY) ?? "0");
  } catch {
    return 0;
  }
}

function setLastRecoveryAt(value: number) {
  try {
    sessionStorage.setItem(RECOVERY_KEY, String(value));
  } catch {
    undefined;
  }
}