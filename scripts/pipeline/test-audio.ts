/**
 * Quick audio test — Jessica (Mel) + best Rach options, with tuned voice settings.
 * Tests different voice settings to reduce robotic quality.
 * Usage: npx tsx --env-file=.env.local scripts/pipeline/test-audio.ts
 */

import { parseScript } from "./lib/elevenlabs";
import { elevenlabs as config } from "./config";
import fs from "fs";
import path from "path";

const BASE_URL = "https://api.elevenlabs.io/v1";

/**
 * Clean script text for TTS (same as elevenlabs.ts)
 */
function cleanForTTS(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");
  cleaned = cleaned.replace(/\[pause\]/gi, "...");
  cleaned = cleaned.replace(/\[laughs?\]/gi, "(laughs)");
  cleaned = cleaned.replace(/\[sighs?\]/gi, "(sighs)");
  cleaned = cleaned.replace(/\[([^\]]+)\]/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

/**
 * TTS with custom voice settings (overrides config defaults)
 */
async function ttsWithSettings(
  text: string,
  voiceId: string,
  outputPath: string,
  settings: {
    modelId: string;
    stability: number;
    similarityBoost: number;
    style: number;
    speakerBoost: boolean;
  }
): Promise<void> {
  const cleanedText = cleanForTTS(text);
  const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: cleanedText,
      model_id: settings.modelId,
      voice_settings: {
        stability: settings.stability,
        similarity_boost: settings.similarityBoost,
        style: settings.style,
        use_speaker_boost: settings.speakerBoost,
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
}

// Jessica = Mel, try different Rach voices & settings combos
const MEL_VOICE = "cgSgspJ2msm6clMCkdW9"; // Jessica

interface TestCombo {
  rachVoice: string;
  rachName: string;
  desc: string;
  settings: {
    modelId: string;
    stability: number;
    similarityBoost: number;
    style: number;
    speakerBoost: boolean;
  };
}

const TEST_COMBOS: Record<string, TestCombo> = {
  // Test 1: Jessica + Cassidy — your pick! Expressive settings
  "test-1-cassidy-expressive": {
    rachVoice: "56AoDkrOh6qfVPDXZ7Pt", // Cassidy
    rachName: "Cassidy",
    desc: "Jessica + Cassidy — expressive (stability 0.3, style 0.5)",
    settings: {
      modelId: "eleven_multilingual_v2",
      stability: 0.3,
      similarityBoost: 0.6,
      style: 0.5,
      speakerBoost: true,
    },
  },
  // Test 2: Jessica + Cassidy — turbo model for more natural English
  "test-2-cassidy-turbo": {
    rachVoice: "56AoDkrOh6qfVPDXZ7Pt", // Cassidy
    rachName: "Cassidy",
    desc: "Jessica + Cassidy — TURBO v2.5 model (more natural English)",
    settings: {
      modelId: "eleven_turbo_v2_5",
      stability: 0.35,
      similarityBoost: 0.65,
      style: 0.4,
      speakerBoost: true,
    },
  },
  // Test 3: Jessica + Cassidy — ultra expressive (push the dials)
  "test-3-cassidy-ultra": {
    rachVoice: "56AoDkrOh6qfVPDXZ7Pt", // Cassidy
    rachName: "Cassidy",
    desc: "Jessica + Cassidy — ULTRA expressive (stability 0.2, style 0.7)",
    settings: {
      modelId: "eleven_multilingual_v2",
      stability: 0.2,
      similarityBoost: 0.5,
      style: 0.7,
      speakerBoost: true,
    },
  },
  // Test 4: Jessica + Sarah for comparison
  "test-4-sarah-expressive": {
    rachVoice: "EXAVITQu4vr4xnSDxMaL", // Sarah
    rachName: "Sarah",
    desc: "Jessica + Sarah — expressive (for comparison)",
    settings: {
      modelId: "eleven_multilingual_v2",
      stability: 0.3,
      similarityBoost: 0.6,
      style: 0.5,
      speakerBoost: true,
    },
  },
};

async function main() {
  const scriptPath = "scripts/pipeline/data/scripts-output/the-34-symptoms-you-didn-t-know-about.json";
  const scriptData = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const segments = parseScript(scriptData.script);

  console.log(`Total segments: ${segments.length}`);
  const testSegments = segments.slice(0, 4);

  for (const [comboName, combo] of Object.entries(TEST_COMBOS)) {
    console.log(`\n━━━ ${comboName}: ${combo.desc} ━━━`);
    const outDir = `scripts/pipeline/data/audio-staging/${comboName}`;
    fs.mkdirSync(outDir, { recursive: true });

    for (const seg of testSegments) {
      const voiceId = seg.speaker === "Mel" ? MEL_VOICE : combo.rachVoice;
      const filename = `${String(seg.index).padStart(3, "0")}-${seg.speaker.toLowerCase()}.mp3`;
      const outPath = path.join(outDir, filename);

      console.log(`  ${seg.speaker} (seg ${seg.index}): "${seg.text.substring(0, 60)}..."`);
      await ttsWithSettings(seg.text, voiceId, outPath, combo.settings);
      console.log(`    → ${outPath}`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log("\n✓ Done! Listen to the 4 tests:");
  for (const [name, combo] of Object.entries(TEST_COMBOS)) {
    console.log(`  ${name}: ${combo.desc}`);
  }
  console.log("\nAll files in: scripts/pipeline/data/audio-staging/test-*");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
