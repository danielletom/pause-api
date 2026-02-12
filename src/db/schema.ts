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
export const dailyLogs = pgTable("daily_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: date("date").notNull(),
  symptomsJson: jsonb("symptoms_json"),
  mood: integer("mood"),
  energy: integer("energy"),
  sleepHours: real("sleep_hours"),
  sleepQuality: text("sleep_quality"),
  disruptions: integer("disruptions"),
  contextTags: jsonb("context_tags").default([]),
  cycleDataJson: jsonb("cycle_data_json"),
  notes: text("notes"),
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
