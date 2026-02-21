/**
 * Stage 3: Audio Generation Agent
 *
 * Generates audio from scripts:
 * - ElevenLabs: lessons, affirmations, podcasts (two-voice)
 * - Wondercraft: meditations (with ambient music)
 */

import fs from "fs";
import path from "path";
import {
  generateSingleVoice,
  textToDialogue,
  parseScript,
} from "../lib/elevenlabs";
import { generateMeditation } from "../lib/wondercraft";
import { getContentItem, upsertPipelineStage } from "../lib/db";
import { paths } from "../config";
import type { ContentItem, ScriptOutput, AudioGenerationResult } from "../types";

/**
 * Load the written script for a content item.
 */
function loadScript(slug: string): ScriptOutput | null {
  const scriptPath = path.join(paths.scriptsOutput, `${slug}.json`);
  if (fs.existsSync(scriptPath)) {
    return JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  }
  return null;
}

/**
 * Check if audio already exists in staging.
 */
function audioExists(slug: string): boolean {
  return fs.existsSync(path.join(paths.audioStaging, `${slug}.mp3`));
}

/**
 * Generate audio for a single content item.
 */
export async function generateAudio(contentId: number): Promise<AudioGenerationResult> {
  const item = await getContentItem(contentId);
  if (!item) throw new Error(`Content item ${contentId} not found`);

  const slug = item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Skip non-audio content
  if (item.format !== "audio") {
    console.log(`  [audio] Skipping "${item.title}" — format is ${item.format}`);
    await upsertPipelineStage(contentId, "audio", {
      status: "completed",
      tool: "skip",
      metadata: { reason: "non-audio format" },
    });
    return { contentId, tool: "elevenlabs", outputPath: "", durationSeconds: 0, fileSizeBytes: 0 };
  }

  // Check if audio already exists
  if (audioExists(slug)) {
    console.log(`  [audio] Using cached audio for "${item.title}"`);
    const outputPath = path.join(paths.audioStaging, `${slug}.mp3`);
    const stats = fs.statSync(outputPath);
    await upsertPipelineStage(contentId, "audio", {
      status: "completed",
      tool: "cache",
      outputPath,
    });
    return { contentId, tool: "elevenlabs", outputPath, durationSeconds: 0, fileSizeBytes: stats.size };
  }

  // Load script
  const scriptOutput = loadScript(slug);
  if (!scriptOutput) {
    throw new Error(`No script found for "${item.title}" — run the writer stage first`);
  }

  console.log(`  [audio] Generating ${item.contentType} audio for "${item.title}"...`);

  await upsertPipelineStage(contentId, "audio", {
    status: "in_progress",
    tool: getTool(item),
  });

  try {
    let result: AudioGenerationResult;

    switch (item.contentType) {
      case "meditation":
        result = await generateMeditationAudio(item, scriptOutput, slug);
        break;

      case "podcast":
        result = await generatePodcastAudio(item, scriptOutput, slug);
        break;

      case "lesson":
      case "affirmation":
      default:
        result = await generateSingleVoiceAudio(item, scriptOutput, slug);
        break;
    }

    await upsertPipelineStage(contentId, "audio", {
      status: "completed",
      tool: result.tool,
      outputPath: result.outputPath,
      metadata: { fileSizeBytes: result.fileSizeBytes },
    });

    console.log(`  [audio] Done — ${result.outputPath} (${(result.fileSizeBytes / 1024 / 1024).toFixed(1)} MB)`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await upsertPipelineStage(contentId, "audio", {
      status: "failed",
      tool: getTool(item),
      errorMessage: message,
    });
    throw error;
  }
}

// ── Audio Generation by Type ────────────────────────────────────────────────

async function generateMeditationAudio(
  item: ContentItem,
  scriptOutput: ScriptOutput,
  slug: string
): Promise<AudioGenerationResult> {
  // Build a rich prompt for Wondercraft's AI — include the script content
  // plus instructions for meditation-specific delivery (pacing, emotion, pauses).
  // Wondercraft's AI will handle the actual expression and spacing.
  const prompt = `Create a ${item.durationMinutes || 15}-minute guided meditation called "${item.title}".

${item.description ? `Context: ${item.description}` : ""}

Use the following script as the basis for the meditation. Deliver it with a calm, warm, soothing voice. Add natural pauses between sections, slow pacing, and gentle breathing cues. This is for women going through perimenopause and menopause — the tone should be compassionate and grounding, never clinical.

SCRIPT:
${scriptOutput.script}`;

  return generateMeditation(
    prompt,
    item.id,
    slug,
    item.title,
    paths.audioStaging
  );
}

async function generatePodcastAudio(
  item: ContentItem,
  scriptOutput: ScriptOutput,
  slug: string
): Promise<AudioGenerationResult> {
  // Parse two-host script into segments
  const segments = parseScript(scriptOutput.script);

  if (segments.length === 0) {
    throw new Error(`Failed to parse speaker segments from podcast script for "${item.title}"`);
  }

  console.log(`  [audio] Parsed ${segments.length} speaker segments — using Text to Dialogue API`);

  // Generate a single audio file with natural speaker transitions
  const outputPath = path.join(paths.audioStaging, `${slug}.mp3`);
  await textToDialogue(segments, outputPath);

  const stats = fs.statSync(outputPath);
  return {
    contentId: item.id,
    tool: "elevenlabs-dialogue",
    outputPath,
    durationSeconds: 0,
    fileSizeBytes: stats.size,
  };
}

async function generateSingleVoiceAudio(
  item: ContentItem,
  scriptOutput: ScriptOutput,
  slug: string
): Promise<AudioGenerationResult> {
  // Strip any cues that are just for the script
  const cleanScript = scriptOutput.script
    .replace(/\[PAUSE \d+s\]/g, "...")
    .replace(/\[MUSIC:[^\]]+\]/g, "")
    .replace(/\[BREATHE[^\]]+\]/g, "...take a deep breath...")
    .replace(/^##\s+.+$/gm, ""); // Remove markdown headers

  return generateSingleVoice(
    cleanScript,
    item.id,
    slug,
    paths.audioStaging
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getTool(item: ContentItem): string {
  if (item.contentType === "meditation") return "wondercraft";
  return "elevenlabs";
}

/**
 * Concatenate multiple audio files using ffmpeg.
 */
async function concatenateAudio(inputPaths: string[], outputPath: string): Promise<void> {
  const { execSync } = await import("child_process");

  // Create a concat list file for ffmpeg
  const listPath = outputPath.replace(".mp3", "-concat.txt");
  const listContent = inputPaths.map((p) => `file '${p}'`).join("\n");
  fs.writeFileSync(listPath, listContent);

  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${listPath}" -acodec libmp3lame -ab 128k "${outputPath}"`,
    { stdio: "pipe" }
  );

  // Clean up
  fs.unlinkSync(listPath);
}
