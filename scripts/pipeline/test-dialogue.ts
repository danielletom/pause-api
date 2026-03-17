/**
 * Test the Text to Dialogue API with Jessica (Mel) + different Rach voices.
 * Usage: npx tsx --env-file=.env.local scripts/pipeline/test-dialogue.ts
 */

import { parseScript } from "./lib/elevenlabs";
import { elevenlabs as config } from "./config";
import fs from "fs";
import path from "path";

const BASE_URL = "https://api.elevenlabs.io/v1";
const MEL_VOICE = "cgSgspJ2msm6clMCkdW9"; // Jessica — locked in

function cleanForTTS(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");
  cleaned = cleaned.replace(/\[pause\]/gi, "...");
  cleaned = cleaned.replace(/\[laughs?\]/gi, "[laughing]");
  cleaned = cleaned.replace(/\[sighs?\]/gi, "[sighing]");
  cleaned = cleaned.replace(/\[((?!laughing|whispering|sighing|sad|applause)[^\]]+)\]/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

interface RachOption {
  voiceId: string;
  name: string;
  desc: string;
}

const RACH_OPTIONS: Record<string, RachOption> = {
  "rach-sarah": {
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah",
    desc: "Mature, Reassuring, Confident",
  },
  "rach-lily": {
    voiceId: "pFZP5JQG7iQjIQuC4Bku",
    name: "Lily",
    desc: "Velvety Actress",
  },
  "rach-laura": {
    voiceId: "FGY2WhTYpPnrIDTdsKH5",
    name: "Laura",
    desc: "Enthusiastic, Quirky",
  },
  "rach-bella": {
    voiceId: "hpp4J3VqNfWAUOO0d1Us",
    name: "Bella",
    desc: "Professional, Bright, Warm",
  },
};

async function generateDialogue(
  segments: { speaker: string; text: string; index: number }[],
  rachVoiceId: string,
  outputPath: string
): Promise<void> {
  const inputs = segments.map((seg) => ({
    text: cleanForTTS(seg.text),
    voice_id: seg.speaker === "Mel" ? MEL_VOICE : rachVoiceId,
  }));

  const res = await fetch(
    `${BASE_URL}/text-to-dialogue?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs,
        model_id: "eleven_v3",
      }),
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Dialogue API failed (${res.status}): ${errorBody}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
}

async function main() {
  const scriptPath = "scripts/pipeline/data/scripts-output/the-34-symptoms-you-didn-t-know-about.json";
  const scriptData = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const segments = parseScript(scriptData.script);

  // First 8 segments — enough to hear the conversation flow
  const testSegments = segments.slice(0, 8);
  console.log(`Testing with ${testSegments.length} segments (Jessica as Mel for all)\n`);

  const outDir = "scripts/pipeline/data/audio-staging";

  for (const [key, opt] of Object.entries(RACH_OPTIONS)) {
    const outputPath = path.join(outDir, `dialogue-${key}.mp3`);
    console.log(`━━━ ${opt.name} as Rach — ${opt.desc} ━━━`);

    const start = Date.now();
    try {
      await generateDialogue(testSegments, opt.voiceId, outputPath);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const stats = fs.statSync(outputPath);
      console.log(`  ✓ ${elapsed}s — ${(stats.size / 1024 / 1024).toFixed(1)} MB → ${outputPath}\n`);
    } catch (err) {
      console.log(`  ✗ Failed: ${err instanceof Error ? err.message.substring(0, 120) : err}\n`);
    }
  }

  console.log("Done! Compare these files:");
  for (const [key, opt] of Object.entries(RACH_OPTIONS)) {
    console.log(`  ${key}: Jessica (Mel) + ${opt.name} (Rach) — ${opt.desc}`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
