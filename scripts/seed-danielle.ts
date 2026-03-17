/**
 * Seed danielle@pausetest.com with 3 weeks of realistic perimenopause data.
 * Run: npx tsx scripts/seed-danielle.ts
 *
 * Creates:
 *  - Clerk user lookup (danielle@pausetest.com)
 *  - Profile with period tracking enabled
 *  - 21 days of morning + evening daily logs (with realistic patterns)
 *  - 3 medications + 21 days of med logs (~85% adherence)
 *  - 21 computed scores (readiness, sleep, symptom, streak)
 *  - 6 user correlations (diverse factors)
 *  - 3 SOS events
 *  - 10 content engagements
 *  - 14-day program progress (first 10 days done)
 *  - 3 weekly + 2 readiness narratives
 *  - 2 period cycles (cycle 2 active)
 *  - 15 gratitude entries across 5 themes
 */

import { createClerkClient } from "@clerk/backend";
import { db } from "../src/db";
import {
  profiles,
  dailyLogs,
  medications,
  medLogs,
  computedScores,
  userCorrelations,
  sosEvents,
  contentEngagement,
  programProgress,
  narratives,
  bleedingEvents,
  cycles,
  cycleAnalytics,
  gratitudeEntries,
  content,
} from "../src/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";

// ── Config ──────────────────────────────────────────────────────────────────
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY!;
const USER_EMAIL = "danielle@pausetest.com";

const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

// ── Helpers ─────────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function chance(pct: number): boolean {
  return Math.random() < pct;
}

// ── Symptom pools (keys match quick-log.tsx) ────────────────────────────────
const SYMPTOM_POOL = [
  { key: "hot_flash", baseChance: 0.55, severity: () => rand(1, 3) },
  { key: "night_sweats", baseChance: 0.45, severity: () => rand(1, 3) },
  { key: "brain_fog", baseChance: 0.35, severity: () => rand(1, 2) },
  { key: "fatigue", baseChance: 0.4, severity: () => rand(1, 3) },
  { key: "irritability", baseChance: 0.3, severity: () => rand(1, 2) },
  { key: "joint_pain", baseChance: 0.25, severity: () => rand(1, 2) },
  { key: "anxiety", baseChance: 0.3, severity: () => rand(1, 2) },
  { key: "headache", baseChance: 0.2, severity: () => rand(1, 2) },
  { key: "heart_racing", baseChance: 0.15, severity: () => rand(1, 2) },
  { key: "nausea", baseChance: 0.1, severity: () => rand(1, 2) },
];

const MORNING_STRESSORS = [
  "busy_workday", "family", "doctor", "stressful",
];
const EVENING_STRESSORS = [
  "busy_workday", "family", "stressful",
];
const MORNING_ACTIVITIES = [
  "exercise", "quiet",
];
const EVENING_ACTIVITIES = [
  "social", "quiet", "exercise",
];
const DISRUPTION_CAUSES = [
  "hot_flash", "night_sweats", "bathroom", "racing_mind", "pain",
];

// ── Gratitude text pools ────────────────────────────────────────────────────
const GRATITUDE_TEXTS: Record<string, string[]> = {
  people: [
    "My daughter making me laugh at breakfast",
    "A kind message from my sister checking in on me",
    "Coffee with a friend — she always knows what to say",
    "My partner bringing me tea without asking",
  ],
  health: [
    "Woke up feeling rested for once",
    "No hot flashes during my meeting today",
    "Slept through the night — first time this week",
    "Had energy to cook a proper dinner",
  ],
  moments: [
    "The sunlight coming through the kitchen window",
    "A perfect cup of tea at just the right temperature",
    "Birds singing outside while I journaled",
    "Finding a quiet moment to just breathe",
  ],
  comfort: [
    "My favourite blanket and a good book",
    "A warm bath with lavender oil",
    "Clean sheets on the bed tonight",
    "My morning coffee ritual — just me and the quiet",
  ],
  growth: [
    "Managed to meditate for 10 minutes without giving up",
    "Said no to something that would have overwhelmed me",
    "Started tracking my symptoms — feels empowering",
    "Went for a walk even though I didn't feel like it",
  ],
};

// ── Narrative templates ─────────────────────────────────────────────────────
const WEEKLY_NARRATIVES = [
  "Your first full week of tracking! You logged 7 out of 7 days — amazing consistency. Sleep averaged 6.4 hours with 1.3 disruptions per night. Hot flashes appeared on 4 days but were mostly mild. Your mood was best on days you exercised.",
  "Week two showed real patterns emerging. Sleep quality improved mid-week, correlating with lower stress. Night sweats were less frequent than week one. Your readiness scores averaged 65 — a solid baseline.",
  "Three weeks in and your data is telling a story. Magnesium adherence was strong and your sleep quality improved noticeably. Brain fog only appeared twice this week. Your streak is at 21 days — incredible dedication.",
];

const READINESS_NARRATIVES = [
  "Your readiness is 72 today. Good sleep (7h, 1 disruption) and stable mood are helping. Mild joint pain noted. Your magnesium last night may have contributed to better rest.",
  "Readiness at 58 — a dip from yesterday. Only 5.5 hours sleep with 2 disruptions. Take it easy today. Your body needs gentleness.",
];

// ── Day-by-day realism model ────────────────────────────────────────────────
// Simulates a real patient: stress clusters, sleep debt, exercise benefits,
// alcohol → worse night sweats, weekend recovery, period flare-ups
interface DayContext {
  dayNum: number; // 0 = today, 21 = 3 weeks ago
  isWeekend: boolean;
  dayOfWeek: number;
  prevSleepHours: number;
  hadAlcohol: boolean;
  exercised: boolean;
  isWorkStress: boolean;
  isPeriod: boolean; // in bleeding window
  cumulativeSleepDebt: number; // running average deficit
}

function buildDayContext(dayNum: number, prevCtx: DayContext | null): DayContext {
  const d = daysAgo(dayNum);
  const dayOfWeek = d.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Work stress is common mid-week
  const isWorkStress = !isWeekend && chance(dayOfWeek === 1 || dayOfWeek === 4 ? 0.6 : 0.35);

  // Exercise: 3x/week, more likely on weekends and Tue/Thu
  const exercised = chance(
    isWeekend ? 0.55 :
    dayOfWeek === 2 || dayOfWeek === 4 ? 0.5 :
    0.2
  );

  // Alcohol: more on Fri/Sat evenings
  const hadAlcohol = chance(
    dayOfWeek === 5 || dayOfWeek === 6 ? 0.45 : 0.12
  );

  // Period windows: days 21-16 (cycle 1) and days 3-0 (cycle 2)
  const isPeriod = (dayNum >= 16 && dayNum <= 21) || (dayNum >= 0 && dayNum <= 3);

  // Sleep hours: realistic distribution affected by context
  let baseSleep = isWeekend ? randFloat(6.5, 8.5) : randFloat(5.0, 7.5);
  // Alcohol disrupts sleep
  if (prevCtx?.hadAlcohol) baseSleep = Math.max(4.0, baseSleep - randFloat(0.5, 1.5));
  // Work stress hurts sleep
  if (isWorkStress) baseSleep = Math.max(4.5, baseSleep - randFloat(0.3, 0.8));
  // Period disrupts sleep
  if (isPeriod) baseSleep = Math.max(4.5, baseSleep - randFloat(0.2, 0.6));

  const cumulativeSleepDebt = prevCtx
    ? prevCtx.cumulativeSleepDebt * 0.8 + (7.0 - baseSleep) * 0.2
    : 0;

  return {
    dayNum, isWeekend, dayOfWeek,
    prevSleepHours: baseSleep,
    hadAlcohol, exercised, isWorkStress, isPeriod,
    cumulativeSleepDebt,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌸 Pause Test User Seeder — Danielle");
  console.log("─".repeat(50));

  // ── 1. Find Clerk user ──────────────────────────────────────────────────
  console.log("\n1️⃣  Finding Clerk user...");
  let clerkUserId: string;
  try {
    const users = await clerk.users.getUserList({ emailAddress: [USER_EMAIL] });
    if (users.data.length === 0) {
      console.log("   ⚠️  User not found in Clerk — creating...");
      const user = await clerk.users.createUser({
        emailAddress: [USER_EMAIL],
        password: "PauseTest2026!",
        firstName: "Danielle",
        lastName: "Thompson",
      });
      clerkUserId = user.id;
      console.log(`   ✅ Created: ${USER_EMAIL} (Clerk ID: ${clerkUserId})`);
    } else {
      clerkUserId = users.data[0].id;
      console.log(`   ✅ Found: ${USER_EMAIL} (Clerk ID: ${clerkUserId})`);
    }
  } catch (err: any) {
    console.error("Failed to find/create Clerk user:", err);
    throw err;
  }

  // ── Clean existing data for this user ─────────────────────────────────
  console.log("\n🧹 Cleaning existing data...");
  await db.delete(dailyLogs).where(eq(dailyLogs.userId, clerkUserId));
  await db.delete(computedScores).where(eq(computedScores.userId, clerkUserId));
  await db.delete(userCorrelations).where(eq(userCorrelations.userId, clerkUserId));
  await db.delete(sosEvents).where(eq(sosEvents.userId, clerkUserId));
  await db.delete(contentEngagement).where(eq(contentEngagement.userId, clerkUserId));
  await db.delete(programProgress).where(eq(programProgress.userId, clerkUserId));
  await db.delete(narratives).where(eq(narratives.userId, clerkUserId));
  await db.delete(bleedingEvents).where(eq(bleedingEvents.userId, clerkUserId));
  await db.delete(cycles).where(eq(cycles.userId, clerkUserId));
  await db.delete(cycleAnalytics).where(eq(cycleAnalytics.userId, clerkUserId));
  await db.delete(gratitudeEntries).where(eq(gratitudeEntries.userId, clerkUserId));
  // Delete med logs before meds (FK dependency)
  await db.delete(medLogs).where(eq(medLogs.userId, clerkUserId));
  await db.delete(medications).where(eq(medications.userId, clerkUserId));
  console.log("   ✅ Cleaned");

  // ── 2. Profile ────────────────────────────────────────────────────────
  console.log("\n2️⃣  Creating/updating profile...");
  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, clerkUserId),
  });

  const profileData = {
    name: "Danielle Thompson",
    email: USER_EMAIL,
    dateOfBirth: "1983-03-22",
    stage: "peri",
    symptoms: ["hot_flash", "night_sweats", "fatigue", "brain_fog", "anxiety", "joint_pain"],
    goals: ["manage_symptoms", "improve_sleep", "understand_changes"],
    onboardingComplete: true,
    height: "5'6",
    weight: "145",
    relationship: "married",
    workStatus: "full_time",
    children: "2",
    exerciseFrequency: "3_per_week",
    periodTrackingEnabled: true,
    periodEnabledAt: daysAgo(20),
    periodHomeWidget: true,
    periodPredictions: true,
    periodReminders: true,
    periodCrossInsights: true,
    programStartedAt: daysAgo(21),
  };

  if (existingProfile) {
    await db.update(profiles).set(profileData).where(eq(profiles.userId, clerkUserId));
  } else {
    await db.insert(profiles).values({ userId: clerkUserId, ...profileData });
  }
  console.log("   ✅ Profile created/updated");

  // ── 3. Build day-by-day context model ─────────────────────────────────
  console.log("\n3️⃣  Building day-by-day realism model...");
  const dayContexts: DayContext[] = [];
  let prevCtx: DayContext | null = null;
  for (let day = 21; day >= 0; day--) {
    const ctx = buildDayContext(day, prevCtx);
    dayContexts.push(ctx);
    prevCtx = ctx;
  }
  // dayContexts[0] = day 21 (oldest), dayContexts[21] = day 0 (today)

  // ── 4. Daily Logs (21 days × 2 entries) ───────────────────────────────
  console.log("\n4️⃣  Generating 21 days of daily logs...");
  const logRows: any[] = [];

  for (const ctx of dayContexts) {
    const d = daysAgo(ctx.dayNum);
    const ds = dateStr(d);

    // ─── Symptom modifiers based on context ───
    const symptomMultiplier =
      (ctx.isPeriod ? 1.4 : 1.0) *
      (ctx.cumulativeSleepDebt > 0.5 ? 1.3 : 1.0) *
      (ctx.isWorkStress ? 1.2 : 1.0) *
      (ctx.exercised ? 0.7 : 1.0);

    // ─── Morning log ───
    const sleepHours = ctx.prevSleepHours;
    const sleepQuality =
      sleepHours >= 7.5 ? "amazing" :
      sleepHours >= 6.5 ? "good" :
      sleepHours >= 5.5 ? "ok" :
      sleepHours >= 4.5 ? "poor" :
      "terrible";
    const disruptions =
      sleepHours >= 7 ? rand(0, 1) :
      sleepHours >= 5.5 ? rand(1, 2) :
      rand(2, 4);

    const morningSymptoms: Record<string, number> = {};
    for (const s of SYMPTOM_POOL) {
      const adjustedChance = Math.min(0.9, s.baseChance * symptomMultiplier);
      if (chance(adjustedChance)) {
        morningSymptoms[s.key] = s.severity();
      }
    }

    // Mood: 1-5, affected by sleep + stress + exercise
    let morningMood = 3;
    if (sleepHours >= 7) morningMood += 1;
    if (sleepHours < 5.5) morningMood -= 1;
    if (ctx.isWorkStress) morningMood -= chance(0.5) ? 1 : 0;
    if (ctx.exercised) morningMood += chance(0.6) ? 1 : 0;
    if (ctx.isWeekend) morningMood += chance(0.4) ? 1 : 0;
    morningMood = Math.max(1, Math.min(5, morningMood + (chance(0.3) ? pick([-1, 1]) : 0)));

    let morningEnergy = 3;
    if (sleepHours >= 7) morningEnergy += 1;
    if (sleepHours < 5.5) morningEnergy -= 1;
    if (ctx.cumulativeSleepDebt > 0.8) morningEnergy -= 1;
    if (ctx.exercised) morningEnergy += chance(0.5) ? 1 : 0;
    morningEnergy = Math.max(1, Math.min(5, morningEnergy + (chance(0.2) ? pick([-1, 1]) : 0)));

    const morningTags: string[] = [];
    if (ctx.isWorkStress) morningTags.push(pick(MORNING_STRESSORS));
    if (ctx.exercised) morningTags.push("exercise");
    if (chance(0.3)) morningTags.push(pick(["quiet"]));

    logRows.push({
      userId: clerkUserId,
      date: ds,
      loggedAt: new Date(d.getTime() + rand(6, 8) * 3600000 + rand(0, 59) * 60000),
      symptomsJson: morningSymptoms,
      mood: morningMood,
      energy: morningEnergy,
      sleepHours: Math.round(sleepHours * 10) / 10,
      sleepQuality,
      disruptions,
      contextTags: morningTags,
      notes: null,
      logType: "morning",
    });

    // ─── Evening log ───
    const eveningSymptoms: Record<string, number> = {};
    for (const s of SYMPTOM_POOL) {
      // Evening symptoms: slightly different distribution
      const eveningChance = Math.min(0.85, s.baseChance * 0.8 * symptomMultiplier);
      if (chance(eveningChance)) {
        eveningSymptoms[s.key] = s.severity();
      }
    }

    let eveningMood = Math.max(1, morningMood + (chance(0.4) ? pick([-1, 0, 0, 1]) : 0));
    let eveningEnergy = Math.max(1, morningEnergy - rand(0, 2));
    eveningMood = Math.max(1, Math.min(5, eveningMood));
    eveningEnergy = Math.max(1, Math.min(5, eveningEnergy));

    const eveningTags: string[] = [];
    if (ctx.isWorkStress && chance(0.5)) eveningTags.push(pick(EVENING_STRESSORS));
    if (chance(0.4)) eveningTags.push(pick(EVENING_ACTIVITIES));
    if (ctx.hadAlcohol) eveningTags.push("social");

    const eveningNotes = chance(0.25)
      ? pick([
          "Tough day but managing",
          "Feeling okay tonight",
          "Better than yesterday",
          "Exhausted but grateful",
          "Hot flash at work was embarrassing",
          "Exercise helped my mood today",
          "Taking it one day at a time",
          "Brain fog was bad this afternoon",
        ])
      : null;

    logRows.push({
      userId: clerkUserId,
      date: ds,
      loggedAt: new Date(d.getTime() + rand(19, 22) * 3600000 + rand(0, 59) * 60000),
      symptomsJson: eveningSymptoms,
      mood: eveningMood,
      energy: eveningEnergy,
      contextTags: eveningTags,
      notes: eveningNotes,
      logType: "evening",
    });
  }
  await db.insert(dailyLogs).values(logRows);
  console.log(`   ✅ ${logRows.length} daily log entries created`);

  // ── 5. Medications ────────────────────────────────────────────────────
  console.log("\n5️⃣  Creating medications & med logs...");
  const [med1] = await db.insert(medications).values({
    userId: clerkUserId, name: "Estradiol (HRT)", dose: "1mg",
    time: "morning", frequency: "daily", type: "hormone", active: true,
  }).returning();

  const [med2] = await db.insert(medications).values({
    userId: clerkUserId, name: "Magnesium Glycinate", dose: "400mg",
    time: "evening", frequency: "daily", type: "supplement", active: true,
  }).returning();

  const [med3] = await db.insert(medications).values({
    userId: clerkUserId, name: "Vitamin D", dose: "2000 IU",
    time: "morning", frequency: "daily", type: "supplement", active: true,
  }).returning();

  const medLogRows: any[] = [];
  for (const ctx of dayContexts) {
    const d = daysAgo(ctx.dayNum);
    const ds = dateStr(d);
    for (const med of [med1, med2, med3]) {
      // Slightly lower adherence on weekends
      const adherenceRate = ctx.isWeekend ? 0.78 : 0.88;
      const taken = chance(adherenceRate);
      medLogRows.push({
        userId: clerkUserId, medicationId: med.id, date: ds, taken,
        takenAt: taken ? new Date(d.getTime() + (med.time === "morning" ? rand(7, 9) : rand(20, 22)) * 3600000) : null,
      });
    }
  }
  await db.insert(medLogs).values(medLogRows);
  console.log(`   ✅ 3 medications + ${medLogRows.length} med logs created`);

  // ── 6. Computed Scores ────────────────────────────────────────────────
  console.log("\n6️⃣  Generating computed scores...");
  const scoreRows: any[] = [];
  let currentStreak = 0;

  for (let i = 0; i < dayContexts.length; i++) {
    const ctx = dayContexts[i];
    currentStreak++;
    const d = daysAgo(ctx.dayNum);
    const ds = dateStr(d);

    // Readiness = weighted: sleep 35%, mood 25%, symptom load 25%, consistency 15%
    const sleepScore = Math.min(100, Math.round(ctx.prevSleepHours / 8 * 100));
    const moodScore = rand(40, 90); // placeholder, ideally derived from morning log
    const symptomCount = Object.keys(logRows[i * 2]?.symptomsJson || {}).length;
    const symptomLoad = Math.min(100, symptomCount * 12 + rand(5, 15));
    const consistencyScore = Math.min(100, currentStreak * 5);
    const medAdherence = chance(0.85) ? rand(80, 100) : rand(50, 79);

    const readiness = Math.round(
      sleepScore * 0.35 +
      moodScore * 0.25 +
      (100 - symptomLoad) * 0.25 +
      consistencyScore * 0.15
    );

    scoreRows.push({
      userId: clerkUserId, date: ds,
      readiness: Math.max(20, Math.min(95, readiness)),
      sleepScore,
      symptomLoad,
      streak: currentStreak,
      recommendation: null, // will be AI-generated on request
      componentsJson: {
        sleep: sleepScore,
        mood: moodScore,
        symptom: 100 - symptomLoad,
        stressor: ctx.isWorkStress ? rand(20, 50) : rand(60, 90),
        consistency: consistencyScore,
        meds: medAdherence,
      },
    });
  }
  await db.insert(computedScores).values(scoreRows);
  console.log(`   ✅ ${scoreRows.length} computed scores created`);

  // ── 7. User Correlations ──────────────────────────────────────────────
  console.log("\n7️⃣  Creating user correlations...");
  await db.insert(userCorrelations).values([
    {
      userId: clerkUserId,
      factorA: "sleep_under_6h", factorB: "hot_flash",
      direction: "positive", confidence: 0.78, effectSizePct: 42,
      occurrences: 8, totalOpportunities: 12, lagDays: 0,
    },
    {
      userId: clerkUserId,
      factorA: "alcohol", factorB: "night_sweats",
      direction: "positive", confidence: 0.72, effectSizePct: 55,
      occurrences: 5, totalOpportunities: 7, lagDays: 0,
    },
    {
      userId: clerkUserId,
      factorA: "exercise", factorB: "brain_fog",
      direction: "negative", confidence: 0.81, effectSizePct: 35,
      occurrences: 9, totalOpportunities: 12, lagDays: 0,
    },
    {
      userId: clerkUserId,
      factorA: "med_magnesium_glycinate", factorB: "sleep_quality",
      direction: "negative", confidence: 0.69, effectSizePct: 28,
      occurrences: 15, totalOpportunities: 19, lagDays: 0,
    },
    {
      userId: clerkUserId,
      factorA: "work_stress", factorB: "anxiety",
      direction: "positive", confidence: 0.65, effectSizePct: 38,
      occurrences: 6, totalOpportunities: 10, lagDays: 0,
    },
    {
      userId: clerkUserId,
      factorA: "caffeine_after_2pm", factorB: "fatigue",
      direction: "positive", confidence: 0.61, effectSizePct: 31,
      occurrences: 4, totalOpportunities: 6, lagDays: 1,
    },
  ]);
  console.log("   ✅ 6 correlations created (diverse factors + symptoms)");

  // ── 8. SOS Events ────────────────────────────────────────────────────
  console.log("\n8️⃣  Creating SOS events...");
  await db.insert(sosEvents).values([
    { userId: clerkUserId, startedAt: daysAgo(18), completed: true, durationSeconds: 180, rating: "better" },
    { userId: clerkUserId, startedAt: daysAgo(10), completed: true, durationSeconds: 240, rating: "better" },
    { userId: clerkUserId, startedAt: daysAgo(3), completed: true, durationSeconds: 120, rating: "rough" },
  ]);
  console.log("   ✅ 3 SOS events created");

  // ── 9. Content Engagement ─────────────────────────────────────────────
  console.log("\n9️⃣  Creating content engagement...");
  // Get real content IDs from DB
  const allContent = await db
    .select({ id: content.id })
    .from(content)
    .limit(25);
  const contentIds = allContent.map((c) => c.id);

  const engagementRows: any[] = [];
  for (let i = 0; i < 10; i++) {
    engagementRows.push({
      userId: clerkUserId,
      contentId: contentIds.length > 0 ? pick(contentIds) : rand(1, 25),
      action: pick(["listen", "read", "complete", "listen", "listen"]),
      progressPercent: pick([100, 100, 85, 60, 100]),
      durationSeconds: rand(120, 900),
      rating: chance(0.5) ? rand(3, 5) : null,
      createdAt: daysAgo(rand(1, 20)),
    });
  }
  await db.insert(contentEngagement).values(engagementRows);
  console.log(`   ✅ ${engagementRows.length} content engagements created`);

  // ── 10. Program Progress (14-day format) ──────────────────────────────
  console.log("\n🔟  Creating 14-day program progress...");
  // Look up actual program content IDs from DB
  const programContent = await db
    .select({ id: content.id, programDay: content.programDay })
    .from(content)
    .where(isNotNull(content.programDay));

  const progressRows: any[] = [];
  if (programContent.length > 0) {
    // She's been doing the program for 21 days but has completed 10 episodes
    // (she skipped a few days, matching the "don't rush" logic)
    for (const pc of programContent) {
      const day = pc.programDay ?? 0;
      const completed = day <= 10;
      progressRows.push({
        userId: clerkUserId,
        week: day <= 3 ? 1 : day <= 6 ? 2 : day <= 9 ? 3 : day <= 12 ? 4 : 5,
        lessonId: String(pc.id),
        completed,
        completedAt: completed ? daysAgo(21 - day) : null,
      });
    }
  } else {
    // Fallback if no program content in DB
    for (let day = 1; day <= 14; day++) {
      const completed = day <= 10;
      progressRows.push({
        userId: clerkUserId,
        week: day <= 3 ? 1 : day <= 6 ? 2 : day <= 9 ? 3 : day <= 12 ? 4 : 5,
        lessonId: `day_${day}`,
        completed,
        completedAt: completed ? daysAgo(21 - day) : null,
      });
    }
  }
  await db.insert(programProgress).values(progressRows);
  console.log(`   ✅ ${progressRows.length} program progress entries created`);

  // ── 11. Narratives ────────────────────────────────────────────────────
  console.log("\n1️⃣1️⃣ Creating narratives...");
  const narrativeRows: any[] = [];
  for (let w = 0; w < 3; w++) {
    narrativeRows.push({
      userId: clerkUserId, date: dateStr(daysAgo(21 - w * 7)),
      type: "weekly_story", text: WEEKLY_NARRATIVES[w],
    });
  }
  for (let i = 0; i < 2; i++) {
    narrativeRows.push({
      userId: clerkUserId, date: dateStr(daysAgo(rand(0, 7))),
      type: "readiness", text: READINESS_NARRATIVES[i],
    });
  }
  await db.insert(narratives).values(narrativeRows);
  console.log(`   ✅ ${narrativeRows.length} narratives created`);

  // ── 12. Period Cycles & Bleeding Events ───────────────────────────────
  console.log("\n1️⃣2️⃣ Creating period cycles & bleeding events...");

  const [cycle1] = await db.insert(cycles).values({
    userId: clerkUserId, startDate: dateStr(daysAgo(21)),
    endDate: dateStr(daysAgo(4)), periodLength: 6, cycleLength: 28,
    peakFlow: "heavy", avgPain: 2.2, totalSymptoms: 8,
    dominantMood: "low", spottingEvents: 1, spottingDaysBeforeStart: 2,
    status: "completed",
  }).returning();

  const [cycle2] = await db.insert(cycles).values({
    userId: clerkUserId, startDate: dateStr(daysAgo(3)),
    endDate: null, periodLength: null, cycleLength: null,
    peakFlow: "medium", avgPain: 1.8, totalSymptoms: 4,
    dominantMood: "ok", spottingEvents: 1, spottingDaysBeforeStart: 1,
    status: "active",
  }).returning();

  const bleedingRows: any[] = [];
  // Cycle 1 bleeding (days 21-16)
  const c1Flows = ["medium", "heavy", "heavy", "medium", "light", "spotting"] as const;
  const c1Pains = ["moderate", "severe", "moderate", "mild", "mild", "none"] as const;
  for (let i = 0; i < 6; i++) {
    bleedingRows.push({
      userId: clerkUserId,
      type: i === 0 ? "period_start" : i === 5 ? "period_end" : "period_daily",
      eventDate: dateStr(daysAgo(21 - i)),
      flowIntensity: c1Flows[i],
      hasClotting: i <= 2,
      clotSize: i <= 1 ? "large" : i === 2 ? "small" : null,
      painLevel: c1Pains[i],
      symptoms: i <= 2 ? ["cramps", "bloating", "fatigue"] : ["fatigue"],
      mood: i <= 2 ? "low" : "ok",
      sourceCategory: "period",
      cycleId: cycle1.id,
    });
  }

  // Cycle 2 bleeding (days 3-0, active)
  const c2Flows = ["light", "medium", "medium", "medium"] as const;
  const c2Pains = ["mild", "moderate", "moderate", "mild"] as const;
  for (let i = 0; i < 4; i++) {
    bleedingRows.push({
      userId: clerkUserId,
      type: i === 0 ? "period_start" : "period_daily",
      eventDate: dateStr(daysAgo(3 - i)),
      flowIntensity: c2Flows[i],
      hasClotting: i === 1,
      clotSize: i === 1 ? "small" : null,
      painLevel: c2Pains[i],
      symptoms: i <= 1 ? ["cramps", "bloating"] : [],
      mood: pick(["ok", "low"]),
      sourceCategory: "period",
      cycleId: cycle2.id,
    });
  }

  await db.insert(bleedingEvents).values(bleedingRows);
  console.log(`   ✅ 2 cycles + ${bleedingRows.length} bleeding events created`);

  // Cycle Analytics
  await db.insert(cycleAnalytics).values({
    userId: clerkUserId, avgCycleLength: 28, avgPeriodLength: 5.5,
    cycleVariance: 6, cycleRangeMin: 25, cycleRangeMax: 34,
    cycleRangeLabel: "25–34 days", stage: "early_peri", stageConfidence: 0.65,
    variabilityTrend: "stable", flowTrend: "stable", longestGapDays: 34,
    predictedNextStart: dateStr(daysAgo(-25)), predictionWindowDays: 7,
    predictionConfidence: "medium", spotsBeforePeriodPct: 50, avgSpottingLeadDays: 1,
  }).onConflictDoNothing();
  console.log("   ✅ Cycle analytics created");

  // ── 13. Gratitude Entries ─────────────────────────────────────────────
  console.log("\n1️⃣3️⃣ Creating gratitude entries...");
  const gratitudeRows: any[] = [];
  const themes = Object.keys(GRATITUDE_TEXTS);
  for (let i = 0; i < 15; i++) {
    const theme = themes[i % themes.length];
    gratitudeRows.push({
      userId: clerkUserId, date: dateStr(daysAgo(rand(1, 20))),
      text: pick(GRATITUDE_TEXTS[theme]), theme,
      mood: rand(3, 5), time: chance(0.7) ? "morning" : "evening",
    });
  }
  await db.insert(gratitudeEntries).values(gratitudeRows);
  console.log(`   ✅ ${gratitudeRows.length} gratitude entries created`);

  // ── Summary ───────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(50));
  console.log("🎉 SEED COMPLETE!");
  console.log("═".repeat(50));
  console.log(`\n📧 Email:    ${USER_EMAIL}`);
  console.log(`🆔 Clerk ID: ${clerkUserId}`);
  console.log(`\n📊 Data summary (3 weeks):`);
  console.log(`   • ${logRows.length} daily logs (22 days × 2)`);
  console.log(`   • 3 medications + ${medLogRows.length} med logs`);
  console.log(`   • ${scoreRows.length} computed scores`);
  console.log(`   • 6 correlations (all unique factors)`);
  console.log(`   • 3 SOS events`);
  console.log(`   • ${engagementRows.length} content engagements`);
  console.log(`   • ${progressRows.length} program progress entries (14-day format)`);
  console.log(`   • ${narrativeRows.length} narratives`);
  console.log(`   • 2 cycles + ${bleedingRows.length} bleeding events`);
  console.log(`   • ${gratitudeRows.length} gratitude entries`);
  console.log(`\n🌸 Log in via the Expo app with this account.\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
