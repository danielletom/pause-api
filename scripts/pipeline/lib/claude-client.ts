/**
 * Claude API client for the pipeline.
 * Uses the Vercel AI Gateway (matching src/lib/claude.ts pattern)
 */

import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { claude as config } from "../config";

interface GenerateOptions {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  model?: string;
}

export async function generate(options: GenerateOptions): Promise<string> {
  const modelId = options.model || config.defaultModel;
  // Use Vercel AI Gateway format: "anthropic/model-name"
  const gatewayModel = modelId.startsWith("anthropic/") ? modelId : `anthropic/${modelId}`;

  const { text } = await generateText({
    model: gateway(gatewayModel),
    maxOutputTokens: options.maxOutputTokens || config.maxOutputTokens,
    system: options.system,
    prompt: options.prompt,
  });

  return text.trim();
}

/**
 * Generate structured JSON output from Claude.
 */
export async function generateJSON<T>(options: GenerateOptions): Promise<T> {
  const result = await generate({
    ...options,
    system: `${options.system}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown fences, no explanation.`,
  });

  // Strip any accidental markdown fences
  const cleaned = result.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(cleaned) as T;
}
