/**
 * Set audioUrl for content items that have audio files in public/audio/.
 * Run: npx tsx scripts/set-audio-urls.ts
 */

import { db } from "../src/db";
import { content } from "../src/db/schema";
import { eq } from "drizzle-orm";

const BASE_URL = "https://pause-api-seven.vercel.app";

// Map: content slug → audio file path (relative to public/)
const audioMap: Record<string, string> = {
  // Days 1-6 (original)
  "welcome-to-pause": "/audio/podcasts/welcome-to-pause.mp3",
  "the-34-symptoms-you-didn-t-know-about": "/audio/podcasts/the-34-symptoms-you-didn-t-know-about.mp3",
  "your-body-decoded": "/audio/podcasts/your-body-decoded.mp3",
  "tracking-101": "/audio/podcasts/tracking-101.mp3",
  "your-first-check-in": "/audio/podcasts/week-1-check-in.mp3",
  "why-sleep-changes-in-perimenopause": "/audio/podcasts/why-sleep-changes-in-perimenopause-and-menopause.mp3",
  "sleep-body-scan": "/audio/meditations/body-scan-for-sleep.mp3",
  // Days 7-14 (ElevenLabs generated)
  "the-night-sweat-toolkit": "/audio/podcasts/the-night-sweat-toolkit.mp3",
  "hot-flash-triggers-relief": "/audio/podcasts/hot-flash-triggers-relief.mp3",
  "mood-anxiety-the-hormone-link": "/audio/podcasts/mood-anxiety-the-hormone-link.mp3",
  "exercise-that-actually-helps": "/audio/podcasts/exercise-that-actually-helps.mp3",
  "eating-for-perimenopause": "/audio/podcasts/eating-for-perimenopause.mp3",
  "supplements-what-works": "/audio/podcasts/supplements-what-works.mp3",
  "talking-to-your-doctor": "/audio/podcasts/talking-to-your-doctor.mp3",
  "your-personal-toolkit-graduation": "/audio/podcasts/your-personal-toolkit-graduation.mp3",
};

async function setAudioUrls() {
  console.log("Setting audio URLs for content items...\n");

  const allItems = await db
    .select({ id: content.id, slug: content.slug, title: content.title, audioUrl: content.audioUrl })
    .from(content);

  let updated = 0;
  let skipped = 0;

  for (const item of allItems) {
    const slug = item.slug || "";
    if (audioMap[slug]) {
      const audioUrl = `${BASE_URL}${audioMap[slug]}`;
      await db.update(content).set({ audioUrl }).where(eq(content.id, item.id));
      console.log(`  SET  | ${item.title}`);
      console.log(`        ${audioUrl}`);
      updated++;
    } else if (item.audioUrl) {
      console.log(`  OK   | ${item.title} (already has URL)`);
      skipped++;
    }
  }

  console.log(`\nDone! Updated ${updated} items, ${skipped} already had URLs.`);
  console.log(`${allItems.length - updated - skipped} items still need audio files.`);
  process.exit(0);
}

setAudioUrls().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
