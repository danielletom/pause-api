/**
 * Seed the content table with all items from the Pause Content Plan.
 * Run: npx tsx scripts/seed-content.ts
 *
 * This preloads the 14-day program (14 pieces across 5 phases) plus the content library.
 * programWeek = phase number (1-5), programDay = absolute day (1-14).
 * Audio URLs are left empty — add them via the Content Manager when files are ready.
 */

import { db } from "../src/db";
import { content } from "../src/db/schema";

interface ContentSeed {
  title: string;
  contentType: string;
  format: string;
  description: string;
  durationMinutes: number;
  category: string;
  tags: string[];
  productionTool: string;
  status: string;
  programWeek?: number;
  programDay?: number;
  programAction?: string;
}

const programContent: ContentSeed[] = [
  // ── PHASE 1: Understand (Days 1–3) ──
  {
    title: "Welcome to Pause",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "What perimenopause actually is, why you feel this way, and what the next 14 days will look like.",
    category: "Basics", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft",
    programWeek: 1, programDay: 1, programAction: "Take your first symptom log",
  },
  {
    title: "The 34 Symptoms You Didn't Know About",
    contentType: "podcast", format: "audio", durationMinutes: 18,
    description: "Two-host conversational deep-dive into the full spectrum of menopause symptoms.",
    category: "Basics", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft",
    programWeek: 1, programDay: 2, programAction: "Check off any symptoms you recognize",
  },
  {
    title: "Your Body, Decoded",
    contentType: "lesson", format: "audio", durationMinutes: 10,
    description: "Hormones 101 — estrogen, progesterone, and why they matter. Simple language, zero jargon.",
    category: "Basics", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft",
    programWeek: 1, programDay: 3, programAction: "Log your symptoms + mood",
  },

  // ── PHASE 2: Track & Sleep (Days 4–6) ──
  {
    title: "Tracking 101",
    contentType: "lesson", format: "audio", durationMinutes: 8,
    description: "How to use Pause to build your personal health picture. What to track and why it matters.",
    category: "Basics", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft",
    programWeek: 2, programDay: 4, programAction: "Complete your evening journal",
  },
  {
    title: "Your First Check-in",
    contentType: "reflection", format: "audio", durationMinutes: 10,
    description: "Your first reflection. How are you feeling? What surprised you?",
    category: "Basics", tags: ["evening", "calm"], productionTool: "Wondercraft", status: "draft",
    programWeek: 2, programDay: 5, programAction: "5-min gratitude meditation",
  },
  {
    title: "Why Sleep Changes in Perimenopause",
    contentType: "podcast", format: "audio", durationMinutes: 20,
    description: "Expert conversation about the hormonal sleep disruption cycle — why you wake at 3am.",
    category: "Sleep", tags: ["evening", "sleep"], productionTool: "NotebookLM", status: "draft",
    programWeek: 2, programDay: 6, programAction: "Track your sleep environment",
  },

  // ── PHASE 3: Symptoms (Days 7–9) ──
  {
    title: "The Night Sweat Toolkit",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "Practical strategies: bedroom temperature, fabrics, cooling techniques.",
    category: "Sleep", tags: ["evening", "sleep"], productionTool: "NotebookLM", status: "draft",
    programWeek: 3, programDay: 7, programAction: "Try the cooling checklist",
  },
  {
    title: "Hot Flash Triggers & Relief",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "What triggers hot flashes, how to track them, and the 4-4-6 SOS breathing technique.",
    category: "Hot Flashes", tags: ["anytime", "sos", "calm"], productionTool: "NotebookLM", status: "draft",
    programWeek: 3, programDay: 8, programAction: "Practice the SOS breathing once",
  },
  {
    title: "Mood, Anxiety & the Hormone Link",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "Why brain fog, anxiety, and mood swings happen. The estrogen-serotonin connection.",
    category: "Mood", tags: ["anytime", "mind"], productionTool: "NotebookLM", status: "draft",
    programWeek: 3, programDay: 9, programAction: "Log your mood in detail",
  },

  // ── PHASE 4: Body & Fuel (Days 10–12) ──
  {
    title: "Exercise That Actually Helps",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "Strength training, walking, yoga — what the research says. Plus: the exercises to avoid.",
    category: "Movement", tags: ["morning", "energy"], productionTool: "NotebookLM", status: "draft",
    programWeek: 4, programDay: 10, programAction: "Plan tomorrow's movement",
  },
  {
    title: "Eating for Perimenopause",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "Anti-inflammatory foods, phytoestrogens, gut health. What to eat more of and what to reduce.",
    category: "Nutrition", tags: ["anytime", "nutrition"], productionTool: "NotebookLM", status: "draft",
    programWeek: 4, programDay: 11, programAction: "Review your fridge against the list",
  },
  {
    title: "Supplements: What Works",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "Evidence-based supplement guide: magnesium, vitamin D, omega-3, black cohosh.",
    category: "Nutrition", tags: ["anytime", "nutrition"], productionTool: "NotebookLM", status: "draft",
    programWeek: 4, programDay: 12, programAction: "Check your supplement stack",
  },

  // ── PHASE 5: Your Plan (Days 13–14) ──
  {
    title: "Talking to Your Doctor",
    contentType: "lesson", format: "audio", durationMinutes: 15,
    description: "How to prepare for the HRT conversation. What to ask, what to bring, how to advocate.",
    category: "Treatment", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft",
    programWeek: 5, programDay: 13, programAction: "Build your doctor prep sheet",
  },
  {
    title: "Your Personal Toolkit — Graduation!",
    contentType: "reflection", format: "audio", durationMinutes: 12,
    description: "You did it! Review your 14-day journey: symptoms then vs now, patterns discovered, wins celebrated.",
    category: "Wellness", tags: ["anytime", "calm"], productionTool: "Wondercraft", status: "draft",
    programWeek: 5, programDay: 14, programAction: "Share your story (optional)",
  },
];

// ── CONTENT LIBRARY (not in program) ──
const libraryContent: ContentSeed[] = [
  // Meditations
  { title: "Anxiety Grounding", contentType: "meditation", format: "audio", durationMinutes: 10, description: "Ground yourself in the present moment when anxiety hits.", category: "Mood", tags: ["anytime", "calm", "mind"], productionTool: "Wondercraft", status: "draft" },
  { title: "Breath Awareness", contentType: "meditation", format: "audio", durationMinutes: 8, description: "Simple breath-focused meditation for any time of day.", category: "Wellness", tags: ["anytime", "calm"], productionTool: "Wondercraft", status: "draft" },
  { title: "Evening Wind-Down", contentType: "meditation", format: "audio", durationMinutes: 12, description: "Transition from your busy day to restful evening.", category: "Sleep", tags: ["evening", "sleep", "calm"], productionTool: "Wondercraft", status: "draft" },
  { title: "Loving-Kindness for Midlife", contentType: "meditation", format: "audio", durationMinutes: 15, description: "Send compassion to yourself and others during this transition.", category: "Mood", tags: ["evening", "calm", "mind"], productionTool: "Wondercraft", status: "draft" },
  { title: "Body Gratitude Scan", contentType: "meditation", format: "audio", durationMinutes: 10, description: "Appreciate your body for everything it does, even during change.", category: "Movement", tags: ["anytime", "calm"], productionTool: "Wondercraft", status: "draft" },
  { title: "Quick Calm — 3 Minutes", contentType: "meditation", format: "audio", durationMinutes: 3, description: "Ultra-short calming practice for busy moments.", category: "Mood", tags: ["anytime", "calm", "sos"], productionTool: "Wondercraft", status: "draft" },
  { title: "Progressive Relaxation", contentType: "meditation", format: "audio", durationMinutes: 20, description: "Full-body progressive muscle relaxation for deep rest.", category: "Sleep", tags: ["evening", "sleep", "calm"], productionTool: "Wondercraft", status: "draft" },
  { title: "Hot Flash Cooling Visualization", contentType: "meditation", format: "audio", durationMinutes: 12, description: "Guided cooling imagery to help modulate hot flash response.", category: "Hot Flashes", tags: ["anytime", "hot flashes", "sos"], productionTool: "Wondercraft", status: "draft" },

  // Affirmations
  { title: "Morning Confidence Boost", contentType: "affirmation", format: "audio", durationMinutes: 5, description: "Start your day with empowering affirmations.", category: "Mood", tags: ["morning", "energy", "mind"], productionTool: "ElevenLabs", status: "draft" },
  { title: "You Are Not Broken", contentType: "affirmation", format: "audio", durationMinutes: 8, description: "Affirm that you are whole, capable, and becoming.", category: "Mood", tags: ["anytime", "calm", "mind"], productionTool: "ElevenLabs", status: "draft" },
  { title: "Body Acceptance Affirmations", contentType: "affirmation", format: "audio", durationMinutes: 5, description: "Love and accept your changing body.", category: "Movement", tags: ["anytime", "calm"], productionTool: "ElevenLabs", status: "draft" },
  { title: "Strength & Resilience", contentType: "affirmation", format: "audio", durationMinutes: 5, description: "Remind yourself of your inner strength.", category: "Mood", tags: ["morning", "energy", "mind"], productionTool: "ElevenLabs", status: "draft" },
  { title: "Evening Self-Love Practice", contentType: "affirmation", format: "audio", durationMinutes: 8, description: "End your day with self-compassion and love.", category: "Mood", tags: ["evening", "calm"], productionTool: "ElevenLabs", status: "draft" },
  { title: "I Am Becoming", contentType: "affirmation", format: "audio", durationMinutes: 5, description: "Embrace the transformation you're going through.", category: "Wellness", tags: ["anytime", "mind"], productionTool: "ElevenLabs", status: "draft" },
  { title: "Midlife Power Affirmations", contentType: "affirmation", format: "audio", durationMinutes: 5, description: "Own your power and wisdom at this stage of life.", category: "Wellness", tags: ["morning", "energy"], productionTool: "ElevenLabs", status: "draft" },
  { title: "Gratitude Affirmations", contentType: "affirmation", format: "audio", durationMinutes: 5, description: "Cultivate gratitude for the good in your life.", category: "Mood", tags: ["evening", "calm"], productionTool: "ElevenLabs", status: "draft" },

  // Podcasts (library-only, not in program)
  { title: "What Experts Got Wrong About Menopause", contentType: "podcast", format: "audio", durationMinutes: 18, description: "A candid look at outdated medical advice and what we know now.", category: "Treatment", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft" },
  { title: "Exercise Myths for Midlife Women", contentType: "podcast", format: "audio", durationMinutes: 18, description: "Debunking fitness myths that don't serve women over 40.", category: "Movement", tags: ["anytime", "energy"], productionTool: "NotebookLM", status: "draft" },
  { title: "Perimenopause vs Menopause: What's the Difference?", contentType: "podcast", format: "audio", durationMinutes: 15, description: "Clear up the confusion between these two stages.", category: "Basics", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft" },
  { title: "Doctor Conversations: How to Advocate", contentType: "podcast", format: "audio", durationMinutes: 18, description: "Practical scripts and strategies for better medical appointments.", category: "Treatment", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft" },
  { title: "Supplements: What Works and What's Marketing", contentType: "podcast", format: "audio", durationMinutes: 20, description: "Evidence-based review of popular menopause supplements.", category: "Nutrition", tags: ["anytime", "nutrition"], productionTool: "NotebookLM", status: "draft" },
  { title: "Sexual Health After 40: Frank Talk", contentType: "podcast", format: "audio", durationMinutes: 18, description: "Honest conversation about intimacy, desire, and physical changes.", category: "Relationships", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft" },

  // Practical Guides
  { title: "Menopause Shopping List", contentType: "guide", format: "pdf", durationMinutes: 0, description: "Your go-to grocery list for anti-inflammatory, hormone-supporting foods.", category: "Nutrition", tags: ["anytime", "nutrition"], productionTool: "Claude", status: "draft" },
  { title: "What to Ask Your Doctor — Script", contentType: "guide", format: "pdf", durationMinutes: 0, description: "Copy-paste scripts for your next doctor appointment.", category: "Treatment", tags: ["anytime", "basics"], productionTool: "Claude", status: "draft" },
  { title: "HRT Decision-Making Worksheet", contentType: "guide", format: "pdf", durationMinutes: 0, description: "Structured worksheet to help you evaluate HRT options.", category: "Treatment", tags: ["anytime", "basics"], productionTool: "Claude", status: "draft" },
  { title: "Bedroom Cooling Checklist", contentType: "guide", format: "pdf", durationMinutes: 0, description: "Optimize your bedroom environment for better sleep and fewer night sweats.", category: "Sleep", tags: ["evening", "sleep", "hot flashes"], productionTool: "Claude", status: "draft" },
  { title: "Anti-Inflammatory Meal Plan (7 Days)", contentType: "guide", format: "pdf", durationMinutes: 0, description: "A full week of meals designed to reduce inflammation and support hormones.", category: "Nutrition", tags: ["anytime", "nutrition"], productionTool: "Claude", status: "draft" },
  { title: "Supplement Stack Guide", contentType: "guide", format: "pdf", durationMinutes: 0, description: "Which supplements to take, when, and what the evidence says.", category: "Nutrition", tags: ["anytime", "nutrition"], productionTool: "Claude", status: "draft" },
  { title: "Work Accommodation Request Template", contentType: "guide", format: "pdf", durationMinutes: 0, description: "Template for requesting workplace accommodations for menopause symptoms.", category: "Relationships", tags: ["anytime", "basics"], productionTool: "Claude", status: "draft" },
  { title: "Partner Conversation Starter", contentType: "guide", format: "pdf", durationMinutes: 0, description: "How to start the conversation with your partner about what you're going through.", category: "Relationships", tags: ["anytime", "basics"], productionTool: "Claude", status: "draft" },
  { title: "Exercise Starter Plan (Beginner)", contentType: "guide", format: "pdf", durationMinutes: 0, description: "A gentle 4-week exercise plan for women new to working out in midlife.", category: "Movement", tags: ["morning", "energy"], productionTool: "Claude", status: "draft" },
  { title: "Sleep Hygiene Audit Checklist", contentType: "guide", format: "pdf", durationMinutes: 0, description: "Audit your sleep habits and environment with this comprehensive checklist.", category: "Sleep", tags: ["evening", "sleep"], productionTool: "Claude", status: "draft" },
];

async function seed() {
  console.log("🌱 Seeding content library...\n");

  const allContent = [...programContent, ...libraryContent];
  let created = 0;

  for (const item of allContent) {
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
      durationMinutes: item.durationMinutes || null,
      category: item.category,
      tags: item.tags,
      productionTool: item.productionTool,
      status: item.status,
      programWeek: item.programWeek || null,
      programDay: item.programDay || null,
      programAction: item.programAction || null,
    });
    created++;

    const prefix = item.programWeek ? `P${item.programWeek}D${item.programDay}` : "LIB";
    console.log(`  ${prefix} | ${item.contentType.padEnd(11)} | ${item.title}`);
  }

  console.log(`\n✅ Created ${created} content items`);
  console.log(`   - ${programContent.length} program items (14 days × 5 phases)`);
  console.log(`   - ${libraryContent.length} library items`);
  console.log("\n📝 Audio URLs are empty — add them via the Content Manager when files are ready.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
