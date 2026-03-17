/**
 * Migrate from 8-week (40 episode) program to 14-day (5 phase) program.
 * Run: npx tsx scripts/migrate-to-14day.ts
 *
 * This script:
 * 1. Deletes all existing program content rows (programWeek IS NOT NULL)
 * 2. Inserts the 14 new program content rows
 * 3. Resets programProgress rows (users restart on the new program)
 * 4. Resets programStartedAt on profiles (fresh enrollment)
 */

import { db } from "../src/db";
import { content, programProgress, profiles } from "../src/db/schema";
import { isNotNull, sql } from "drizzle-orm";

const newProgram = [
  // Phase 1: Understand (Days 1–3)
  { title: "Welcome to Pause", contentType: "lesson", format: "audio", durationMinutes: 12, description: "What perimenopause actually is, why you feel this way, and what the next 14 days will look like.", category: "Basics", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft", programWeek: 1, programDay: 1, programAction: "Take your first symptom log" },
  { title: "The 34 Symptoms You Didn't Know About", contentType: "podcast", format: "audio", durationMinutes: 18, description: "Two-host conversational deep-dive into the full spectrum of menopause symptoms.", category: "Basics", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft", programWeek: 1, programDay: 2, programAction: "Check off any symptoms you recognize" },
  { title: "Your Body, Decoded", contentType: "lesson", format: "audio", durationMinutes: 10, description: "Hormones 101 — estrogen, progesterone, and why they matter. Simple language, zero jargon.", category: "Basics", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft", programWeek: 1, programDay: 3, programAction: "Log your symptoms + mood" },

  // Phase 2: Track & Sleep (Days 4–6)
  { title: "Tracking 101", contentType: "lesson", format: "audio", durationMinutes: 8, description: "How to use Pause to build your personal health picture. What to track and why it matters.", category: "Basics", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft", programWeek: 2, programDay: 4, programAction: "Complete your evening journal" },
  { title: "Your First Check-in", contentType: "reflection", format: "audio", durationMinutes: 10, description: "Your first reflection. How are you feeling? What surprised you?", category: "Basics", tags: ["evening", "calm"], productionTool: "Wondercraft", status: "draft", programWeek: 2, programDay: 5, programAction: "5-min gratitude meditation" },
  { title: "Why Sleep Changes in Perimenopause", contentType: "podcast", format: "audio", durationMinutes: 20, description: "Expert conversation about the hormonal sleep disruption cycle — why you wake at 3am.", category: "Sleep", tags: ["evening", "sleep"], productionTool: "NotebookLM", status: "draft", programWeek: 2, programDay: 6, programAction: "Track your sleep environment" },

  // Phase 3: Symptoms (Days 7–9)
  { title: "The Night Sweat Toolkit", contentType: "lesson", format: "audio", durationMinutes: 12, description: "Practical strategies: bedroom temperature, fabrics, cooling techniques.", category: "Sleep", tags: ["evening", "sleep"], productionTool: "NotebookLM", status: "draft", programWeek: 3, programDay: 7, programAction: "Try the cooling checklist" },
  { title: "Hot Flash Triggers & Relief", contentType: "lesson", format: "audio", durationMinutes: 12, description: "What triggers hot flashes, how to track them, and the 4-4-6 SOS breathing technique.", category: "Hot Flashes", tags: ["anytime", "sos", "calm"], productionTool: "NotebookLM", status: "draft", programWeek: 3, programDay: 8, programAction: "Practice the SOS breathing once" },
  { title: "Mood, Anxiety & the Hormone Link", contentType: "lesson", format: "audio", durationMinutes: 12, description: "Why brain fog, anxiety, and mood swings happen. The estrogen-serotonin connection.", category: "Mood", tags: ["anytime", "mind"], productionTool: "NotebookLM", status: "draft", programWeek: 3, programDay: 9, programAction: "Log your mood in detail" },

  // Phase 4: Body & Fuel (Days 10–12)
  { title: "Exercise That Actually Helps", contentType: "lesson", format: "audio", durationMinutes: 12, description: "Strength training, walking, yoga — what the research says. Plus: the exercises to avoid.", category: "Movement", tags: ["morning", "energy"], productionTool: "NotebookLM", status: "draft", programWeek: 4, programDay: 10, programAction: "Plan tomorrow's movement" },
  { title: "Eating for Perimenopause", contentType: "lesson", format: "audio", durationMinutes: 12, description: "Anti-inflammatory foods, phytoestrogens, gut health. What to eat more of and what to reduce.", category: "Nutrition", tags: ["anytime", "nutrition"], productionTool: "NotebookLM", status: "draft", programWeek: 4, programDay: 11, programAction: "Review your fridge against the list" },
  { title: "Supplements: What Works", contentType: "lesson", format: "audio", durationMinutes: 12, description: "Evidence-based supplement guide: magnesium, vitamin D, omega-3, black cohosh.", category: "Nutrition", tags: ["anytime", "nutrition"], productionTool: "NotebookLM", status: "draft", programWeek: 4, programDay: 12, programAction: "Check your supplement stack" },

  // Phase 5: Your Plan (Days 13–14)
  { title: "Talking to Your Doctor", contentType: "lesson", format: "audio", durationMinutes: 15, description: "How to prepare for the HRT conversation. What to ask, what to bring, how to advocate.", category: "Treatment", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft", programWeek: 5, programDay: 13, programAction: "Build your doctor prep sheet" },
  { title: "Your Personal Toolkit — Graduation!", contentType: "reflection", format: "audio", durationMinutes: 12, description: "You did it! Review your 14-day journey: symptoms then vs now, patterns discovered, wins celebrated.", category: "Wellness", tags: ["anytime", "calm"], productionTool: "Wondercraft", status: "draft", programWeek: 5, programDay: 14, programAction: "Share your story (optional)" },
];

async function migrate() {
  console.log("🔄 Migrating to 14-day program...\n");

  // 1. Delete existing program content
  const deleted = await db
    .delete(content)
    .where(isNotNull(content.programWeek));
  console.log(`  ❌ Deleted old program content rows`);

  // 2. Insert new 14-day program
  for (const item of newProgram) {
    const slug = item.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    await db.insert(content).values({
      title: item.title,
      slug,
      contentType: item.contentType,
      format: item.format,
      description: item.description,
      durationMinutes: item.durationMinutes,
      category: item.category,
      tags: item.tags,
      productionTool: item.productionTool,
      status: item.status,
      programWeek: item.programWeek,
      programDay: item.programDay,
      programAction: item.programAction,
    });
    console.log(`  ✅ P${item.programWeek}D${item.programDay} | ${item.title}`);
  }

  // 3. Reset program progress (users restart)
  await db.delete(programProgress);
  console.log(`\n  🗑️  Cleared all program progress`);

  // 4. Reset programStartedAt (fresh enrollment for all users)
  await db
    .update(profiles)
    .set({ programStartedAt: null });
  console.log(`  🔄 Reset programStartedAt for all users`);

  console.log(`\n✅ Migration complete!`);
  console.log(`   - ${newProgram.length} program episodes (14 days, 5 phases)`);
  console.log(`   - All users will re-enroll on next program access`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
