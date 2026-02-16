/**
 * ElevenLabs Text-to-Speech API client.
 * Used for: audio lessons, affirmations, podcast two-voice.
 */

import fs from "fs";
import path from "path";
import { elevenlabs as config } from "../config";
import type { AudioSegment, AudioGenerationResult } from "../types";

const BASE_URL = "https://api.elevenlabs.io/v1";

function headers() {
  return {
    "xi-api-key": config.apiKey,
    "Content-Type": "application/json",
  };
}

/**
 * Generate speech for a single text block.
 * Returns the audio file path.
 */
export async function textToSpeech(
  text: string,
  voiceId: string,
  outputPath: string
): Promise<string> {
  const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      text,
      model_id: config.modelId,
      voice_settings: {
        stability: config.stability,
        similarity_boost: config.similarityBoost,
        style: config.style,
        use_speaker_boost: config.speakerBoost,
      },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${errorBody}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

/**
 * Generate single-voice audio (lessons, affirmations).
 */
export async function generateSingleVoice(
  script: string,
  contentId: number,
  slug: string,
  outputDir: string
): Promise<AudioGenerationResult> {
  const outputPath = path.join(outputDir, `${slug}.mp3`);
  await textToSpeech(script, config.narratorVoiceId, outputPath);

  const stats = fs.statSync(outputPath);
  return {
    contentId,
    tool: "elevenlabs",
    outputPath,
    durationSeconds: 0, // will be calculated by ffprobe in producer stage
    fileSizeBytes: stats.size,
  };
}

/**
 * Generate two-voice podcast audio.
 * Parses speaker labels from script, generates each segment, returns segment paths.
 */
export async function generateTwoVoice(
  segments: AudioSegment[],
  slug: string,
  outputDir: string
): Promise<string[]> {
  const segmentPaths: string[] = [];
  const segmentDir = path.join(outputDir, `${slug}-segments`);
  fs.mkdirSync(segmentDir, { recursive: true });

  for (const segment of segments) {
    const voiceId =
      segment.speaker === "Alex" ? config.hostAlexVoiceId : config.hostSamVoiceId;

    const segmentPath = path.join(
      segmentDir,
      `${String(segment.index).padStart(3, "0")}-${segment.speaker.toLowerCase()}.mp3`
    );

    await textToSpeech(segment.text, voiceId, segmentPath);
    segmentPaths.push(segmentPath);

    // Rate limit: ElevenLabs has per-second limits
    await new Promise((r) => setTimeout(r, 500));
  }

  return segmentPaths;
}

/**
 * Parse a two-host script into audio segments.
 * Expects format like:
 *   Alex: "Hello and welcome..."
 *   Sam: "Thanks Alex, today we're..."
 */
export function parseScript(script: string): AudioSegment[] {
  const segments: AudioSegment[] = [];
  const lines = script.split("\n");
  let currentSpeaker = "";
  let currentText = "";
  let index = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match speaker label patterns: "Alex:" or "**Alex:**" or "ALEX:"
    const speakerMatch = trimmed.match(/^\*?\*?(\w+)\*?\*?:\s*(.*)/);
    if (speakerMatch) {
      const speaker = speakerMatch[1];
      if (["Alex", "Sam", "ALEX", "SAM"].includes(speaker)) {
        // Save previous segment
        if (currentSpeaker && currentText.trim()) {
          segments.push({
            speaker: currentSpeaker,
            text: currentText.trim(),
            index: index++,
          });
        }
        currentSpeaker = speaker.charAt(0).toUpperCase() + speaker.slice(1).toLowerCase();
        currentText = speakerMatch[2] || "";
        continue;
      }
    }

    // Continuation of current speaker's text
    if (currentSpeaker) {
      currentText += " " + trimmed;
    }
  }

  // Don't forget the last segment
  if (currentSpeaker && currentText.trim()) {
    segments.push({
      speaker: currentSpeaker,
      text: currentText.trim(),
      index: index++,
    });
  }

  return segments;
}

/**
 * List available voices (for setup/selection).
 */
export async function listVoices(): Promise<{ voice_id: string; name: string; category: string }[]> {
  const res = await fetch(`${BASE_URL}/voices`, { headers: headers() });
  if (!res.ok) throw new Error(`ElevenLabs list voices failed: ${res.status}`);
  const data = await res.json();
  return data.voices.map((v: { voice_id: string; name: string; category: string }) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category,
  }));
}
