const KEY = "jctm_visitor_id";

export function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return "anonymous";
  }
}

export function getVisitorId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
