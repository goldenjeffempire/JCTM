import OpenAI from "openai";

const baseURL =
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (_client) return _client;

  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "No OpenAI API key found. Set OPENAI_API_KEY, or provision the Replit AI integration to set AI_INTEGRATIONS_OPENAI_API_KEY.",
    );
  }

  _client = new OpenAI({ apiKey, baseURL });
  return _client;
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop: string) {
    return getOpenAIClient()[prop as keyof OpenAI];
  },
});
