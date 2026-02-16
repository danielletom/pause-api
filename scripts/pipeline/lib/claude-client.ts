/**
 * Claude API client for the pipeline.
 * Reuses the @ai-sdk/anthropic pattern from src/lib/claude.ts
 */

import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { claude as config } from "../config";

interface GenerateOptions {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
  model?: string;
}

export async function generate(options: GenerateOptions): Promise<string> {
  const { text } = await generateText({
    model: anthropic(options.model || config.defaultModel),
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
