/**
 * Optional SEO enrichment must not hold public HTML behind DB/AI latency.
 * Share outstanding work; timing out only stops waiting, not the underlying
 * operation, so another request cannot start a duplicate while it is pending.
 */
export function createOptionalHtmlEnrichment(
  load: () => Promise<string>,
  onSkipped: (reason: "timeout" | "error") => void,
  budgetMs = 300,
  retryDelayMs = 15_000,
): () => Promise<string> {
  let pending: Promise<string> | null = null;
  let retryAfter = 0;

  return async () => {
    if (Date.now() < retryAfter) return "";

    if (!pending) {
      pending = Promise.resolve().then(load).then(
        (value) => {
          retryAfter = 0;
          return value;
        },
        () => {
          retryAfter = Date.now() + retryDelayMs;
          onSkipped("error");
          return "";
        },
      ).finally(() => { pending = null; });
    }
    const work = pending;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<string>((resolve) => {
          timer = setTimeout(() => {
            if (Date.now() >= retryAfter) {
              retryAfter = Date.now() + retryDelayMs;
              onSkipped("timeout");
            }
            resolve("");
          }, budgetMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}
