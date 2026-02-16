/**
 * ElevenLabs API client.
 * - Text to Dialogue: podcasts (multi-speaker, natural transitions)
 * - Text to Speech: lessons, affirmations (single voice)
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

// ── Text Cleaning ────────────────────────────────────────────────────────────

/**
 * Clean script text for TTS: strip markdown, convert cues to speech-friendly form.
 */
function cleanForTTS(text: string): string {
  let cleaned = text;
  // Strip markdown bold/italic
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");
  // Convert [pause] to a natural break
  cleaned = cleaned.replace(/\[pause\]/gi, "...");
  // Convert [laughs] [sighs] to audio tags (supported by eleven_v3 dialogue)
  cleaned = cleaned.replace(/\[laughs?\]/gi, "[laughing]");
  cleaned = cleaned.replace(/\[sighs?\]/gi, "[sighing]");
  // Strip any other unsupported stage directions in brackets
  cleaned = cleaned.replace(/\[((?!laughing|whispering|sighing|sad|applause)[^\]]+)\]/g, "");
  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

// ── Text to Dialogue API (Podcasts) ──────────────────────────────────────────

/**
 * Make a single Text to Dialogue API call.
 * Max 5000 chars per request.
 */
async function dialogueApiCall(
  inputs: { text: string; voice_id: string }[],
  outputFormat: string,
  seed?: number
): Promise<Buffer> {
  const body: Record<string, unknown> = {
    inputs,
    model_id: "eleven_v3",
  };
  if (seed !== undefined) body.seed = seed;

  const res = await fetch(
    `${BASE_URL}/text-to-dialogue?output_format=${outputFormat}`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`ElevenLabs Text to Dialogue failed (${res.status}): ${errorBody}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

/**
 * Split segments into chunks that fit within the 5000 char API limit.
 */
function chunkSegments(
  inputs: { text: string; voice_id: string }[],
  maxChars: number = 4800 // leave some headroom
): { text: string; voice_id: string }[][] {
  const chunks: { text: string; voice_id: string }[][] = [];
  let currentChunk: { text: string; voice_id: string }[] = [];
  let currentChars = 0;

  for (const input of inputs) {
    const inputChars = input.text.length;
    if (currentChars + inputChars > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChars = 0;
    }
    currentChunk.push(input);
    currentChars += inputChars;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Generate a multi-speaker dialogue audio file using the Text to Dialogue API.
 * Automatically chunks long scripts and concatenates the audio.
 * Requires eleven_v3 model.
 */
export async function textToDialogue(
  segments: AudioSegment[],
  outputPath: string,
  options?: {
    outputFormat?: string;
    seed?: number;
  }
): Promise<string> {
  const outputFormat = options?.outputFormat || "mp3_44100_128";

  // Build dialogue inputs
  const allInputs = segments.map((seg) => ({
    text: cleanForTTS(seg.text),
    voice_id: seg.speaker === "Mel" ? config.hostMelVoiceId : config.hostRachVoiceId,
  }));

  const totalChars = allInputs.reduce((sum, i) => sum + i.text.length, 0);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  if (totalChars <= 4800) {
    // Single API call — fits within limit
    const buffer = await dialogueApiCall(allInputs, outputFormat, options?.seed);
    fs.writeFileSync(outputPath, buffer);
    console.log(`  [dialogue] Generated ${(buffer.length / 1024 / 1024).toFixed(1)} MB → ${outputPath}`);
    return outputPath;
  }

  // Split into chunks and generate each
  const chunks = chunkSegments(allInputs);
  console.log(`  [dialogue] Script is ${totalChars} chars — splitting into ${chunks.length} chunks`);

  const chunkPaths: string[] = [];
  const chunkDir = outputPath.replace(".mp3", "-chunks");
  fs.mkdirSync(chunkDir, { recursive: true });

  for (let i = 0; i < chunks.length; i++) {
    const chunkChars = chunks[i].reduce((sum, inp) => sum + inp.text.length, 0);
    console.log(`  [dialogue] Chunk ${i + 1}/${chunks.length} (${chunkChars} chars, ${chunks[i].length} segments)...`);

    const buffer = await dialogueApiCall(chunks[i], outputFormat, options?.seed);
    const chunkPath = path.join(chunkDir, `chunk-${String(i).padStart(3, "0")}.mp3`);
    fs.writeFileSync(chunkPath, buffer);
    chunkPaths.push(chunkPath);

    // Rate limit between chunks
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Concatenate chunks using ffmpeg
  const { execSync } = await import("child_process");
  const listPath = path.join(chunkDir, "concat.txt");
  const listContent = chunkPaths.map((p) => `file '${path.resolve(p)}'`).join("\n");
  fs.writeFileSync(listPath, listContent);

  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${listPath}" -acodec libmp3lame -ab 128k "${outputPath}"`,
    { stdio: "pipe" }
  );

  // Clean up chunk files
  for (const cp of chunkPaths) fs.unlinkSync(cp);
  fs.unlinkSync(listPath);
  fs.rmdirSync(chunkDir);

  const stats = fs.statSync(outputPath);
  console.log(`  [dialogue] Generated ${(stats.size / 1024 / 1024).toFixed(1)} MB (${chunks.length} chunks) → ${outputPath}`);
  return outputPath;
}

// ── Text to Speech API (Single Voice) ────────────────────────────────────────

/**
 * Generate speech for a single text block.
 */
export async function textToSpeech(
  text: string,
  voiceId: string,
  outputPath: string
): Promise<string> {
  const cleanedText = cleanForTTS(text);
  const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      text: cleanedText,
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
    durationSeconds: 0, // calculated by ffprobe in producer stage
    fileSizeBytes: stats.size,
  };
}

// ── Script Parsing ───────────────────────────────────────────────────────────

/**
 * Parse a two-host script into audio segments.
 * Expects format like:
 *   Mel: "Hello and welcome..."
 *   Rach: "Thanks Mel, today we're..."
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

    // Match speaker label patterns: "Mel:" or "**Mel:**" or "Rach:" or "**Rach:**"
    const speakerMatch = trimmed.match(/^\*?\*?(Mel|Rach)\*?\*?:\s*(.*)/i);
    if (speakerMatch) {
      // Save previous segment
      if (currentSpeaker && currentText.trim()) {
        segments.push({
          speaker: currentSpeaker,
          text: currentText.trim(),
          index: index++,
        });
      }
      currentSpeaker = speakerMatch[1].toLowerCase().includes("rach") ? "Rach" : "Mel";
      currentText = speakerMatch[2] || "";
      continue;
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

// ── Legacy two-voice (kept for fallback) ─────────────────────────────────────

/**
 * Generate two-voice podcast audio using individual TTS calls + concatenation.
 * @deprecated Use textToDialogue() instead — it produces much more natural results.
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
      segment.speaker === "Mel" ? config.hostMelVoiceId : config.hostRachVoiceId;

    const segmentPath = path.join(
      segmentDir,
      `${String(segment.index).padStart(3, "0")}-${segment.speaker.toLowerCase()}.mp3`
    );

    await textToSpeech(segment.text, voiceId, segmentPath);
    segmentPaths.push(segmentPath);
    await new Promise((r) => setTimeout(r, 500));
  }

  return segmentPaths;
}

// ── Utility ──────────────────────────────────────────────────────────────────

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
