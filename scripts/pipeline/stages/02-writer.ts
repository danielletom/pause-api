/**
 * Stage 2: Writer Agent
 *
 * Generates content — scripts for audio, markdown for articles, outlines for guides.
 * Uses Claude API with type-specific prompts and the research brief from Stage 1.
 */

import fs from "fs";
import path from "path";
import { generate } from "../lib/claude-client";
import { getContentItem, upsertPipelineStage } from "../lib/db";
import { paths, pipeline as pipelineConfig } from "../config";
import type { ContentItem, ResearchBrief, ScriptOutput } from "../types";

/**
 * Load research brief from cache.
 */
function loadResearchBrief(slug: string): ResearchBrief | null {
  const cachePath = path.join(paths.researchCache, `${slug}.json`);
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
  }
  return null;
}

/**
 * Save generated script/content to output directory.
 */
function saveOutput(slug: string, output: ScriptOutput): void {
  fs.mkdirSync(paths.scriptsOutput, { recursive: true });
  const outputPath = path.join(paths.scriptsOutput, `${slug}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
}

/**
 * Run the writer for a single content item.
 */
export async function write(contentId: number): Promise<ScriptOutput> {
  const item = await getContentItem(contentId);
  if (!item) throw new Error(`Content item ${contentId} not found`);

  const slug = item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Check if output already exists
  const outputPath = path.join(paths.scriptsOutput, `${slug}.json`);
  if (fs.existsSync(outputPath)) {
    console.log(`  [writer] Using cached output for "${item.title}"`);
    const cached = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as ScriptOutput;
    await upsertPipelineStage(contentId, "writing", {
      status: "completed",
      tool: "cache",
      outputPath,
    });
    return cached;
  }

  console.log(`  [writer] Writing ${item.contentType} "${item.title}"...`);

  await upsertPipelineStage(contentId, "writing", {
    status: "in_progress",
    tool: "claude",
  });

  try {
    // Load research brief (may not exist for affirmations)
    const brief = loadResearchBrief(slug);

    // Get the appropriate prompt
    const systemPrompt = getSystemPrompt(item);
    const userPrompt = getUserPrompt(item, brief);

    // Target word count based on content type and duration
    const targetWords = getTargetWordCount(item);

    const script = await generate({
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: Math.max(4096, Math.ceil(targetWords * 1.5)),
    });

    const wordCount = script.split(/\s+/).length;
    const wpm = getWpm(item.contentType);
    const estimatedMinutes = Math.round(wordCount / wpm);

    const output: ScriptOutput = {
      contentId,
      slug,
      contentType: item.contentType,
      title: item.title,
      script,
      wordCount,
      estimatedMinutes,
      generatedAt: new Date().toISOString(),
    };

    saveOutput(slug, output);

    // Log duration warning if significantly off
    if (item.durationMinutes && Math.abs(estimatedMinutes - item.durationMinutes) > 3) {
      console.warn(
        `  [writer] WARNING: "${item.title}" target ${item.durationMinutes} min but script is ~${estimatedMinutes} min (${wordCount} words)`
      );
    }

    await upsertPipelineStage(contentId, "writing", {
      status: "completed",
      tool: "claude",
      outputPath,
      metadata: { wordCount, estimatedMinutes, targetMinutes: item.durationMinutes },
    });

    console.log(`  [writer] Done — ${wordCount} words (~${estimatedMinutes} min)`);
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await upsertPipelineStage(contentId, "writing", {
      status: "failed",
      tool: "claude",
      errorMessage: message,
    });
    throw error;
  }
}

// ── Prompt Builders ─────────────────────────────────────────────────────────

function getSystemPrompt(item: ContentItem): string {
  const base = `You are a content writer for Pause, a menopause wellness app for women aged 42-55.
Your audience is overwhelmed, under-informed, and getting conflicting advice. She is smart but not a medical professional.

TONE: Warm, encouraging, evidence-based, jargon-free. Never clinical or condescending. Never "woo" or mystical.
STYLE: Practical and actionable. "Just tell me what to do" energy.`;

  switch (item.contentType) {
    case "podcast":
      return `${base}

FORMAT: Two-host conversational podcast script.
HOSTS:
- Alex: Warm, inquisitive, asks the questions the listener is thinking. Represents "the everywoman."
- Sam: Knowledgeable, empathetic, explains complex topics simply. Represents "the trusted expert friend."

SCRIPT RULES:
- Use speaker labels: "Alex:" and "Sam:" at the start of each turn
- Include natural reactions ("Oh wow", "That makes sense", "Wait, really?")
- Include follow-up questions and "aha" moments
- Light humor where appropriate — never forced
- End with 2-3 practical takeaways
- Target ${item.durationMinutes || 18} minutes at ~150 words/minute`;

    case "lesson":
      return `${base}

FORMAT: Single-narrator instructional audio script.
NARRATOR: Warm, clear, encouraging female voice. Like a knowledgeable friend explaining something over coffee.

SCRIPT RULES:
- Use section headers: ## for major sections
- Include clear learning objectives at the start
- Break complex topics into simple steps
- End with 2-3 actionable takeaways
- Target ${item.durationMinutes || 12} minutes at ~150 words/minute`;

    case "meditation":
      return `${base}

FORMAT: Guided meditation script for audio recording.
NARRATOR: Calm, slow-paced, soothing female voice.

SCRIPT RULES:
- Include timing cues: [PAUSE 3s], [PAUSE 5s], [PAUSE 10s]
- Include music cues: [MUSIC: soft ambient], [MUSIC: nature sounds], [MUSIC: gentle fade out]
- Include breathing cues: [BREATHE IN... 4 counts], [BREATHE OUT... 6 counts]
- Very slow pacing — lots of pauses between sentences
- Never use clinical language — use imagery and metaphor
- End with a gentle return to awareness
- Target ${item.durationMinutes || 12} minutes at ~100 words/minute (accounting for pauses)`;

    case "affirmation":
      return `${base}

FORMAT: Positive affirmation sequence for audio recording.
NARRATOR: Confident, warm, empowering female voice.

SCRIPT RULES:
- Use "I am..." and "I choose..." and "I allow..." statements
- Include [PAUSE 2s] between each affirmation
- Include [PAUSE 5s] between thematic sections
- Group affirmations into 3-4 thematic clusters
- End with a powerful closing statement
- Target ${item.durationMinutes || 5} minutes at ~80 words/minute`;

    case "article":
      return `${base}

FORMAT: In-app markdown article.

ARTICLE RULES:
- Use ## headers to break into scannable sections
- Use **bold** for key terms and important facts
- Use bullet lists for practical tips
- Include a "Key Takeaways" section at the end
- Keep paragraphs short (2-3 sentences max)
- Target ${item.durationMinutes || 4} minutes reading time at ~200 words/minute
- Include a disclaimer: "This information is educational and not a substitute for medical advice."`;

    case "guide":
      return `${base}

FORMAT: Practical PDF guide (structured markdown).

GUIDE RULES:
- Use ## headers for major sections
- Include checklists with - [ ] checkboxes
- Include simple tables where helpful (markdown format)
- Include numbered step-by-step instructions where appropriate
- Make it printable — someone should be able to print this and use it
- Keep to 1-3 pages equivalent
- Include a disclaimer`;

    default:
      return base;
  }
}

function getUserPrompt(item: ContentItem, brief: ResearchBrief | null): string {
  let prompt = `Write content for: "${item.title}"

Description: ${item.description || "No description provided."}
Category: ${item.category || "General"}
Target duration: ${item.durationMinutes || "N/A"} minutes`;

  if (item.programWeek && item.programDay) {
    prompt += `\nProgram: Week ${item.programWeek}, Day ${item.programDay}`;
    if (item.programAction) {
      prompt += `\nTonight's Plan Action: "${item.programAction}"`;
    }
  }

  if (brief) {
    prompt += `\n\n--- RESEARCH BRIEF ---\n`;
    prompt += `Key Findings:\n${brief.keyFindings.map((f) => `- ${f}`).join("\n")}`;
    prompt += `\n\nStatistics:\n${brief.statistics.map((s) => `- ${s}`).join("\n")}`;
    prompt += `\n\nCommon Misconceptions:\n${brief.misconceptions.map((m) => `- ${m}`).join("\n")}`;
    prompt += `\n\nSafety Disclaimers:\n${brief.safetyDisclaimers.map((d) => `- ${d}`).join("\n")}`;
    prompt += `\n\nSources:\n${brief.sources.map((s) => `- ${s.title} (${s.year})`).join("\n")}`;
  }

  return prompt;
}

function getTargetWordCount(item: ContentItem): number {
  const minutes = item.durationMinutes || 10;
  const wpm = getWpm(item.contentType);
  return minutes * wpm;
}

function getWpm(contentType: string): number {
  switch (contentType) {
    case "podcast":
      return pipelineConfig.podcastWpm;
    case "lesson":
      return pipelineConfig.lessonWpm;
    case "meditation":
      return pipelineConfig.meditationWpm;
    case "affirmation":
      return pipelineConfig.affirmationWpm;
    case "article":
      return pipelineConfig.articleReadWpm;
    default:
      return 150;
  }
}
