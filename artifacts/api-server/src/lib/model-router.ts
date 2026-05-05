/**
 * Model Router — Local AI Abstraction Layer
 *
 * Routes inference requests through the correct tier:
 *   Tier 1: Local AI Engine  (sub-millisecond, exact/keyword match)
 *   Tier 2: RAG search       (semantic vector similarity, local embeddings)
 *   Tier 3: Local enhancer   (JCTM knowledge templates + in-house AI engine)
 *
 * Zero external API calls. No OpenAI dependency.
 */

import { runLocalInference, type LocalInferenceResult } from "./local-ai-engine.js";
import { localAIEnhancer } from "./local-ai-enhancer.js";

export type ModelTier = "local" | "rag" | "local-enhanced";

export interface RouteResult {
  answer: string;
  tier: ModelTier;
  confidence: number;
  latencyMs: number;
}

export interface RouterOptions {
  query: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  context?: string;
  ragResults?: string;
}

const COMPLEX_QUERY_SIGNALS = [
  "why", "how does", "explain", "what does it mean", "interpret",
  "difference between", "compare", "is it biblical", "scripture says",
  "is it sin", "should i", "counsel", "advice", "help me",
  "i feel", "i am struggling", "i need", "depression", "grief",
  "healing", "miracle", "deliverance",
];

const SHORT_QUERY_THRESHOLD = 15;

function assessComplexity(query: string): "simple" | "moderate" | "complex" {
  const lower = query.toLowerCase();
  const wordCount = query.trim().split(/\s+/).length;

  if (wordCount < SHORT_QUERY_THRESHOLD) {
    const hasComplexSignal = COMPLEX_QUERY_SIGNALS.some(s => lower.includes(s));
    if (!hasComplexSignal) return "simple";
  }

  const complexSignalCount = COMPLEX_QUERY_SIGNALS.filter(s => lower.includes(s)).length;
  if (complexSignalCount >= 2 || wordCount > 40) return "complex";
  if (complexSignalCount >= 1) return "moderate";
  return "simple";
}

export async function routeQuery(options: RouterOptions): Promise<RouteResult> {
  const start = Date.now();
  const { query, conversationHistory, context, ragResults } = options;

  const complexity = assessComplexity(query);

  // Tier 1: High-confidence local match
  if (complexity === "simple") {
    const localResult: LocalInferenceResult = runLocalInference(query);
    if (localResult.confidence > 0.7) {
      return {
        answer: localResult.response ?? "",
        tier: "local",
        confidence: localResult.confidence,
        latencyMs: Date.now() - start,
      };
    }
  }

  // Tier 2: RAG results available (local embeddings)
  if (ragResults && ragResults.length > 50) {
    if (complexity !== "complex" && !conversationHistory?.length) {
      const ragAnswer = buildRagAnswer(query, ragResults);
      if (ragAnswer) {
        return {
          answer: ragAnswer,
          tier: "rag",
          confidence: 0.75,
          latencyMs: Date.now() - start,
        };
      }
    }
  }

  // Tier 3: Local enhanced (templates + knowledge base)
  const answer = await localAIEnhancer({
    query,
    conversationHistory,
    ragContext: ragResults,
    additionalContext: context,
  });

  return {
    answer,
    tier: "local-enhanced",
    confidence: 0.85,
    latencyMs: Date.now() - start,
  };
}

function buildRagAnswer(query: string, ragContext: string): string | null {
  if (!ragContext || ragContext.length < 50) return null;

  const lines = ragContext.split("\n").filter(l => l.trim().length > 20);
  if (lines.length === 0) return null;

  return `Based on JCTM's teachings: ${lines.slice(0, 3).join(" ")}

For deeper insight on this topic, you may ask TempleBots a follow-up question or visit Temple TV at youtube.com/@TEMPLETVJCTM for sermons by Prophet Amos Evomobor.`;
}
