/**
 * Seed a fully-loaded test user with 2 months of realistic perimenopause data.
 * Run: NEON_DATABASE_URL="..." npx tsx scripts/seed-test-user.ts
 *
 * Creates:
 *  - Clerk user (emma@pausetest.com / PauseTest2026!)
 *  - Profile with period tracking enabled
 *  - 60 days of morning + evening daily logs
 *  - 3 medications + 60 days of med logs (~85% adherence)
 *  - 60 computed scores (readiness, sleep, symptom, streak)
 *  - 6 user correlations
 *  - 5 SOS events
 *  - 15 content engagements
 *  - 3 weeks program progress
 *  - 8 weekly + 4 readiness narratives
 *  - 3 period cycles (irregular peri pattern, cycle 3 active)
 *  - 35 gratitude entries across 5 themes
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
} from "../src/db/schema";

// ── Config ──────────────────────────────────────────────────────────────────
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY!;
const USER_EMAIL = "emma@pausetest.com";
const USER_PASSWORD = "PauseTest2026!";
const USER_NAME = "Emma Thompson";

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

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chance(pct: number): boolean {
  return Math.random() < pct;
}

// ── Symptom & context pools ─────────────────────────────────────────────────
const SYMPTOM_POOL = [
  { name: "hot_flashes", severity: () => rand(1, 3) },
  { name: "night_sweats", severity: () => rand(1, 3) },
  { name: "sleep_disruption", severity: () => rand(1, 2) },
  { name: "mood_changes", severity: () => rand(1, 3) },
  { name: "brain_fog", severity: () => rand(1, 2) },
  { name: "joint_pain", severity: () => rand(1, 2) },
];

const MORNING_STRESSORS = ["work_deadline", "poor_sleep", "family_stress", "running_late", "health_worry"];
const EVENING_STRESSORS = ["long_day", "argument", "news_stress", "money_worry", "childcare"];
const MORNING_ACTIVITIES = ["yoga", "walk", "meditation", "journaling", "exercise"];
const EVENING_ACTIVITIES = ["reading", "bath", "tv", "cooking", "stretching"];
const SUBSTANCES = ["caffeine", "alcohol", "sugar", "processed_food"];

// ── Gratitude text pools ────────────────────────────────────────────────────
const GRATITUDE_TEXTS: Record<string, string[]> = {
  people: [
    "My daughter making me laugh at breakfast",
    "A kind message from my sister checking in on me",
    "Coffee with Sarah — she always knows what to say",
    "My partner bringing me tea without asking",
    "A surprise video call from Mum",
    "My colleague covering for me when I was struggling",
    "The way my dog greets me every morning",
  ],
  health: [
    "Woke up feeling rested for once",
    "No hot flashes during my meeting today",
    "My joints didn't ache on the morning walk",
    "Slept through the night — first time this week",
    "Had energy to cook a proper dinner",
    "Brain fog lifted by midday and I felt sharp",
    "My HRT seems to be helping — fewer night sweats",
  ],
  moments: [
    "The sunlight coming through the kitchen window",
    "A perfect cup of tea at just the right temperature",
    "Birds singing outside while I journaled",
    "Finding a quiet moment to just breathe",
    "The smell of fresh laundry",
    "A really good podcast episode on my commute",
    "Rain on the window while I was cosy inside",
  ],
  comfort: [
    "My favourite blanket and a good book",
    "A warm bath with lavender oil",
    "Clean sheets on the bed tonight",
    "My morning coffee ritual — just me and the quiet",
    "Putting on my comfiest jumper after a long day",
    "A home-cooked meal that turned out perfectly",
    "The feeling of getting into bed early",
  ],
  growth: [
    "Managed to meditate for 10 minutes without giving up",
    "Said no to something that would have overwhelmed me",
    "Recognised my anxiety and used a breathing technique",
    "Started tracking my symptoms — feels empowering",
    "Had an honest conversation about how I'm feeling",
    "Went for a walk even though I didn't feel like it",
    "Read a chapter about perimenopause and felt less alone",
  ],
};

// ── Narrative templates ─────────────────────────────────────────────────────
const WEEKLY_NARRATIVES = [
  "This week you logged consistently — 7 out of 7 days. Your sleep averaged 6.2 hours with 1.4 disruptions per night. Hot flashes appeared on 5 days but were mostly mild. Your mood was best on days you exercised. Keep going, Emma.",
  "A mixed week. Sleep quality dipped mid-week (Tuesday–Thursday) correlating with higher stress tags. But you bounced back — Friday and Saturday showed your best mood scores. Night sweats were less frequent than last week.",
  "Your best week yet for symptom management. Magnesium adherence was 100% and your sleep quality improved noticeably. Brain fog only appeared twice. Your readiness scores averaged 68 — up from 61 last week.",
  "Tough few days around Wednesday when hot flashes peaked at severity 3. But your evening routines (bath, reading) seem to be helping — nights after those activities showed fewer disruptions. Your streak is at 14 days.",
  "Sleep was the story this week — averaging 7.1 hours, your best since you started tracking. Joint pain was persistent but mild. You used the SOS feature once on Monday which shows good self-awareness.",
  "Interesting pattern emerging: your mood scores are consistently higher on days you walk in the morning. Symptom load was moderate this week. HRT + magnesium combo continues to show benefits for night sweats.",
  "Your 6-week mark! You've logged 42 days in a row. Hot flashes are trending down slightly — from 4.2/week to 3.5/week. Sleep disruptions also improving. The data suggests your current routine is working.",
  "This week brought some new challenges with brain fog on 4 days. But your overall readiness stayed above 60, and your gratitude journal is growing beautifully with 5 new entries. Remember: progress isn't always linear.",
];

const READINESS_NARRATIVES = [
  "Your readiness is 72 today. Good sleep (7h, 1 disruption) and stable mood are helping. Mild joint pain noted. Your magnesium last night may have contributed to better rest.",
  "Readiness at 58 — a dip from yesterday. Only 5.5 hours sleep with 2 disruptions and a hot flash at 3am. Take it easy today, Emma. Your body needs gentleness.",
  "Strong day ahead — readiness 78. You slept well, took all your meds, and your symptom load is low. Days like this are evidence that your routine works.",
  "Readiness 65 — moderate. Brain fog and fatigue are pulling your score down, but mood is good. A short walk could help lift energy levels this afternoon.",
];

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌸 Pause Test User Seeder");
  console.log("─".repeat(50));

  // ── 1. Create Clerk user ──────────────────────────────────────────────────
  console.log("\n1️⃣  Creating Clerk user...");
  let clerkUserId: string;
  try {
    const user = await clerk.users.createUser({
      emailAddress: [USER_EMAIL],
      password: USER_PASSWORD,
      firstName: "Emma",
      lastName: "Thompson",
    });
    clerkUserId = user.id;
    console.log(`   ✅ Created: ${USER_EMAIL} (Clerk ID: ${clerkUserId})`);
  } catch (err: any) {
    // If user already exists, find them
    if (err?.errors?.[0]?.code === "form_identifier_exists") {
      console.log("   ⚠️  User already exists, looking up...");
      const users = await clerk.users.getUserList({ emailAddress: [USER_EMAIL] });
      if (users.data.length === 0) throw new Error("User exists but can't find them");
      clerkUserId = users.data[0].id;
      console.log(`   ✅ Found existing: ${clerkUserId}`);
    } else {
      throw err;
    }
  }

  // ── 2. Profile ────────────────────────────────────────────────────────────
  console.log("\n2️⃣  Creating profile...");
  await db.insert(profiles).values({
    userId: clerkUserId,
    name: USER_NAME,
    email: USER_EMAIL,
    dateOfBirth: "1981-06-15",
    stage: "peri",
    symptoms: ["hot_flashes", "night_sweats", "sleep_disruption", "mood_changes", "brain_fog", "joint_pain"],
    goals: ["manage_symptoms", "improve_sleep", "understand_changes"],
    onboardingComplete: true,
    height: "168",
    weight: "72",
    relationship: "partnered",
    workStatus: "full_time",
    children: "yes",
    exerciseFrequency: "3_per_week",
    periodTrackingEnabled: true,
    periodEnabledAt: daysAgo(55),
    periodHomeWidget: true,
    periodPredictions: true,
    periodReminders: true,
    periodCrossInsights: true,
  }).onConflictDoNothing();
  console.log("   ✅ Profile created");

  // ── 3. Daily Logs (60 days × 2 entries) ───────────────────────────────────
  console.log("\n3️⃣  Generating 60 days of daily logs...");
  const logRows: any[] = [];
  for (let day = 60; day >= 1; day--) {
    const d = daysAgo(day);
    const ds = dateStr(d);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const baseMood = isWeekend ? rand(3, 5) : rand(2, 4);
    const baseEnergy = isWeekend ? rand(3, 5) : rand(2, 4);

    // Morning entry
    const morningSleep = 4.5 + Math.random() * 3.5; // 4.5–8h
    const morningSleepQuality = morningSleep > 7 ? "good" : morningSleep > 5.5 ? "fair" : "poor";
    const morningDisruptions = morningSleep > 7 ? rand(0, 1) : rand(1, 3);
    const morningSymptoms: Record<string, number> = {};
    SYMPTOM_POOL.filter(() => chance(0.5)).forEach((s) => { morningSymptoms[s.name] = s.severity(); });

    const morningStressors = chance(0.4) ? [pick(MORNING_STRESSORS)] : [];
    const morningActivities = chance(0.6) ? [pick(MORNING_ACTIVITIES)] : [];

    // Gratitude text for morning notes (JSON format matching quick-log)
    const gratefulText = chance(0.6)
      ? pick(Object.values(GRATITUDE_TEXTS).flat())
      : "";
    const morningNotes = JSON.stringify({
      grateful: gratefulText,
      intention: chance(0.5) ? pick(["Be gentle with myself", "Stay present", "Move my body", "Drink more water", "Take breaks"]) : "",
    });

    logRows.push({
      userId: clerkUserId,
      date: ds,
      loggedAt: new Date(d.getTime() + 7 * 3600000), // 7am
      symptomsJson: morningSymptoms,
      mood: baseMood,
      energy: baseEnergy,
      sleepHours: Math.round(morningSleep * 10) / 10,
      sleepQuality: morningSleepQuality,
      disruptions: morningDisruptions,
      contextTags: [...morningStressors, ...morningActivities],
      notes: morningNotes,
      logType: "morning",
    });

    // Evening entry
    const eveningMood = baseMood + (chance(0.3) ? -1 : chance(0.3) ? 1 : 0);
    const eveningEnergy = Math.max(1, baseEnergy - rand(0, 2));
    const eveningSymptoms: Record<string, number> = {};
    SYMPTOM_POOL.filter(() => chance(0.4)).forEach((s) => { eveningSymptoms[s.name] = s.severity(); });
    const eveningStressors = chance(0.3) ? [pick(EVENING_STRESSORS)] : [];
    const eveningActivities = chance(0.7) ? [pick(EVENING_ACTIVITIES)] : [];
    const eveningSubstances = chance(0.3) ? [pick(SUBSTANCES)] : [];

    logRows.push({
      userId: clerkUserId,
      date: ds,
      loggedAt: new Date(d.getTime() + 21 * 3600000), // 9pm
      symptomsJson: eveningSymptoms,
      mood: Math.max(1, Math.min(5, eveningMood)),
      energy: eveningEnergy,
      contextTags: [...eveningStressors, ...eveningActivities, ...eveningSubstances],
      notes: chance(0.3) ? pick(["Tough day but managing", "Feeling okay tonight", "Better than yesterday", "Need to rest more"]) : null,
      logType: "evening",
    });
  }
  await db.insert(dailyLogs).values(logRows);
  console.log(`   ✅ ${logRows.length} daily log entries created`);

  // ── 4. Medications ────────────────────────────────────────────────────────
  console.log("\n4️⃣  Creating medications & med logs...");
  const [med1] = await db.insert(medications).values({
    userId: clerkUserId,
    name: "Estradiol (HRT)",
    dose: "1mg",
    time: "morning",
    frequency: "daily",
    type: "hormone",
    active: true,
  }).returning();

  const [med2] = await db.insert(medications).values({
    userId: clerkUserId,
    name: "Magnesium Glycinate",
    dose: "400mg",
    time: "evening",
    frequency: "daily",
    type: "supplement",
    active: true,
  }).returning();

  const [med3] = await db.insert(medications).values({
    userId: clerkUserId,
    name: "Vitamin D",
    dose: "2000 IU",
    time: "morning",
    frequency: "daily",
    type: "supplement",
    active: true,
  }).returning();

  const medLogRows: any[] = [];
  for (let day = 60; day >= 1; day--) {
    const d = daysAgo(day);
    const ds = dateStr(d);
    for (const med of [med1, med2, med3]) {
      const taken = chance(0.85);
      medLogRows.push({
        userId: clerkUserId,
        medicationId: med.id,
        date: ds,
        taken,
        takenAt: taken ? new Date(d.getTime() + (med.time === "morning" ? 8 : 21) * 3600000) : null,
      });
    }
  }
  await db.insert(medLogs).values(medLogRows);
  console.log(`   ✅ 3 medications + ${medLogRows.length} med logs created`);

  // ── 5. Computed Scores ────────────────────────────────────────────────────
  console.log("\n5️⃣  Generating computed scores...");
  const scoreRows: any[] = [];
  let currentStreak = 0;
  for (let day = 60; day >= 1; day--) {
    currentStreak++;
    const d = daysAgo(day);
    const ds = dateStr(d);
    const readiness = rand(40, 85);
    const sleepScore = rand(35, 90);
    const symptomLoad = rand(15, 70);
    scoreRows.push({
      userId: clerkUserId,
      date: ds,
      readiness,
      sleepScore,
      symptomLoad,
      streak: currentStreak,
      recommendation: pick([
        "Light movement today could help with joint stiffness. Your sleep was decent — protect that momentum.",
        "Consider an earlier bedtime tonight. Your symptom load has been creeping up.",
        "Good day for self-care. Your readiness is strong — make the most of it.",
        "Take it gentle today. Your body is telling you it needs rest.",
        "Your magnesium routine is paying off. Keep prioritising evening wind-down.",
      ]),
      componentsJson: {
        sleep: sleepScore,
        mood: rand(40, 90),
        symptoms: 100 - symptomLoad,
        consistency: Math.min(100, currentStreak * 5),
        meds: chance(0.85) ? rand(80, 100) : rand(50, 79),
      },
    });
  }
  await db.insert(computedScores).values(scoreRows);
  console.log(`   ✅ ${scoreRows.length} computed scores created`);

  // ── 6. User Correlations ──────────────────────────────────────────────────
  console.log("\n6️⃣  Creating user correlations...");
  await db.insert(userCorrelations).values([
    {
      userId: clerkUserId,
      factorA: "sleep_under_6h",
      factorB: "hot_flashes",
      direction: "positive",
      confidence: 0.78,
      effectSizePct: 42,
      occurrences: 18,
      totalOpportunities: 24,
      lagDays: 0,
    },
    {
      userId: clerkUserId,
      factorA: "alcohol",
      factorB: "night_sweats",
      direction: "positive",
      confidence: 0.72,
      effectSizePct: 55,
      occurrences: 11,
      totalOpportunities: 15,
      lagDays: 0,
    },
    {
      userId: clerkUserId,
      factorA: "exercise",
      factorB: "mood",
      direction: "positive",
      confidence: 0.81,
      effectSizePct: 35,
      occurrences: 22,
      totalOpportunities: 28,
      lagDays: 0,
    },
    {
      userId: clerkUserId,
      factorA: "magnesium",
      factorB: "sleep_quality",
      direction: "positive",
      confidence: 0.69,
      effectSizePct: 28,
      occurrences: 38,
      totalOpportunities: 51,
      lagDays: 0,
    },
    {
      userId: clerkUserId,
      factorA: "work_stress",
      factorB: "brain_fog",
      direction: "positive",
      confidence: 0.65,
      effectSizePct: 38,
      occurrences: 14,
      totalOpportunities: 22,
      lagDays: 0,
    },
    {
      userId: clerkUserId,
      factorA: "caffeine_after_2pm",
      factorB: "sleep_disruption",
      direction: "positive",
      confidence: 0.61,
      effectSizePct: 31,
      occurrences: 9,
      totalOpportunities: 14,
      lagDays: 0,
    },
  ]);
  console.log("   ✅ 6 correlations created");

  // ── 7. SOS Events ────────────────────────────────────────────────────────
  console.log("\n7️⃣  Creating SOS events...");
  await db.insert(sosEvents).values([
    { userId: clerkUserId, startedAt: daysAgo(52), completed: true, durationSeconds: 180, rating: "helpful" },
    { userId: clerkUserId, startedAt: daysAgo(38), completed: true, durationSeconds: 240, rating: "very_helpful" },
    { userId: clerkUserId, startedAt: daysAgo(25), completed: true, durationSeconds: 120, rating: "helpful" },
    { userId: clerkUserId, startedAt: daysAgo(12), completed: false, durationSeconds: 60, rating: null },
    { userId: clerkUserId, startedAt: daysAgo(4), completed: true, durationSeconds: 300, rating: "very_helpful" },
  ]);
  console.log("   ✅ 5 SOS events created");

  // ── 8. Content Engagement ─────────────────────────────────────────────────
  console.log("\n8️⃣  Creating content engagement...");
  const engagementRows: any[] = [];
  for (let i = 1; i <= 15; i++) {
    engagementRows.push({
      userId: clerkUserId,
      contentId: rand(1, 25), // reference existing seeded content
      action: pick(["listen", "read", "complete", "listen", "listen"]),
      progressPercent: pick([100, 100, 85, 60, 100]),
      durationSeconds: rand(120, 900),
      rating: chance(0.5) ? rand(3, 5) : null,
      createdAt: daysAgo(rand(1, 55)),
    });
  }
  await db.insert(contentEngagement).values(engagementRows);
  console.log(`   ✅ ${engagementRows.length} content engagements created`);

  // ── 9. Program Progress ───────────────────────────────────────────────────
  console.log("\n9️⃣  Creating program progress...");
  const progressRows: any[] = [];
  // Weeks 1-3, 5 lessons per week
  for (let week = 1; week <= 3; week++) {
    for (let lesson = 1; lesson <= 5; lesson++) {
      const completed = week < 3 || lesson <= 3; // Week 3 partially done
      progressRows.push({
        userId: clerkUserId,
        week,
        lessonId: `w${week}_d${lesson}`,
        completed,
        completedAt: completed ? daysAgo(60 - (week - 1) * 7 - lesson) : null,
      });
    }
  }
  await db.insert(programProgress).values(progressRows);
  console.log(`   ✅ ${progressRows.length} program progress entries created`);

  // ── 10. Narratives ────────────────────────────────────────────────────────
  console.log("\n🔟  Creating narratives...");
  const narrativeRows: any[] = [];
  // 8 weekly narratives
  for (let w = 0; w < 8; w++) {
    narrativeRows.push({
      userId: clerkUserId,
      date: dateStr(daysAgo(60 - w * 7)),
      type: "weekly_story",
      text: WEEKLY_NARRATIVES[w],
    });
  }
  // 4 readiness narratives (scattered)
  for (let i = 0; i < 4; i++) {
    narrativeRows.push({
      userId: clerkUserId,
      date: dateStr(daysAgo(rand(1, 14))),
      type: "readiness",
      text: READINESS_NARRATIVES[i],
    });
  }
  await db.insert(narratives).values(narrativeRows);
  console.log(`   ✅ ${narrativeRows.length} narratives created`);

  // ── 11. Period Tracker: Bleeding Events + Cycles ──────────────────────────
  console.log("\n1️⃣1️⃣ Creating period cycles & bleeding events...");

  // Cycle 1: started 60 days ago, 6-day period
  const [cycle1] = await db.insert(cycles).values({
    userId: clerkUserId,
    startDate: dateStr(daysAgo(60)),
    endDate: dateStr(daysAgo(33)),
    periodLength: 6,
    cycleLength: 28,
    peakFlow: "heavy",
    avgPain: 2.2,
    totalSymptoms: 8,
    dominantMood: "low",
    spottingEvents: 1,
    spottingDaysBeforeStart: 2,
    status: "completed",
  }).returning();

  // Cycle 2: started 32 days ago, 5-day period
  const [cycle2] = await db.insert(cycles).values({
    userId: clerkUserId,
    startDate: dateStr(daysAgo(32)),
    endDate: dateStr(daysAgo(6)),
    periodLength: 5,
    cycleLength: 27,
    peakFlow: "medium",
    avgPain: 1.8,
    totalSymptoms: 5,
    dominantMood: "ok",
    spottingEvents: 0,
    status: "completed",
  }).returning();

  // Cycle 3: started 5 days ago, currently active
  const [cycle3] = await db.insert(cycles).values({
    userId: clerkUserId,
    startDate: dateStr(daysAgo(5)),
    endDate: null,
    periodLength: null,
    cycleLength: null,
    peakFlow: "heavy",
    avgPain: 2.0,
    totalSymptoms: 4,
    dominantMood: "low",
    spottingEvents: 1,
    spottingDaysBeforeStart: 1,
    status: "active",
  }).returning();

  // Bleeding events for Cycle 1 (days 60-55)
  const bleedingRows: any[] = [];
  const cycle1Flows = ["medium", "heavy", "heavy", "medium", "light", "spotting"];
  const cycle1Pains = ["moderate", "severe", "moderate", "mild", "mild", "none"];
  for (let i = 0; i < 6; i++) {
    bleedingRows.push({
      userId: clerkUserId,
      type: i === 0 ? "period_start" : i === 5 ? "period_end" : "period_daily",
      eventDate: dateStr(daysAgo(60 - i)),
      flowIntensity: cycle1Flows[i],
      hasClotting: i <= 2,
      clotSize: i <= 1 ? "large" : i === 2 ? "small" : null,
      painLevel: cycle1Pains[i],
      symptoms: i <= 2 ? ["cramps", "bloating", "fatigue"] : ["fatigue"],
      mood: i <= 2 ? "low" : "ok",
      sourceCategory: "period",
      cycleId: cycle1.id,
    });
  }

  // Spotting before cycle 1
  bleedingRows.push({
    userId: clerkUserId,
    type: "spotting",
    eventDate: dateStr(daysAgo(62)),
    flowIntensity: "spotting",
    painLevel: "none",
    symptoms: [],
    mood: "ok",
    sourceCategory: "spotting",
    cycleId: cycle1.id,
  });

  // Bleeding events for Cycle 2 (days 32-28)
  const cycle2Flows = ["light", "medium", "medium", "light", "spotting"];
  const cycle2Pains = ["mild", "moderate", "mild", "none", "none"];
  for (let i = 0; i < 5; i++) {
    bleedingRows.push({
      userId: clerkUserId,
      type: i === 0 ? "period_start" : i === 4 ? "period_end" : "period_daily",
      eventDate: dateStr(daysAgo(32 - i)),
      flowIntensity: cycle2Flows[i],
      hasClotting: i === 1,
      clotSize: i === 1 ? "small" : null,
      painLevel: cycle2Pains[i],
      symptoms: i <= 2 ? ["cramps", "bloating"] : [],
      mood: pick(["ok", "low", "ok", "good", "ok"]),
      sourceCategory: "period",
      cycleId: cycle2.id,
    });
  }

  // Spotting between cycles 2 and 3
  bleedingRows.push({
    userId: clerkUserId,
    type: "spotting",
    eventDate: dateStr(daysAgo(8)),
    flowIntensity: "spotting",
    painLevel: "none",
    symptoms: [],
    mood: "ok",
    sourceCategory: "spotting",
  });

  // Bleeding events for Cycle 3 (days 5-1, currently active)
  const cycle3Flows = ["medium", "heavy", "heavy", "medium", "medium"];
  const cycle3Pains = ["mild", "moderate", "moderate", "mild", "mild"];
  for (let i = 0; i < 5; i++) {
    bleedingRows.push({
      userId: clerkUserId,
      type: i === 0 ? "period_start" : "period_daily",
      eventDate: dateStr(daysAgo(5 - i)),
      flowIntensity: cycle3Flows[i],
      hasClotting: i >= 1 && i <= 2,
      clotSize: i === 1 ? "large" : i === 2 ? "small" : null,
      painLevel: cycle3Pains[i],
      symptoms: i <= 2 ? ["cramps", "bloating", "fatigue", "headache"] : ["fatigue"],
      mood: i <= 2 ? "low" : "ok",
      sourceCategory: "period",
      cycleId: cycle3.id,
    });
  }

  // Spotting before cycle 3
  bleedingRows.push({
    userId: clerkUserId,
    type: "spotting",
    eventDate: dateStr(daysAgo(6)),
    flowIntensity: "spotting",
    painLevel: "none",
    symptoms: [],
    mood: "ok",
    sourceCategory: "spotting",
    convertedFromSpotting: false,
    cycleId: cycle3.id,
  });

  await db.insert(bleedingEvents).values(bleedingRows);
  console.log(`   ✅ 3 cycles + ${bleedingRows.length} bleeding events created`);

  // ── Cycle Analytics ───────────────────────────────────────────────────────
  await db.insert(cycleAnalytics).values({
    userId: clerkUserId,
    avgCycleLength: 27.5,
    avgPeriodLength: 5.5,
    cycleVariance: 8,
    cycleRangeMin: 24,
    cycleRangeMax: 38,
    cycleRangeLabel: "24–38 days",
    stage: "mid_peri",
    stageConfidence: 0.72,
    variabilityTrend: "increasing",
    flowTrend: "stable",
    longestGapDays: 38,
    predictedNextStart: dateStr(daysAgo(-22)), // ~22 days from now
    predictionWindowDays: 7,
    predictionConfidence: "medium",
    spotsBeforePeriodPct: 66.7,
    avgSpottingLeadDays: 1.5,
  }).onConflictDoNothing();
  console.log("   ✅ Cycle analytics created");

  // ── 12. Gratitude Entries ─────────────────────────────────────────────────
  console.log("\n1️⃣2️⃣ Creating gratitude entries...");
  const gratitudeRows: any[] = [];
  const themes = Object.keys(GRATITUDE_TEXTS);
  for (let i = 0; i < 35; i++) {
    const theme = themes[i % themes.length]; // rotate through themes
    const dayOffset = rand(2, 58); // spread across 2 months
    gratitudeRows.push({
      userId: clerkUserId,
      date: dateStr(daysAgo(dayOffset)),
      text: pick(GRATITUDE_TEXTS[theme]),
      theme,
      mood: rand(3, 5),
      time: chance(0.7) ? "morning" : "evening",
    });
  }
  await db.insert(gratitudeEntries).values(gratitudeRows);
  console.log(`   ✅ ${gratitudeRows.length} gratitude entries created`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(50));
  console.log("🎉 SEED COMPLETE!");
  console.log("═".repeat(50));
  console.log(`\n📧 Email:    ${USER_EMAIL}`);
  console.log(`🔑 Password: ${USER_PASSWORD}`);
  console.log(`🆔 Clerk ID: ${clerkUserId}`);
  console.log(`\n📊 Data summary:`);
  console.log(`   • ${logRows.length} daily logs (60 days × 2)`);
  console.log(`   • 3 medications + ${medLogRows.length} med logs`);
  console.log(`   • ${scoreRows.length} computed scores`);
  console.log(`   • 6 correlations`);
  console.log(`   • 5 SOS events`);
  console.log(`   • ${engagementRows.length} content engagements`);
  console.log(`   • ${progressRows.length} program progress entries`);
  console.log(`   • ${narrativeRows.length} narratives`);
  console.log(`   • 3 cycles + ${bleedingRows.length} bleeding events`);
  console.log(`   • ${gratitudeRows.length} gratitude entries`);
  console.log(`\n🌸 Log in via the Expo app with the credentials above.\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
