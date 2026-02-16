/**
 * Pipeline configuration — loads from environment variables.
 * Run scripts with: npx tsx --env-file=.env.local scripts/pipeline/index.ts
 */

import path from "path";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

// ── Paths ───────────────────────────────────────────────────────────────────

const PIPELINE_ROOT = path.resolve(__dirname);
const DATA_ROOT = path.join(PIPELINE_ROOT, "data");

export const paths = {
  pipelineRoot: PIPELINE_ROOT,
  dataRoot: DATA_ROOT,
  researchCache: path.join(DATA_ROOT, "research-cache"),
  scriptsOutput: path.join(DATA_ROOT, "scripts-output"),
  audioStaging: path.join(DATA_ROOT, "audio-staging"),
  // Pre-recorded assets (create these once)
  assets: path.join(DATA_ROOT, "assets"),
};

// ── Database ────────────────────────────────────────────────────────────────

export const database = {
  get url() {
    return requireEnv("NEON_DATABASE_URL");
  },
};

// ── Anthropic (Claude) ──────────────────────────────────────────────────────

export const claude = {
  get apiKey() {
    return requireEnv("ANTHROPIC_API_KEY");
  },
  defaultModel: optionalEnv("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
  maxOutputTokens: 4096,
};

// ── ElevenLabs ──────────────────────────────────────────────────────────────

export const elevenlabs = {
  apiKey: optionalEnv("ELEVENLABS_API_KEY", ""),
  // Voice IDs — set these after selecting voices in the ElevenLabs dashboard
  narratorVoiceId: optionalEnv("ELEVENLABS_NARRATOR_VOICE_ID", ""),
  hostAlexVoiceId: optionalEnv("ELEVENLABS_HOST_ALEX_VOICE_ID", ""),
  hostSamVoiceId: optionalEnv("ELEVENLABS_HOST_SAM_VOICE_ID", ""),
  modelId: optionalEnv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"),
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.0,
  speakerBoost: true,
};

// ── Wondercraft ─────────────────────────────────────────────────────────────

export const wondercraft = {
  apiKey: optionalEnv("WONDERCRAFT_API_KEY", ""),
  voiceProfile: optionalEnv("WONDERCRAFT_VOICE_PROFILE", ""),
  defaultBackgroundMusic: "ambient_nature",
  musicVolume: 0.15,
};

// ── Cloudflare R2 ───────────────────────────────────────────────────────────

export const r2 = {
  accountId: optionalEnv("R2_ACCOUNT_ID", ""),
  accessKeyId: optionalEnv("R2_ACCESS_KEY_ID", ""),
  secretAccessKey: optionalEnv("R2_SECRET_ACCESS_KEY", ""),
  bucket: optionalEnv("R2_BUCKET", "pause-content"),
  publicUrl: optionalEnv("R2_PUBLIC_URL", ""), // e.g. https://content.pauseapp.com
  get endpoint() {
    return this.accountId
      ? `https://${this.accountId}.r2.cloudflarestorage.com`
      : "";
  },
};

// ── PubMed ──────────────────────────────────────────────────────────────────

export const pubmed = {
  baseUrl: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
  apiKey: optionalEnv("PUBMED_API_KEY", ""), // optional, increases rate limit from 3/sec to 10/sec
  maxResults: 10,
  // Category → MeSH search terms
  searchTerms: {
    Sleep: "menopause AND (sleep disorders OR insomnia OR night sweats)",
    "Hot Flashes": "menopause AND (vasomotor symptoms OR hot flashes OR hot flushes)",
    Mood: "menopause AND (mood disorders OR anxiety OR depression OR brain fog)",
    Nutrition: "menopause AND (diet OR nutrition OR phytoestrogens OR gut microbiome)",
    Movement: "menopause AND (exercise OR physical activity OR bone density OR joint pain)",
    Relationships: "menopause AND (quality of life OR workplace OR sexual health OR relationships)",
    Treatment: "menopause AND (hormone replacement therapy OR HRT OR treatment options)",
    Wellness: "menopause AND (perimenopause OR menopause transition OR women's health)",
    Basics: "menopause AND (perimenopause OR symptoms OR hormones OR estrogen)",
  } as Record<string, string>,
};

// ── Audio Post-Production ───────────────────────────────────────────────────

export const production = {
  // Loudness targets (LUFS)
  podcastLoudness: -16,
  lessonLoudness: -16,
  meditationLoudness: -20,
  affirmationLoudness: -20,
  // Output format
  outputBitrate: "128k",
  outputFormat: "mp3",
  // Background music volume for meditations/affirmations (0-1)
  ambientMusicVolume: 0.15,
};

// ── Pipeline Defaults ───────────────────────────────────────────────────────

export const pipeline = {
  // Words per minute estimates for duration calculation
  podcastWpm: 150,
  lessonWpm: 150,
  meditationWpm: 100,
  affirmationWpm: 80,
  articleReadWpm: 200,
  // Batch processing
  concurrency: 3, // max parallel items in batch mode
  retryAttempts: 2,
  retryDelayMs: 5000,
};
