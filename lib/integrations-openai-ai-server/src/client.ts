/**
 * OpenAI integration stub — disabled.
 *
 * This project uses a fully local AI engine (local-ai-engine.ts, local-ai-enhancer.ts,
 * local-embeddings.ts). No external AI API calls are made in production.
 * This file exists only to satisfy the package structure.
 */

function notAvailable(name: string): never {
  throw new Error(
    `OpenAI.${name} is not available — this project uses local AI exclusively. ` +
    `See artifacts/api-server/src/lib/local-ai-engine.ts.`,
  );
}

export function getOpenAIClient(): never {
  notAvailable("getClient");
}

export const openai = new Proxy({} as Record<string, unknown>, {
  get(_target, prop: string) {
    notAvailable(prop);
  },
}) as never;
