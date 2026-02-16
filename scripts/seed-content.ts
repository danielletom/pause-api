/**
 * Seed the content table with all items from the Pause Content Plan.
 * Run: npx tsx scripts/seed-content.ts
 *
 * This preloads the full 8-week program (40 pieces) plus the content library.
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
  // ── WEEK 1: Your Baseline ──
  {
    title: "Welcome to Pause",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "What perimenopause actually is, why you feel this way, and what the next 8 weeks will look like.",
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
  {
    title: "Tracking 101",
    contentType: "lesson", format: "audio", durationMinutes: 8,
    description: "How to use Pause to build your personal health picture. What to track and why it matters.",
    category: "Basics", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft",
    programWeek: 1, programDay: 4, programAction: "Complete your evening journal",
  },
  {
    title: "Week 1 Check-in",
    contentType: "meditation", format: "audio", durationMinutes: 10,
    description: "Your first weekly reflection. How are you feeling? What surprised you?",
    category: "Basics", tags: ["evening", "calm"], productionTool: "Wondercraft", status: "draft",
    programWeek: 1, programDay: 5, programAction: "5-min gratitude meditation",
  },

  // ── WEEK 2: Sleep & Night Sweats ──
  {
    title: "Why Sleep Changes in Perimenopause",
    contentType: "podcast", format: "audio", durationMinutes: 20,
    description: "Expert conversation about the hormonal sleep disruption cycle — why you wake at 3am.",
    category: "Sleep", tags: ["evening", "sleep"], productionTool: "NotebookLM", status: "draft",
    programWeek: 2, programDay: 1, programAction: "Track your sleep environment",
  },
  {
    title: "The Night Sweat Toolkit",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "Practical strategies: bedroom temperature, fabrics, cooling techniques.",
    category: "Sleep", tags: ["evening", "sleep"], productionTool: "NotebookLM", status: "draft",
    programWeek: 2, programDay: 2, programAction: "Try the cooling checklist",
  },
  {
    title: "Building a Wind-Down Routine",
    contentType: "lesson", format: "audio", durationMinutes: 10,
    description: "Create a 30-minute pre-bed ritual that signals your body to sleep.",
    category: "Sleep", tags: ["evening", "sleep", "calm"], productionTool: "NotebookLM", status: "draft",
    programWeek: 2, programDay: 3, programAction: "Set a wind-down alarm for tonight",
  },
  {
    title: "Body Scan for Sleep",
    contentType: "meditation", format: "audio", durationMinutes: 15,
    description: "Progressive relaxation from head to toe. Designed for women whose minds race at bedtime.",
    category: "Sleep", tags: ["evening", "sleep", "calm"], productionTool: "Wondercraft", status: "draft",
    programWeek: 2, programDay: 4, programAction: "Do this meditation before bed",
  },
  {
    title: "Week 2 Check-in + Sleep Score Review",
    contentType: "meditation", format: "audio", durationMinutes: 10,
    description: "How did your sleep change this week? Review your sleep data and patterns.",
    category: "Sleep", tags: ["evening", "sleep"], productionTool: "Wondercraft", status: "draft",
    programWeek: 2, programDay: 5, programAction: "10-min sleep meditation",
  },

  // ── WEEK 3: Hot Flash Management ──
  {
    title: "Understanding Your Hot Flashes",
    contentType: "podcast", format: "audio", durationMinutes: 18,
    description: "What triggers them, how long they last, and why some women get them worse.",
    category: "Hot Flashes", tags: ["anytime", "hot flashes"], productionTool: "NotebookLM", status: "draft",
    programWeek: 3, programDay: 1, programAction: "Log any hot flashes with triggers",
  },
  {
    title: "Breathing Through a Flash",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "The 4-4-6 breathing technique explained and practiced. This becomes your SOS tool.",
    category: "Hot Flashes", tags: ["anytime", "sos", "calm"], productionTool: "Wondercraft", status: "draft",
    programWeek: 3, programDay: 2, programAction: "Practice the SOS breathing once",
  },
  {
    title: "Food Triggers You Didn't Expect",
    contentType: "lesson", format: "audio", durationMinutes: 10,
    description: "Caffeine, alcohol, spicy food — but also sugar, histamines, and meal timing.",
    category: "Nutrition", tags: ["anytime", "hot flashes", "nutrition"], productionTool: "NotebookLM", status: "draft",
    programWeek: 3, programDay: 3, programAction: "Note what you ate today",
  },
  {
    title: "Cooling Visualization",
    contentType: "meditation", format: "audio", durationMinutes: 12,
    description: "Guided imagery of cool water, snow, breeze — trains your brain to modulate the heat response.",
    category: "Hot Flashes", tags: ["anytime", "hot flashes", "calm"], productionTool: "Wondercraft", status: "draft",
    programWeek: 3, programDay: 4, programAction: "Try this during your next flash",
  },
  {
    title: "Week 3 Check-in + Trigger Review",
    contentType: "meditation", format: "audio", durationMinutes: 10,
    description: "Review your trigger patterns. What correlations is Pause finding in your data?",
    category: "Hot Flashes", tags: ["evening", "calm"], productionTool: "Wondercraft", status: "draft",
    programWeek: 3, programDay: 5, programAction: "5-min calming meditation",
  },

  // ── WEEK 4: Mood, Mind & Brain Fog ──
  {
    title: "Menopause and Your Brain",
    contentType: "podcast", format: "audio", durationMinutes: 20,
    description: "Why brain fog, anxiety, and mood swings happen. The estrogen-serotonin connection.",
    category: "Mood", tags: ["anytime", "mind"], productionTool: "NotebookLM", status: "draft",
    programWeek: 4, programDay: 1, programAction: "Log your mood in detail",
  },
  {
    title: "Anxiety Isn't 'Just Anxiety'",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "How to tell hormonal anxiety from situational stress. Why your doctor might be getting it wrong.",
    category: "Mood", tags: ["anytime", "mind", "calm"], productionTool: "NotebookLM", status: "draft",
    programWeek: 4, programDay: 2, programAction: "Try the grounding exercise",
  },
  {
    title: "Brain Fog Strategies",
    contentType: "lesson", format: "audio", durationMinutes: 10,
    description: "Practical cognitive tools: lists, routines, memory tricks. Exercise is the #1 brain fog fix.",
    category: "Mood", tags: ["morning", "mind"], productionTool: "NotebookLM", status: "draft",
    programWeek: 4, programDay: 3, programAction: "Set up one new routine",
  },
  {
    title: "Self-Compassion Meditation",
    contentType: "meditation", format: "audio", durationMinutes: 15,
    description: "You are not broken. A gentle guided meditation for the days when everything feels too much.",
    category: "Mood", tags: ["evening", "calm", "mind"], productionTool: "Wondercraft", status: "draft",
    programWeek: 4, programDay: 4, programAction: "Journal one kind thing about yourself",
  },
  {
    title: "Week 4 Check-in: Halfway!",
    contentType: "meditation", format: "audio", durationMinutes: 12,
    description: "You're halfway through the program. Celebrate your wins and review your mood patterns.",
    category: "Mood", tags: ["evening", "calm"], productionTool: "Wondercraft", status: "draft",
    programWeek: 4, programDay: 5, programAction: "Positive affirmation audio",
  },

  // ── WEEK 5: Body Changes & Movement ──
  {
    title: "Weight, Metabolism & Menopause",
    contentType: "podcast", format: "audio", durationMinutes: 18,
    description: "Why your body composition shifts, what actually works, and why crash diets make it worse.",
    category: "Movement", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft",
    programWeek: 5, programDay: 1, programAction: "Log what you ate + energy level",
  },
  {
    title: "Joint Pain & Bone Health",
    contentType: "lesson", format: "audio", durationMinutes: 10,
    description: "The estrogen-inflammation connection. Simple daily habits to protect your joints and bones.",
    category: "Movement", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft",
    programWeek: 5, programDay: 2, programAction: "Try a 10-min gentle stretch",
  },
  {
    title: "Exercise That Actually Helps",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "Strength training, walking, yoga — what the research says. Plus: the exercises to avoid.",
    category: "Movement", tags: ["morning", "energy"], productionTool: "NotebookLM", status: "draft",
    programWeek: 5, programDay: 3, programAction: "Plan tomorrow's movement",
  },
  {
    title: "Morning Energy Meditation",
    contentType: "meditation", format: "audio", durationMinutes: 10,
    description: "Gentle activation meditation for mornings when getting out of bed feels impossible.",
    category: "Movement", tags: ["morning", "energy"], productionTool: "Wondercraft", status: "draft",
    programWeek: 5, programDay: 4, programAction: "Set this as tomorrow's alarm",
  },
  {
    title: "Week 5 Check-in",
    contentType: "meditation", format: "audio", durationMinutes: 10,
    description: "How is your body feeling compared to Week 1? Review your symptom trends.",
    category: "Movement", tags: ["evening", "calm"], productionTool: "Wondercraft", status: "draft",
    programWeek: 5, programDay: 5, programAction: "Body gratitude meditation",
  },

  // ── WEEK 6: Nutrition & Fuel ──
  {
    title: "Eating for Perimenopause",
    contentType: "podcast", format: "audio", durationMinutes: 20,
    description: "Anti-inflammatory foods, phytoestrogens, gut health. What to eat more of and what to reduce.",
    category: "Nutrition", tags: ["anytime", "nutrition"], productionTool: "NotebookLM", status: "draft",
    programWeek: 6, programDay: 1, programAction: "Review your fridge against the list",
  },
  {
    title: "The Gut-Hormone Connection",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "Why bloating got worse and what your microbiome has to do with estrogen metabolism.",
    category: "Nutrition", tags: ["anytime", "nutrition"], productionTool: "NotebookLM", status: "draft",
    programWeek: 6, programDay: 2, programAction: "Try one gut-friendly swap",
  },
  {
    title: "Meal Timing & Blood Sugar",
    contentType: "lesson", format: "audio", durationMinutes: 10,
    description: "Why when you eat matters as much as what. Blood sugar crashes and hot flash connections.",
    category: "Nutrition", tags: ["anytime", "nutrition"], productionTool: "NotebookLM", status: "draft",
    programWeek: 6, programDay: 3, programAction: "No eating 3 hours before bed",
  },
  {
    title: "Supplements: What Works",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "Evidence-based supplement guide: magnesium, vitamin D, omega-3, black cohosh.",
    category: "Nutrition", tags: ["anytime", "nutrition"], productionTool: "NotebookLM", status: "draft",
    programWeek: 6, programDay: 4, programAction: "Check your supplement stack",
  },
  {
    title: "Week 6 Check-in + Shopping List",
    contentType: "meditation", format: "audio", durationMinutes: 10,
    description: "Review your nutrition patterns. Download your personalized menopause shopping list.",
    category: "Nutrition", tags: ["evening", "calm", "nutrition"], productionTool: "Wondercraft", status: "draft",
    programWeek: 6, programDay: 5, programAction: "Mindful eating meditation",
  },

  // ── WEEK 7: Relationships, Work & Identity ──
  {
    title: "Talking to Your Partner",
    contentType: "podcast", format: "audio", durationMinutes: 18,
    description: "How to explain what you're going through. Scripts for the conversation you've been avoiding.",
    category: "Relationships", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft",
    programWeek: 7, programDay: 1, programAction: "Share one thing with someone",
  },
  {
    title: "Menopause at Work",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "Managing symptoms in meetings, dealing with brain fog at your desk, knowing your rights.",
    category: "Relationships", tags: ["morning", "basics"], productionTool: "NotebookLM", status: "draft",
    programWeek: 7, programDay: 2, programAction: "Plan one work accommodation",
  },
  {
    title: "Sexual Health & Intimacy",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "Libido changes, vaginal dryness, and reconnecting with your body. Frank, practical, shame-free.",
    category: "Relationships", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft",
    programWeek: 7, programDay: 3, programAction: "Journal about intimacy",
  },
  {
    title: "Who Am I Now? Meditation",
    contentType: "meditation", format: "audio", durationMinutes: 15,
    description: "Identity meditation for the woman in transition. You're not losing yourself — you're becoming.",
    category: "Relationships", tags: ["evening", "calm", "mind"], productionTool: "Wondercraft", status: "draft",
    programWeek: 7, programDay: 4, programAction: "Write your 3-word intention",
  },
  {
    title: "Week 7 Check-in",
    contentType: "meditation", format: "audio", durationMinutes: 10,
    description: "How have your relationships shifted? What boundaries have you set?",
    category: "Relationships", tags: ["evening", "calm"], productionTool: "Wondercraft", status: "draft",
    programWeek: 7, programDay: 5, programAction: "Loving-kindness meditation",
  },

  // ── WEEK 8: Your Path Forward ──
  {
    title: "Talking to Your Doctor",
    contentType: "podcast", format: "audio", durationMinutes: 20,
    description: "How to prepare for the HRT conversation. What to ask, what to bring, how to advocate.",
    category: "Treatment", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft",
    programWeek: 8, programDay: 1, programAction: "Build your doctor prep sheet",
  },
  {
    title: "HRT: The Full Picture",
    contentType: "lesson", format: "audio", durationMinutes: 15,
    description: "Risks, benefits, types, and who it's right for. Evidence-based, balanced, no agenda.",
    category: "Treatment", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft",
    programWeek: 8, programDay: 2, programAction: "Write your questions for your doctor",
  },
  {
    title: "Building Your Long-Term Plan",
    contentType: "lesson", format: "audio", durationMinutes: 12,
    description: "What to keep tracking, when to check in, how to use your Pause data going forward.",
    category: "Wellness", tags: ["anytime", "basics"], productionTool: "NotebookLM", status: "draft",
    programWeek: 8, programDay: 3, programAction: "Set your 3-month goals",
  },
  {
    title: "Manifestation & Future Self",
    contentType: "meditation", format: "audio", durationMinutes: 15,
    description: "Visualize the woman you're becoming. Positive affirmations grounded in everything you've learned.",
    category: "Wellness", tags: ["evening", "calm"], productionTool: "Wondercraft", status: "draft",
    programWeek: 8, programDay: 4, programAction: "Listen before sleep",
  },
  {
    title: "Graduation!",
    contentType: "meditation", format: "audio", durationMinutes: 12,
    description: "You did it. Review your full 8-week journey: symptoms then vs now, patterns discovered, wins celebrated.",
    category: "Wellness", tags: ["anytime", "calm"], productionTool: "Wondercraft", status: "draft",
    programWeek: 8, programDay: 5, programAction: "Share your story (optional)",
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

    const prefix = item.programWeek ? `W${item.programWeek}D${item.programDay}` : "LIB";
    console.log(`  ${prefix} | ${item.contentType.padEnd(11)} | ${item.title}`);
  }

  console.log(`\n✅ Created ${created} content items`);
  console.log(`   - ${programContent.length} program items (8 weeks × 5 days)`);
  console.log(`   - ${libraryContent.length} library items`);
  console.log("\n📝 Audio URLs are empty — add them via the Content Manager when files are ready.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
