/**
 * Wondercraft AI API client.
 * Used for: guided meditations with ambient music.
 *
 * Note: Wondercraft's API may require checking their latest docs for
 * exact endpoints. This implements the expected interface — adjust
 * endpoints/payloads as needed once you have API access.
 */

import fs from "fs";
import path from "path";
import { wondercraft as config } from "../config";
import type { AudioGenerationResult } from "../types";

const BASE_URL = "https://api.wondercraft.ai/v1";

function headers() {
  return {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Create a meditation audio project in Wondercraft.
 * Returns a project/job ID for polling.
 */
async function createProject(
  script: string,
  title: string,
  backgroundMusic: string = config.defaultBackgroundMusic
): Promise<string> {
  const res = await fetch(`${BASE_URL}/projects`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      title,
      script,
      voice: config.voiceProfile,
      background_music: backgroundMusic,
      music_volume: config.musicVolume,
      output_format: "mp3",
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Wondercraft create project failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return data.project_id || data.id;
}

/**
 * Poll for project completion and get download URL.
 */
async function waitForCompletion(
  projectId: string,
  maxWaitMs: number = 300000 // 5 minutes
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const res = await fetch(`${BASE_URL}/projects/${projectId}`, {
      headers: headers(),
    });

    if (!res.ok) throw new Error(`Wondercraft status check failed: ${res.status}`);

    const data = await res.json();
    if (data.status === "completed" && data.download_url) {
      return data.download_url;
    }
    if (data.status === "failed") {
      throw new Error(`Wondercraft generation failed: ${data.error || "unknown error"}`);
    }

    // Poll every 5 seconds
    await delay(5000);
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
 * Generate a meditation audio with background music.
 * Full flow: create → poll → download.
 */
export async function generateMeditation(
  script: string,
  contentId: number,
  slug: string,
  title: string,
  outputDir: string,
  backgroundMusic?: string
): Promise<AudioGenerationResult> {
  console.log(`  [wondercraft] Creating project for "${title}"...`);
  const projectId = await createProject(script, title, backgroundMusic);

  console.log(`  [wondercraft] Waiting for generation (project: ${projectId})...`);
  const downloadUrl = await waitForCompletion(projectId);

  const outputPath = path.join(outputDir, `${slug}.mp3`);
  console.log(`  [wondercraft] Downloading to ${outputPath}...`);
  await downloadAudio(downloadUrl, outputPath);

  const stats = fs.statSync(outputPath);
  return {
    contentId,
    tool: "wondercraft",
    outputPath,
    durationSeconds: 0, // calculated by ffprobe in producer
    fileSizeBytes: stats.size,
  };
}
