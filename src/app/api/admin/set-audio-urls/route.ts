import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { content } from "@/db/schema";
import { eq } from "drizzle-orm";

const BASE_URL = "https://pause-api-seven.vercel.app";

const audioMap: Record<string, string> = {
  // 14-day program
  "welcome-to-pause": "/audio/podcasts/welcome-to-pause.mp3",
  "the-34-symptoms-you-didn-t-know-about": "/audio/podcasts/the-34-symptoms-you-didn-t-know-about.mp3",
  "your-body-decoded": "/audio/podcasts/your-body-decoded.mp3",
  "tracking-101": "/audio/podcasts/tracking-101.mp3",
  "your-first-check-in": "/audio/podcasts/week-1-check-in.mp3",
  "why-sleep-changes-in-perimenopause": "/audio/podcasts/why-sleep-changes-in-perimenopause-and-menopause.mp3",
  "sleep-body-scan": "/audio/meditations/body-scan-for-sleep.mp3",
  "the-night-sweat-toolkit": "/audio/podcasts/the-night-sweat-toolkit.mp3",
  "hot-flash-triggers-relief": "/audio/podcasts/hot-flash-triggers-relief.mp3",
  "mood-anxiety-the-hormone-link": "/audio/podcasts/mood-anxiety-the-hormone-link.mp3",
  "exercise-that-actually-helps": "/audio/podcasts/exercise-that-actually-helps.mp3",
  "eating-for-perimenopause": "/audio/podcasts/eating-for-perimenopause.mp3",
  "supplements-what-works": "/audio/podcasts/supplements-what-works.mp3",
  "talking-to-your-doctor": "/audio/podcasts/talking-to-your-doctor.mp3",
  "your-personal-toolkit-graduation": "/audio/podcasts/your-personal-toolkit-graduation.mp3",
  // Library meditations
  "manifestation-future-self": "/audio/meditations/manifestation-future-self.mp3",
  "morning-energy-activation": "/audio/meditations/morning-energy-activation.mp3",
  "self-compassion-practice": "/audio/meditations/self-compassion-practice.mp3",
};

export async function POST() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allItems = await db
    .select({ id: content.id, slug: content.slug, title: content.title, audioUrl: content.audioUrl })
    .from(content);

  const results: { title: string; audioUrl: string }[] = [];
  const skipped: string[] = [];

  for (const item of allItems) {
    const slug = item.slug || "";
    if (audioMap[slug]) {
      const audioUrl = `${BASE_URL}${audioMap[slug]}`;
      await db.update(content).set({ audioUrl }).where(eq(content.id, item.id));
      results.push({ title: item.title, audioUrl });
    } else if (!item.audioUrl) {
      skipped.push(item.title);
    }
  }

  return NextResponse.json({
    updated: results.length,
    items: results,
    noAudio: skipped,
    total: allItems.length,
  });
}
