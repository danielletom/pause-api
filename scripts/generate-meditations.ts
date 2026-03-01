/**
 * Generate meditation audio for the 3 missing meditations using ElevenLabs TTS,
 * then assign all 4 meditations to their program days.
 *
 * Usage:
 *   export $(grep -E 'NEON_DATABASE_URL|ELEVENLABS_API_KEY' .env.local | xargs)
 *   npx tsx scripts/generate-meditations.ts
 */

import { neon } from "@neondatabase/serverless";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { execSync } from "child_process";

const sql = neon(process.env.NEON_DATABASE_URL as string);

const VOICE_ID = "Atp5cNFg1Wj5gyKD7HWV"; // Natasha's Gentle Meditation
const API_KEY = process.env.ELEVENLABS_API_KEY as string;
const AUDIO_DIR = "public/audio/meditations";
const BASE_URL = "https://pause-api-seven.vercel.app/audio/meditations";

// Meditation day assignments:
// Sleep Body Scan → Day 6 (sleep theme), Phase 2
// Morning Energy Activation → Day 10 (exercise theme), Phase 4
// Self-Compassion Practice → Day 9 (mood theme), Phase 3
// Manifestation & Future Self → Day 14 (graduation), Phase 5
const MEDITATIONS = [
  {
    slug: "sleep-body-scan",
    programDay: 6,
    programWeek: 2,
    needsAudio: false, // already has audio
  },
  {
    slug: "morning-energy-activation",
    programDay: 10,
    programWeek: 4,
    needsAudio: true,
    filename: "morning-energy-activation.mp3",
    script: `Welcome. Find a comfortable position — sitting or standing, wherever you are.

Take a slow breath in through your nose... and out through your mouth.

This is your morning energy activation. A gentle way to wake up your body and greet the day ahead.

Let's begin with your feet. Press them gently into the floor. Feel the ground beneath you — solid, steady, supporting you.

Now bring your awareness up to your legs. Give your thighs a gentle squeeze if you like. Feel the strength there. These legs carry you through every day.

Take another deep breath in... and let it go.

Roll your shoulders back — one... two... three slow circles. Feel the tension releasing from your neck and upper back. You might hear a little pop or crack. That's okay. Your body is waking up.

Now stretch your arms overhead. Reach up tall, like you're trying to touch the ceiling. Stretch through your fingertips. Hold it... and release.

Bring your hands to your heart. Feel it beating. Steady and strong. Your heart has been working for you all night, keeping everything running while you rested.

Take a moment to set a simple intention for today. Not a to-do list. Just one word or feeling you want to carry with you. Maybe it's calm. Maybe it's strength. Maybe it's patience. Whatever comes to mind first — that's your word.

Take one more deep breath in, filling your lungs completely... and exhale slowly.

You are awake. You are here. You are ready.

Open your eyes if they were closed. Smile — even just a little one.

Your day is yours. Go gently.`,
  },
  {
    slug: "self-compassion-practice",
    programDay: 9,
    programWeek: 3,
    needsAudio: true,
    filename: "self-compassion-practice.mp3",
    script: `Find a quiet spot and settle in. You can sit, lie down, or even just pause wherever you are right now.

Close your eyes if that feels comfortable. Take a slow, deep breath in... and let it out with a sigh.

This practice is about being kind to yourself. That might sound simple, but for many of us, it's one of the hardest things to do — especially during times of change.

Place one hand on your chest and one on your belly. Feel the warmth of your own touch. This is your body. It has carried you through everything — every hard day, every sleepless night, every moment of doubt.

Say silently to yourself: I am doing the best I can.

Breathe in gently... and out.

Now think about something that's been weighing on you. Maybe it's how your body feels lately. Maybe it's frustration with symptoms you can't control. Maybe it's something someone said, or something you said to yourself.

Whatever it is, just notice it. Don't push it away. Let it be there.

Now imagine you're talking to a close friend who told you the same thing. What would you say to her? You probably wouldn't criticize her. You'd probably say something like... I hear you. This is hard. You're not alone.

Say those same words to yourself now: I hear you. This is hard. I'm not alone.

Take a breath. Let your shoulders drop.

Repeat after me silently:

May I be gentle with myself.

May I accept where I am right now.

May I trust that this chapter is not the whole story.

Take one more slow breath in... hold it... and release.

You are worthy of the same kindness you give to everyone else. Start with yourself today.

When you're ready, gently open your eyes. Carry this softness with you.`,
  },
  {
    slug: "manifestation-future-self",
    programDay: 14,
    programWeek: 5,
    needsAudio: true,
    filename: "manifestation-future-self.mp3",
    script: `Welcome to your final meditation in this program. You've made it — fourteen days of showing up for yourself. That alone is something to be proud of.

Find a comfortable position and let your eyes close. Take a deep breath in through your nose... and slowly out through your mouth.

Let your body soften. Release your jaw. Drop your shoulders. Let your hands rest open.

We're going to take a gentle journey forward in time. Not far — just a few months from now. To a version of you who has continued this path of self-care and understanding.

Picture yourself waking up on a morning a few months from now. What does your bedroom look like? Maybe you've made a few changes — cooler sheets, a fan, a calmer space. Notice how it feels to wake up in this space.

You get up and move through your morning. You have a routine now — not rigid, but one that feels good. Maybe it starts with a stretch, a glass of water, a moment of stillness before the day begins.

Take a breath. See this future version of you moving through the day with a little more ease. Not perfect days — just more tools, more awareness, more compassion for yourself.

See yourself handling a hot flash with a calm breath instead of panic. See yourself sleeping a little better because you know what works for your body now. See yourself having that conversation with your doctor — prepared, confident, advocating for yourself.

This version of you isn't a different person. She's you — just a few steps further along the path you've already started.

Now I want you to let her say something to you. The you sitting here right now. What does she want you to know?

Listen quietly for a moment.

Whatever came to mind — trust it.

Take a deep breath in... and slowly let it go.

You have everything you need. You've already begun. The knowledge you've gathered these past two weeks — about your body, your symptoms, your options — that is yours to keep.

Place your hand on your heart. Feel it beating.

Say to yourself: I am becoming. I am enough. I am not alone.

Take one final, deep breath. Fill your lungs with possibility... and release.

When you're ready, gently open your eyes.

Congratulations. This isn't the end — it's just the beginning of knowing yourself better. Be proud. You showed up, every single day.

Go gently. And remember — Pause is always here when you need it.`,
  },
];

async function generateAudio(text: string, filename: string): Promise<string> {
  const outPath = `${AUDIO_DIR}/${filename}`;

  // Chunk text if > 4500 chars (ElevenLabs limit is ~5000)
  const MAX_CHUNK = 4500;
  if (text.length <= MAX_CHUNK) {
    console.log(`    Generating single chunk (${text.length} chars)...`);
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.4,
            use_speaker_boost: false,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`ElevenLabs error: ${response.status} - ${err}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(outPath, buffer);
    console.log(`    ✅ Saved ${outPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
    return outPath;
  }

  // Multi-chunk: split at paragraph boundaries
  console.log(`    Splitting into chunks (${text.length} chars total)...`);
  const paragraphs = text.split("\n\n");
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > MAX_CHUNK && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  console.log(`    Split into ${chunks.length} chunks`);
  const chunkFiles: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`    Chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)...`);
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: chunks[i],
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.4,
            use_speaker_boost: false,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`ElevenLabs error chunk ${i + 1}: ${response.status} - ${err}`);
    }

    const chunkPath = `${AUDIO_DIR}/chunk_${i}.mp3`;
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(chunkPath, buffer);
    chunkFiles.push(chunkPath);
  }

  // Concatenate with ffmpeg
  const listFile = `${AUDIO_DIR}/concat_list.txt`;
  writeFileSync(listFile, chunkFiles.map((f) => `file '${f.split("/").pop()}'`).join("\n"));
  execSync(`cd ${AUDIO_DIR} && ffmpeg -y -f concat -safe 0 -i concat_list.txt -c copy "${filename}"`, {
    stdio: "pipe",
  });

  // Cleanup
  for (const f of chunkFiles) {
    execSync(`rm "${f}"`);
  }
  execSync(`rm "${listFile}"`);

  const stats = execSync(`ls -la "${outPath}"`).toString();
  console.log(`    ✅ Saved ${outPath} (${stats.trim().split(/\s+/)[4]} bytes)`);
  return outPath;
}

async function main() {
  console.log("🧘 Generating meditation audio & assigning to program...\n");

  // Ensure audio directory exists
  if (!existsSync(AUDIO_DIR)) {
    mkdirSync(AUDIO_DIR, { recursive: true });
  }

  for (const med of MEDITATIONS) {
    console.log(`\n  ${med.slug} → Day ${med.programDay} (Phase ${med.programWeek})`);

    // Generate audio if needed
    let audioUrl: string | null = null;
    if (med.needsAudio && med.script && med.filename) {
      await generateAudio(med.script, med.filename);
      audioUrl = `${BASE_URL}/${med.filename}`;
    }

    // Update DB: set program_day, program_week, and audio_url if new
    if (audioUrl) {
      await sql`
        UPDATE content
        SET program_day = ${med.programDay},
            program_week = ${med.programWeek},
            audio_url = ${audioUrl},
            program_id = 'perimenopause-foundations'
        WHERE slug = ${med.slug}
      `;
      console.log(`    📝 DB updated: program_day=${med.programDay}, audio_url set`);
    } else {
      await sql`
        UPDATE content
        SET program_day = ${med.programDay},
            program_week = ${med.programWeek},
            program_id = 'perimenopause-foundations'
        WHERE slug = ${med.slug}
      `;
      console.log(`    📝 DB updated: program_day=${med.programDay} (audio already exists)`);
    }
  }

  console.log("\n✅ All meditations assigned to program and audio generated!");
  console.log("\nProgram now has meditations on:");
  console.log("  Day 6  — Sleep Body Scan (Phase 2: Track & Sleep)");
  console.log("  Day 9  — Self-Compassion Practice (Phase 3: Symptoms)");
  console.log("  Day 10 — Morning Energy Activation (Phase 4: Body & Fuel)");
  console.log("  Day 14 — Manifestation & Future Self (Phase 5: Your Plan)");
}

main().catch(console.error);
