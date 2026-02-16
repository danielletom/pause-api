/**
 * Seed MISSING library content from the Pause Content Plan.
 * Run: npx tsx scripts/seed-library-extras.ts
 *
 * The original seed-content.ts created 72 items (40 program + 32 library).
 * The Content Plan specifies 66 library items. This script adds the ~34 missing ones:
 *   - 4 additional meditations (Sleep Body Scan, Morning Energy Activation, Self-Compassion, Manifestation)
 *   - 10 additional podcasts
 *   - 12 audio lessons (none were in the original library seed)
 */

import { db } from "../src/db";
import { content } from "../src/db/schema";
import { eq } from "drizzle-orm";

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
}

const missingLibraryContent: ContentSeed[] = [
  // ── Missing Meditations (4) ──
  // These exist in the program but the Content Plan lists them as standalone library items too
  {
    title: "Sleep Body Scan",
    contentType: "meditation",
    format: "audio",
    durationMinutes: 15,
    description:
      "Progressive relaxation from head to toe. Designed for women whose minds race at bedtime.",
    category: "Sleep",
    tags: ["evening", "sleep", "calm"],
    productionTool: "Wondercraft",
    status: "draft",
  },
  {
    title: "Morning Energy Activation",
    contentType: "meditation",
    format: "audio",
    durationMinutes: 10,
    description:
      "Gentle activation meditation for mornings when getting out of bed feels impossible.",
    category: "Movement",
    tags: ["morning", "energy"],
    productionTool: "Wondercraft",
    status: "draft",
  },
  {
    title: "Self-Compassion Practice",
    contentType: "meditation",
    format: "audio",
    durationMinutes: 15,
    description:
      "You are not broken. A gentle guided meditation for the days when everything feels too much.",
    category: "Mood",
    tags: ["evening", "calm", "mind"],
    productionTool: "Wondercraft",
    status: "draft",
  },
  {
    title: "Manifestation & Future Self",
    contentType: "meditation",
    format: "audio",
    durationMinutes: 15,
    description:
      "Visualize the woman you're becoming. Positive affirmations grounded in everything you've learned.",
    category: "Wellness",
    tags: ["evening", "calm"],
    productionTool: "Wondercraft",
    status: "draft",
  },

  // ── Missing Podcasts (10) ──
  // The Content Plan section 4.2 lists 16 podcasts. The program has 8 podcasts
  // and the library had 6 — many overlap. These are the ones NOT yet in the DB.
  {
    title: "The 34 Symptoms Nobody Warned You About",
    contentType: "podcast",
    format: "audio",
    durationMinutes: 18,
    description:
      "A full walkthrough of the 34 recognised perimenopause symptoms — from the obvious to the surprising.",
    category: "Basics",
    tags: ["anytime", "basics"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Hot Flashes: What Actually Triggers Them",
    contentType: "podcast",
    format: "audio",
    durationMinutes: 18,
    description:
      "Deep dive into hot flash triggers — food, stress, environment — and what the research actually says.",
    category: "Hot Flashes",
    tags: ["anytime", "hot_flashes"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Menopause and Your Brain",
    contentType: "podcast",
    format: "audio",
    durationMinutes: 20,
    description:
      "Why brain fog, anxiety, and mood swings happen. The estrogen-serotonin connection explained.",
    category: "Mood",
    tags: ["anytime", "mind"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Weight, Metabolism & the Midlife Shift",
    contentType: "podcast",
    format: "audio",
    durationMinutes: 18,
    description:
      "Why your body composition shifts in perimenopause, what actually works, and why crash diets make it worse.",
    category: "Movement",
    tags: ["anytime", "basics"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Eating for Perimenopause",
    contentType: "podcast",
    format: "audio",
    durationMinutes: 20,
    description:
      "Anti-inflammatory foods, phytoestrogens, and gut health. What to eat more of and what to reduce.",
    category: "Nutrition",
    tags: ["anytime", "nutrition"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Talking to Your Partner About Menopause",
    contentType: "podcast",
    format: "audio",
    durationMinutes: 18,
    description:
      "How to explain what you're going through. Scripts for the conversation you've been avoiding.",
    category: "Relationships",
    tags: ["anytime", "relationships"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "HRT: The Full Balanced Picture",
    contentType: "podcast",
    format: "audio",
    durationMinutes: 22,
    description:
      "Risks, benefits, types, and who it's right for. Evidence-based, balanced, no agenda.",
    category: "Treatment",
    tags: ["anytime", "basics"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Menopause at Work: Your Rights and Strategies",
    contentType: "podcast",
    format: "audio",
    durationMinutes: 18,
    description:
      "Managing symptoms in the workplace, dealing with brain fog at your desk, and knowing your legal rights.",
    category: "Relationships",
    tags: ["anytime", "basics"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "The Gut-Hormone Connection",
    contentType: "podcast",
    format: "audio",
    durationMinutes: 18,
    description:
      "Why bloating got worse and what your microbiome has to do with estrogen metabolism.",
    category: "Nutrition",
    tags: ["anytime", "nutrition"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Why Sleep Changes in Perimenopause",
    contentType: "podcast",
    format: "audio",
    durationMinutes: 20,
    description:
      "Expert conversation about the hormonal sleep disruption cycle — why you wake at 3am and what to do about it.",
    category: "Sleep",
    tags: ["evening", "sleep"],
    productionTool: "NotebookLM",
    status: "draft",
  },

  // ── Audio Lessons (12) — all new to the library ──
  // These topics exist in the 8-week program but the Content Plan lists them
  // as standalone library items users can browse independently.
  {
    title: "Hormones 101",
    contentType: "audio_lesson",
    format: "audio",
    durationMinutes: 12,
    description:
      "Estrogen, progesterone, testosterone — what they do, why they're changing, and what it means for you.",
    category: "Basics",
    tags: ["anytime", "basics"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Your Body Decoded",
    contentType: "audio_lesson",
    format: "audio",
    durationMinutes: 10,
    description:
      "A plain-language guide to what's happening inside your body during perimenopause. Zero jargon.",
    category: "Basics",
    tags: ["anytime", "basics"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Tracking 101",
    contentType: "audio_lesson",
    format: "audio",
    durationMinutes: 8,
    description:
      "How to use Pause to build your personal health picture. What to track and why it matters.",
    category: "Basics",
    tags: ["anytime", "basics"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Night Sweat Toolkit",
    contentType: "audio_lesson",
    format: "audio",
    durationMinutes: 12,
    description:
      "Practical strategies for managing night sweats: bedroom temperature, fabrics, cooling techniques that work.",
    category: "Sleep",
    tags: ["evening", "sleep"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Building a Wind-Down Routine",
    contentType: "audio_lesson",
    format: "audio",
    durationMinutes: 10,
    description:
      "Create a 30-minute pre-bed ritual that signals your body to sleep. Practical, step-by-step.",
    category: "Sleep",
    tags: ["evening", "sleep", "calm"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Food Triggers You Didn't Expect",
    contentType: "audio_lesson",
    format: "audio",
    durationMinutes: 10,
    description:
      "Caffeine, alcohol, spicy food — but also sugar, histamines, and meal timing. Know your triggers.",
    category: "Nutrition",
    tags: ["anytime", "hot_flashes", "nutrition"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Brain Fog Strategies That Work",
    contentType: "audio_lesson",
    format: "audio",
    durationMinutes: 10,
    description:
      "Practical cognitive tools: lists, routines, memory tricks. Plus why exercise is the #1 brain fog fix.",
    category: "Mood",
    tags: ["morning", "mind"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Joint Pain & Bone Health Basics",
    contentType: "audio_lesson",
    format: "audio",
    durationMinutes: 10,
    description:
      "The estrogen-inflammation connection. Simple daily habits to protect your joints and bones.",
    category: "Movement",
    tags: ["anytime", "basics"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Exercise That Actually Helps",
    contentType: "audio_lesson",
    format: "audio",
    durationMinutes: 12,
    description:
      "Strength training, walking, yoga — what the research says works for midlife women. Plus: exercises to avoid.",
    category: "Movement",
    tags: ["morning", "energy"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Meal Timing & Blood Sugar",
    contentType: "audio_lesson",
    format: "audio",
    durationMinutes: 10,
    description:
      "Why when you eat matters as much as what. Blood sugar crashes and their connection to hot flashes.",
    category: "Nutrition",
    tags: ["anytime", "nutrition"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "The Supplement Evidence Guide",
    contentType: "audio_lesson",
    format: "audio",
    durationMinutes: 12,
    description:
      "Evidence-based supplement guide: magnesium, vitamin D, omega-3, black cohosh — what works and what doesn't.",
    category: "Nutrition",
    tags: ["anytime", "nutrition"],
    productionTool: "NotebookLM",
    status: "draft",
  },
  {
    title: "Menopause at Work: Managing Symptoms",
    contentType: "audio_lesson",
    format: "audio",
    durationMinutes: 12,
    description:
      "Managing symptoms in meetings, dealing with brain fog at your desk, and practical workplace strategies.",
    category: "Relationships",
    tags: ["morning", "basics"],
    productionTool: "NotebookLM",
    status: "draft",
  },
];

async function seedExtras() {
  console.log("🌱 Seeding missing library content...\n");

  // Check for existing titles AND slugs to avoid duplicates
  const existing = await db.select({ title: content.title, slug: content.slug }).from(content);
  const existingTitles = new Set(existing.map((e) => e.title.toLowerCase()));
  const existingSlugs = new Set(existing.map((e) => e.slug?.toLowerCase()));

  let created = 0;
  let skipped = 0;

  for (const item of missingLibraryContent) {
    // Skip if title already exists (case-insensitive)
    if (existingTitles.has(item.title.toLowerCase())) {
      console.log(`  SKIP | ${item.contentType.padEnd(13)} | ${item.title} (already exists)`);
      skipped++;
      continue;
    }

    let slug = item.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Handle slug collision — append "-library" if slug already exists
    if (existingSlugs.has(slug)) {
      slug = `${slug}-library`;
    }
    existingSlugs.add(slug);

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
    });

    created++;
    console.log(`  ADD  | ${item.contentType.padEnd(13)} | ${item.title}`);
  }

  console.log(`\n✅ Done!`);
  console.log(`   - Added: ${created} new library items`);
  console.log(`   - Skipped: ${skipped} (already existed)`);
  console.log(`   - Total in script: ${missingLibraryContent.length}`);

  // Final count
  const total = await db.select({ title: content.title }).from(content);
  console.log(`\n📊 Total content in database: ${total.length} items`);
  process.exit(0);
}

seedExtras().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
