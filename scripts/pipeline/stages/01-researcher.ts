/**
 * Stage 1: Researcher Agent
 *
 * Gathers evidence-based medical information for each content piece.
 * 1. Queries PubMed for relevant abstracts
 * 2. Synthesizes findings via Claude into a structured research brief
 * 3. Caches the brief to avoid re-running
 */

import fs from "fs";
import path from "path";
import { searchPubMed, getSearchQuery } from "../lib/pubmed";
import { generateJSON } from "../lib/claude-client";
import { getContentItem, upsertPipelineStage } from "../lib/db";
import { paths } from "../config";
import type { ContentItem, ResearchBrief } from "../types";

/**
 * Check if a research brief already exists in cache.
 */
function getCachedBrief(slug: string): ResearchBrief | null {
  const cachePath = path.join(paths.researchCache, `${slug}.json`);
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
  }
  return null;
}

/**
 * Save a research brief to cache.
 */
function cacheBrief(slug: string, brief: ResearchBrief): void {
  fs.mkdirSync(paths.researchCache, { recursive: true });
  const cachePath = path.join(paths.researchCache, `${slug}.json`);
  fs.writeFileSync(cachePath, JSON.stringify(brief, null, 2));
}

/**
 * Run research for a single content item.
 */
export async function research(contentId: number): Promise<ResearchBrief> {
  const item = await getContentItem(contentId);
  if (!item) throw new Error(`Content item ${contentId} not found`);

  const slug = item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Check cache
  const cached = getCachedBrief(slug);
  if (cached) {
    console.log(`  [research] Using cached brief for "${item.title}"`);
    await upsertPipelineStage(contentId, "research", {
      status: "completed",
      tool: "cache",
      outputPath: path.join(paths.researchCache, `${slug}.json`),
    });
    return cached;
  }

  console.log(`  [research] Researching "${item.title}" (category: ${item.category})...`);

  await upsertPipelineStage(contentId, "research", {
    status: "in_progress",
    tool: "pubmed+claude",
  });

  try {
    // Step 1: Search PubMed
    const category = item.category || "Basics";
    const additionalTerms = extractKeyTerms(item.title, item.description);
    const query = getSearchQuery(category, additionalTerms);
    console.log(`  [research] PubMed query: ${query}`);

    const abstracts = await searchPubMed(query, 10);
    console.log(`  [research] Found ${abstracts.length} PubMed abstracts`);

    // Step 2: Synthesize with Claude
    const brief = await generateJSON<ResearchBrief>({
      system: `You are a medical research synthesizer for Pause, a menopause wellness app.
Given PubMed abstracts about a specific topic, produce a structured research brief.

PAUSE SUPPLEMENT CONTEXT:
The Pause app sells a menopause supplement containing two key ingredients:
- Pueraria mirifica: a phytoestrogen from Thailand used for menopause symptom relief (hot flashes, vaginal dryness, bone health). Most people haven't heard of it.
- L-theanine: an amino acid from green tea that supports relaxation, sleep quality, and stress reduction without drowsiness.
When the research topic relates to these ingredients or their benefits (hot flashes, sleep, anxiety, stress, bone health, vaginal health, phytoestrogens), include any relevant findings about Pueraria mirifica and/or L-theanine in the brief. This helps the content writers naturally reference the Pause supplement.

IMPORTANT:
- Focus on evidence-based, peer-reviewed findings
- Include specific statistics where available
- Flag any safety concerns or contraindications
- Use clear, accessible language — no jargon
- Always include disclaimers for medical topics
- Do NOT make up statistics — only use what's in the abstracts`,
      prompt: JSON.stringify({
        topic: item.title,
        description: item.description,
        category: item.category,
        contentType: item.contentType,
        abstracts: abstracts.map((a) => ({
          pmid: a.pmid,
          title: a.title,
          abstract: a.abstract,
          authors: a.authors.slice(0, 3).join(", "),
          journal: a.journal,
          year: a.year,
        })),
        instructions: `Create a research brief with these exact fields:
        - contentId: ${contentId}
        - slug: "${slug}"
        - topic: the topic name
        - category: "${category}"
        - keyFindings: array of 3-5 key research findings with citations
        - statistics: array of relevant statistics from the abstracts
        - expertQuotes: array of 2-3 quotable paraphrases (attributed to journal/year)
        - misconceptions: array of common misconceptions to address
        - safetyDisclaimers: array of safety/medical disclaimers
        - sources: array of {pmid, title, year} for the most relevant sources
        - generatedAt: current ISO timestamp`,
      }),
      maxOutputTokens: 2048,
    });

    brief.contentId = contentId;
    brief.slug = slug;
    brief.generatedAt = new Date().toISOString();

    // Cache
    cacheBrief(slug, brief);

    await upsertPipelineStage(contentId, "research", {
      status: "completed",
      tool: "pubmed+claude",
      outputPath: path.join(paths.researchCache, `${slug}.json`),
      metadata: {
        abstractCount: abstracts.length,
        findingsCount: brief.keyFindings.length,
      },
    });

    console.log(
      `  [research] Done — ${brief.keyFindings.length} findings, ${brief.sources.length} sources`
    );
    return brief;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await upsertPipelineStage(contentId, "research", {
      status: "failed",
      tool: "pubmed+claude",
      errorMessage: message,
    });
    throw error;
  }
}

/**
 * Extract additional search terms from title and description.
 */
function extractKeyTerms(title: string, description: string | null): string | undefined {
  const combined = `${title} ${description || ""}`.toLowerCase();
  const keywords: string[] = [];

  // Extract specific medical terms
  const medicalTerms = [
    "sleep", "insomnia", "night sweats", "hot flashes", "anxiety", "depression",
    "brain fog", "cognitive", "estrogen", "progesterone", "HRT", "hormone",
    "exercise", "weight", "metabolism", "bone", "joint", "nutrition", "diet",
    "gut", "microbiome", "supplement", "magnesium", "vitamin D", "phytoestrogen",
    "libido", "vaginal", "intimacy", "workplace", "relationships",
    "pueraria mirifica", "l-theanine", "theanine", "phytoestrogen",
  ];

  for (const term of medicalTerms) {
    if (combined.includes(term.toLowerCase())) {
      keywords.push(term);
    }
  }

  return keywords.length > 0 ? keywords.slice(0, 3).join(" OR ") : undefined;
}
