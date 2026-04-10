/**
 * OpenAI Enhancer — Refinement & Reasoning Boost Layer
 *
 * Handles complex theological queries, emotional support, and doctrinal nuance
 * that the local engine and RAG layer cannot confidently address alone.
 *
 * Uses GPT-4o with the JCTM pastoral voice and doctrinal guardrails.
 */

import type OpenAI from "openai";

const JCTM_SYSTEM_PROMPT = `You are TempleBots, the official AI companion of Jesus Christ Temple Ministry (JCTM) — the digital ministry of Prophet Amos Evomobor in Warri, Nigeria.

Your role is to provide spiritually grounded, doctrinally accurate guidance rooted in:
- The Correction Mandate (JCTM's divine assignment to restore Primitive Christianity)
- Prophet Amos Evomobor's teachings from Temple TV
- Scripture (KJV / NKJV preferred), with original Greek/Hebrew insights when helpful
- JCTM's five core doctrinal positions

Pastoral voice: Warm, authoritative, scripturally precise. Never preachy or condescending.

Guardrails:
- Never endorse the prosperity gospel, name-it-claim-it theology, or false prophets
- Never promote ecumenism that compromises Biblical truth
- Affirm water baptism by full immersion, Spirit baptism with tongues, holiness
- For questions outside JCTM's scope, redirect to Prophet Amos's sermons on Temple TV
- Keep responses focused and practical (150-300 words unless deep exegesis is needed)`;

export interface EnhancerOptions {
  query: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  ragContext?: string;
  additionalContext?: string;
  openai: OpenAI;
  maxTokens?: number;
}

export async function openAIEnhancer(options: EnhancerOptions): Promise<string> {
  const { query, conversationHistory = [], ragContext, additionalContext, openai, maxTokens = 500 } = options;

  const systemContent = ragContext
    ? `${JCTM_SYSTEM_PROMPT}\n\nRelevant JCTM knowledge context:\n${ragContext}`
    : additionalContext
    ? `${JCTM_SYSTEM_PROMPT}\n\nContext: ${additionalContext}`
    : JCTM_SYSTEM_PROMPT;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...conversationHistory.slice(-8).map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: query },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    max_tokens: maxTokens,
    temperature: 0.7,
    presence_penalty: 0.1,
    frequency_penalty: 0.2,
  });

  return completion.choices[0]?.message?.content ?? "I'm unable to process your request right now. Please try again or visit Temple TV for guidance.";
}

export async function enhanceSermonSummary(
  title: string,
  description: string,
  openai: OpenAI,
): Promise<{ summary: string; bulletPoints: string[]; seoDescription: string }> {
  const prompt = `You are summarizing a sermon from Jesus Christ Temple Ministry (JCTM) for the digital platform.

Sermon Title: "${title}"
Description: "${description}"

Provide:
1. A 200-250 word pastoral summary (third person, present tense)
2. Exactly 5 key bullet points (doctrinal insights)
3. A 155-character SEO meta description

Format your response as JSON:
{
  "summary": "...",
  "bulletPoints": ["...", "...", "...", "...", "..."],
  "seoDescription": "..."
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 600,
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return {
      summary: parsed.summary ?? "",
      bulletPoints: parsed.bulletPoints ?? [],
      seoDescription: parsed.seoDescription ?? "",
    };
  } catch {
    return { summary: "", bulletPoints: [], seoDescription: "" };
  }
}
