/**
 * Shared types for the Pause content production pipeline.
 */

// ── Content Types (matching DB schema) ──────────────────────────────────────

export type ContentType = "podcast" | "lesson" | "meditation" | "affirmation" | "article" | "guide";
export type ContentFormat = "audio" | "text" | "pdf";
export type ContentStatus = "draft" | "ready" | "scheduled" | "published";
export type ContentCategory =
  | "Sleep"
  | "Hot Flashes"
  | "Mood"
  | "Nutrition"
  | "Movement"
  | "Relationships"
  | "Treatment"
  | "Wellness"
  | "Basics";

export type ProductionTool =
  | "NotebookLM"
  | "Wondercraft"
  | "ElevenLabs"
  | "Claude"
  | "Combined"
  | "Manual";

// ── Pipeline Types ──────────────────────────────────────────────────────────

export type PipelineStage = "research" | "writing" | "audio" | "production" | "publishing";
export type PipelineStatus = "pending" | "in_progress" | "completed" | "failed" | "waiting_manual";

export interface ContentItem {
  id: number;
  title: string;
  slug: string | null;
  contentType: ContentType;
  format: ContentFormat;
  description: string | null;
  bodyMarkdown: string | null;
  audioUrl: string | null;
  durationMinutes: number | null;
  category: ContentCategory | null;
  tags: string[];
  productionTool: ProductionTool | null;
  status: ContentStatus;
  programWeek: number | null;
  programDay: number | null;
  programAction: string | null;
}

export interface PipelineRecord {
  id: number;
  contentId: number;
  stage: PipelineStage;
  status: PipelineStatus;
  tool: string | null;
  outputPath: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

// ── Research Types ──────────────────────────────────────────────────────────

export interface PubMedAbstract {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  year: number;
}

export interface ResearchBrief {
  contentId: number;
  slug: string;
  topic: string;
  category: string;
  keyFindings: string[];
  statistics: string[];
  expertQuotes: string[];
  misconceptions: string[];
  safetyDisclaimers: string[];
  sources: { pmid: string; title: string; year: number }[];
  generatedAt: string;
}

// ── Writer Types ────────────────────────────────────────────────────────────

export interface ScriptOutput {
  contentId: number;
  slug: string;
  contentType: ContentType;
  title: string;
  script: string;
  wordCount: number;
  estimatedMinutes: number;
  generatedAt: string;
}

// ── Audio Types ─────────────────────────────────────────────────────────────

export interface AudioSegment {
  speaker: string; // "Alex" | "Sam" | "Narrator"
  text: string;
  index: number;
}

export interface AudioGenerationResult {
  contentId: number;
  tool: "elevenlabs" | "wondercraft";
  outputPath: string;
  durationSeconds: number;
  fileSizeBytes: number;
}

// ── Producer Types ──────────────────────────────────────────────────────────

export interface ProducerConfig {
  introClipPath: string;
  outroClipPath: string;
  ambientMusicPath?: string;
  loudnessTarget: number; // LUFS, e.g. -16 for podcasts, -20 for meditations
  musicVolume: number; // 0-1, e.g. 0.15 for subtle background
}

// ── Publisher Types ─────────────────────────────────────────────────────────

export interface PublishResult {
  contentId: number;
  audioUrl?: string;
  bodyMarkdown?: string;
  status: ContentStatus;
  publishedAt: string;
}

// ── CLI Types ───────────────────────────────────────────────────────────────

export interface PipelineOptions {
  id?: number;
  type?: ContentType;
  week?: number;
  stage?: PipelineStage;
  dryRun?: boolean;
  verbose?: boolean;
  autoPublish?: boolean;
}
