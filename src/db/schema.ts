import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  real,
  timestamp,
  date,
  jsonb,
} from "drizzle-orm/pg-core";

// ── Profiles ────────────────────────────────────────────────────────────────
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").unique().notNull(),
  name: text("name"),
  email: text("email"),
  dateOfBirth: text("date_of_birth"),
  stage: text("stage"),
  symptoms: jsonb("symptoms").default([]),
  goals: jsonb("goals").default([]),
  onboardingComplete: boolean("onboarding_complete").default(false),
  customSymptoms: jsonb("custom_symptoms").default([]),
  height: text("height"),
  weight: text("weight"),
  relationship: text("relationship"),
  workStatus: text("work_status"),
  children: text("children"),
  exerciseFrequency: text("exercise_frequency"),
  // Period tracking settings (opt-in feature)
  periodTrackingEnabled: boolean("period_tracking_enabled").default(false),
  periodEnabledAt: timestamp("period_enabled_at"),
  periodHomeWidget: boolean("period_home_widget").default(true),
  periodPredictions: boolean("period_predictions").default(true),
  periodReminders: boolean("period_reminders").default(true),
  periodCrossInsights: boolean("period_cross_insights").default(true),
  periodPromptDismissedAt: timestamp("period_prompt_dismissed_at"),
  menopauseDeclaredAt: timestamp("menopause_declared_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Subscriptions ───────────────────────────────────────────────────────────
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.userId),
  tier: text("tier").default("free"),
  provider: text("provider"),
  status: text("status").default("active"),
  startedAt: timestamp("started_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Daily Logs ──────────────────────────────────────────────────────────────
// Multiple entries per day — each check-in is a timestamped event
export const dailyLogs = pgTable("daily_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: date("date").notNull(),
  loggedAt: timestamp("logged_at").defaultNow(),
  symptomsJson: jsonb("symptoms_json"),
  mood: integer("mood"),
  energy: integer("energy"),
  sleepHours: real("sleep_hours"),
  sleepQuality: text("sleep_quality"),
  disruptions: integer("disruptions"),
  contextTags: jsonb("context_tags").default([]),
  cycleDataJson: jsonb("cycle_data_json"),
  notes: text("notes"),
  logType: text("log_type"), // 'morning' | 'evening' | null (legacy)
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Medications ─────────────────────────────────────────────────────────────
export const medications = pgTable("medications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  dose: text("dose"),
  time: text("time"),
  frequency: text("frequency").default("daily"),
  type: text("type"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Med Logs ────────────────────────────────────────────────────────────────
export const medLogs = pgTable("med_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  medicationId: integer("medication_id").notNull(),
  date: date("date").notNull(),
  taken: boolean("taken").default(false),
  takenAt: timestamp("taken_at"),
});

// ── Program Progress ────────────────────────────────────────────────────────
export const programProgress = pgTable("program_progress", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  week: integer("week").notNull(),
  lessonId: text("lesson_id").notNull(),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
});

// ── Articles ────────────────────────────────────────────────────────────────
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  bodyMarkdown: text("body_markdown"),
  category: text("category"),
  readTime: integer("read_time"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── SOS Events ──────────────────────────────────────────────────────────────
export const sosEvents = pgTable("sos_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  completed: boolean("completed").default(false),
  durationSeconds: integer("duration_seconds"),
  rating: text("rating"),
});

// ── Health Data ─────────────────────────────────────────────────────────────
export const healthData = pgTable("health_data", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  source: text("source"),
  date: date("date"),
  sleepJson: jsonb("sleep_json"),
  heartRateJson: jsonb("heart_rate_json"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Push Tokens ─────────────────────────────────────────────────────────────
export const pushTokens = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  expoToken: text("expo_token").notNull(),
  platform: text("platform"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Computed Scores ─────────────────────────────────────────────────────────
// Pre-computed daily readiness, sleep, symptom load, and streak
export const computedScores = pgTable("computed_scores", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: date("date").notNull(),
  readiness: integer("readiness"),
  sleepScore: integer("sleep_score"),
  symptomLoad: integer("symptom_load"),
  streak: integer("streak").default(0),
  recommendation: text("recommendation"), // AI-generated narrative (Phase 4)
  componentsJson: jsonb("components_json"), // { sleep: 85, mood: 60, ... }
  createdAt: timestamp("created_at").defaultNow(),
});

// ── User Correlations ───────────────────────────────────────────────────────
// Per-user cause/effect analysis from the correlation engine
export const userCorrelations = pgTable("user_correlations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  factorA: text("factor_a").notNull(), // e.g. "sleep_under_6h"
  factorB: text("factor_b").notNull(), // e.g. "hot_flash"
  direction: text("direction").notNull(), // "positive" | "negative"
  confidence: real("confidence").notNull(), // 0.0–1.0
  effectSizePct: real("effect_size_pct").notNull(),
  occurrences: integer("occurrences").notNull(),
  totalOpportunities: integer("total_opportunities").notNull(),
  lagDays: integer("lag_days").default(0),
  computedAt: timestamp("computed_at").defaultNow(),
});

// ── Benchmark Aggregates ────────────────────────────────────────────────────
// Anonymous peer comparison data, refreshed nightly
export const benchmarkAggregates = pgTable("benchmark_aggregates", {
  id: serial("id").primaryKey(),
  cohortKey: text("cohort_key").notNull(), // e.g. "perimenopause_40-44_moderate"
  symptom: text("symptom").notNull(),
  prevalencePct: real("prevalence_pct"),
  avgFrequency: real("avg_frequency"),
  avgSeverity: real("avg_severity"),
  p25Frequency: real("p25_frequency"),
  p50Frequency: real("p50_frequency"),
  p75Frequency: real("p75_frequency"),
  sampleSize: integer("sample_size").notNull(),
  computedAt: timestamp("computed_at").defaultNow(),
});

// ── Content Library ─────────────────────────────────────────────────────────
// All content: meditations, podcasts, lessons, guides, affirmations, articles
export const content = pgTable("content", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").unique(),
  contentType: text("content_type").notNull(), // 'podcast' | 'lesson' | 'meditation' | 'affirmation' | 'article' | 'guide'
  format: text("format").notNull(), // 'audio' | 'text' | 'pdf'
  description: text("description"),
  aiDescription: text("ai_description"), // AI-generated summary
  bodyMarkdown: text("body_markdown"), // for articles/guides
  audioUrl: text("audio_url"), // URL to audio file
  thumbnailUrl: text("thumbnail_url"),
  durationMinutes: integer("duration_minutes"),
  category: text("category"), // 'Sleep' | 'Hot Flashes' | 'Mood' | 'Nutrition' | etc.
  tags: jsonb("tags").default([]), // ['evening', 'sleep', 'calm', 'morning', 'anytime', etc.]
  productionTool: text("production_tool"), // 'NotebookLM' | 'Wondercraft' | 'ElevenLabs' | etc.
  status: text("status").default("draft"), // 'draft' | 'ready' | 'published'
  sortOrder: integer("sort_order").default(0),
  // Program assignment
  programId: text("program_id"), // 'main' (8-week), 'better_sleep', 'hot_flash_relief', 'mood_calm', 'movement', or custom
  programWeek: integer("program_week"), // 1-8, null if not in program
  programDay: integer("program_day"), // 1-5, null if not in program
  programAction: text("program_action"), // "Tonight's Plan Action" text
  // Metrics
  listensCount: integer("listens_count").default(0),
  readsCount: integer("reads_count").default(0),
  avgRating: real("avg_rating"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Content Engagement ──────────────────────────────────────────────────────
// Track per-user listens/reads
export const contentEngagement = pgTable("content_engagement", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  contentId: integer("content_id").notNull(),
  action: text("action").notNull(), // 'listen' | 'read' | 'complete' | 'bookmark'
  progressPercent: integer("progress_percent").default(0),
  durationSeconds: integer("duration_seconds"),
  rating: integer("rating"), // 1-5
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Narratives ──────────────────────────────────────────────────────────────
// Claude-generated weekly stories and readiness explanations
export const narratives = pgTable("narratives", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: date("date").notNull(),
  type: text("type").notNull(), // "weekly_story" | "readiness"
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Bleeding Events ─────────────────────────────────────────────────────────
// Period tracker: every bleeding entry the user creates
export const bleedingEvents = pgTable("bleeding_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  type: text("type").notNull(), // period_start, period_daily, period_end, spotting, light_bleeding, hrt_bleeding, post_meno_bleeding
  eventDate: date("event_date").notNull(),
  loggedAt: timestamp("logged_at").defaultNow(),
  flowIntensity: text("flow_intensity"), // spotting, light, medium, heavy, very_heavy
  hasClotting: boolean("has_clotting"),
  clotSize: text("clot_size"), // small, large
  painLevel: text("pain_level"), // none, mild, moderate, severe
  symptoms: jsonb("symptoms").default([]),
  mood: text("mood"), // terrible, low, ok, good, great
  sourceCategory: text("source_category").notNull(), // spotting, maybe_period, period, hrt, urgent
  convertedFromSpotting: boolean("converted_from_spotting").default(false),
  gpFlag: boolean("gp_flag").default(false),
  notes: text("notes"),
  cycleId: integer("cycle_id"), // FK to cycles.id (set when event belongs to a cycle)
});

// ── Cycles ──────────────────────────────────────────────────────────────────
// Period tracker: derived entity — one period_start to the next
export const cycles = pgTable("cycles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  periodLength: integer("period_length"),
  cycleLength: integer("cycle_length"),
  peakFlow: text("peak_flow"),
  avgPain: real("avg_pain"),
  totalSymptoms: integer("total_symptoms").default(0),
  dominantMood: text("dominant_mood"),
  spottingEvents: integer("spotting_events").default(0),
  spottingDaysBeforeStart: integer("spotting_days_before_start"),
  status: text("status").default("active"), // active, completed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Cycle Analytics ─────────────────────────────────────────────────────────
// Period tracker: computed aggregate stats per user (cached, recomputed on events)
export const cycleAnalytics = pgTable("cycle_analytics", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  computedAt: timestamp("computed_at").defaultNow(),
  avgCycleLength: real("avg_cycle_length"),
  avgPeriodLength: real("avg_period_length"),
  cycleVariance: integer("cycle_variance"),
  cycleRangeMin: integer("cycle_range_min"),
  cycleRangeMax: integer("cycle_range_max"),
  cycleRangeLabel: text("cycle_range_label"), // e.g. "4–7 weeks"
  stage: text("stage"), // early_peri, mid_peri, late_peri, approaching_menopause
  stageConfidence: real("stage_confidence"),
  variabilityTrend: text("variability_trend"), // stable, increasing, decreasing
  flowTrend: text("flow_trend"), // stable, heavier, lighter
  longestGapDays: integer("longest_gap_days"),
  predictedNextStart: date("predicted_next_start"),
  predictionWindowDays: integer("prediction_window_days"),
  predictionConfidence: text("prediction_confidence"), // low, medium, high
  spotsBeforePeriodPct: real("spots_before_period_pct"),
  avgSpottingLeadDays: real("avg_spotting_lead_days"),
});
