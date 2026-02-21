/**
 * Wondercraft AI API client.
 * Used for: guided meditations with ambient music.
 *
 * Uses the AI-scripted endpoint (POST /podcast) which lets Wondercraft's AI
 * handle pacing, pauses, emotion, and expression — producing much more
 * natural meditation audio than raw script segments.
 *
 * API docs: https://docs.wondercraft.ai/api-reference/introduction
 * Base URL: https://api.wondercraft.ai/v1
 * Auth: X-API-KEY header
 */

import fs from "fs";
import path from "path";
import { wondercraft as config } from "../config";
import type { AudioGenerationResult } from "../types";

const BASE_URL = "https://api.wondercraft.ai/v1";

function headers() {
  return {
    "X-API-KEY": config.apiKey,
    "Content-Type": "application/json",
  };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Create an AI-scripted meditation using POST /podcast.
 * Wondercraft's AI handles pacing, pauses, emotion, and delivery.
 * Returns a job_id for polling.
 */
async function createAiJob(
  prompt: string,
  voiceId: string,
  musicId?: string
): Promise<string> {
  const body: Record<string, unknown> = {
    prompt,
    voice_ids: [voiceId],
  };

  if (musicId) {
    body.music_spec = {
      music_id: musicId,
      volume: config.musicVolume,
      fade_in_ms: 3000,
      fade_out_ms: 5000,
    };
  }

  console.log(`  [wondercraft] Sending AI prompt (${prompt.length} chars)...`);

  const res = await fetch(`${BASE_URL}/podcast`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Wondercraft AI job failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return data.job_id;
}

/**
 * Create a scripted meditation using POST /podcast/scripted.
 * For when you want exact control over the script content.
 * Returns a job_id for polling.
 */
async function createScriptedJob(
  script: string,
  voiceId: string,
  musicId?: string
): Promise<string> {
  const segments = script
    .split(/\n\n+/)
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((text) => ({
      text,
      voice_id: voiceId,
    }));

  const body: Record<string, unknown> = {
    script: segments,
  };

  if (musicId) {
    body.music_spec = {
      music_id: musicId,
      volume: config.musicVolume,
      fade_in_ms: 3000,
      fade_out_ms: 5000,
    };
  }

  console.log(`  [wondercraft] Sending ${segments.length} script segments...`);

  const res = await fetch(`${BASE_URL}/podcast/scripted`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Wondercraft scripted job failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return data.job_id;
}

/**
 * Poll for job completion and get download URL.
 * GET /podcast/{job_id} → { job_id, finished, error, url }
 */
async function waitForCompletion(
  jobId: string,
  maxWaitMs: number = 600000 // 10 minutes
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const res = await fetch(`${BASE_URL}/podcast/${jobId}`, {
      headers: headers(),
    });

    if (!res.ok) throw new Error(`Wondercraft status check failed: ${res.status}`);

    const data = await res.json();

    if (data.error) {
      throw new Error(`Wondercraft generation failed for job ${jobId}`);
    }

    if (data.finished && data.url) {
      return data.url;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  [wondercraft] Still processing... (${elapsed}s elapsed)`);

    await delay(10000);
  }

  throw new Error(`Wondercraft generation timed out after ${maxWaitMs / 1000}s`);
}

/**
 * Download the generated audio file.
 */
async function downloadAudio(url: string, outputPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
}

/**
 * Generate a meditation audio using Wondercraft's AI.
 *
 * Uses the AI-scripted endpoint by default — pass the meditation description
 * as a prompt and let Wondercraft's AI handle pacing, emotion, pauses, and
 * expression. This produces much more natural meditation audio.
 *
 * Set useAiScript=false to use the scripted endpoint instead (for exact
 * script control, though with less natural delivery).
 */
export async function generateMeditation(
  script: string,
  contentId: number,
  slug: string,
  title: string,
  outputDir: string,
  musicId?: string,
  useAiScript: boolean = true
): Promise<AudioGenerationResult> {
  const voiceId = config.voiceProfile;

  let jobId: string;
  if (useAiScript) {
    console.log(`  [wondercraft] Creating AI-scripted job for "${title}"...`);
    jobId = await createAiJob(script, voiceId, musicId);
  } else {
    console.log(`  [wondercraft] Creating scripted job for "${title}"...`);
    jobId = await createScriptedJob(script, voiceId, musicId);
  }

  console.log(`  [wondercraft] Job created (${jobId}) — waiting for generation...`);
  const downloadUrl = await waitForCompletion(jobId);

  const outputPath = path.join(outputDir, `${slug}.mp3`);
  console.log(`  [wondercraft] Downloading to ${outputPath}...`);
  await downloadAudio(downloadUrl, outputPath);

  const stats = fs.statSync(outputPath);
  return {
    contentId,
    tool: "wondercraft",
    outputPath,
    durationSeconds: 0,
    fileSizeBytes: stats.size,
  };
}
