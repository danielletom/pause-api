/**
 * Stage 5: Publisher Agent
 *
 * Uploads audio to R2 and updates the CMS.
 * For text content (articles/guides), sets bodyMarkdown directly.
 */

import fs from "fs";
import path from "path";
import { uploadAudio, uploadPdf } from "../lib/storage";
import { getContentItem, updateContent, upsertPipelineStage } from "../lib/db";
import { paths } from "../config";
import type { ContentItem, PublishResult, ScriptOutput } from "../types";

/**
 * Publish a single content item.
 */
export async function publish(
  contentId: number,
  options: { autoPublish?: boolean } = {}
): Promise<PublishResult> {
  const item = await getContentItem(contentId);
  if (!item) throw new Error(`Content item ${contentId} not found`);

  const slug = item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const targetStatus = options.autoPublish ? "published" : "ready";

  console.log(`  [publisher] Publishing "${item.title}" (→ ${targetStatus})...`);

  await upsertPipelineStage(contentId, "publishing", {
    status: "in_progress",
    tool: "r2+cms",
  });

  try {
    const updates: Partial<{
      bodyMarkdown: string;
      audioUrl: string;
      aiDescription: string;
      status: string;
    }> = { status: targetStatus };

    // Handle audio content — upload to R2
    if (item.format === "audio") {
      const producedPath = path.join(paths.audioStaging, "produced", `${slug}.mp3`);
      const rawPath = path.join(paths.audioStaging, `${slug}.mp3`);
      const audioPath = fs.existsSync(producedPath) ? producedPath : rawPath;

      if (!fs.existsSync(audioPath)) {
        throw new Error(`No audio file found for "${item.title}" — run audio + producer stages first`);
      }

      console.log(`  [publisher] Uploading audio to R2...`);
      const audioUrl = await uploadAudio(audioPath, item.contentType, slug);
      updates.audioUrl = audioUrl;
      console.log(`  [publisher] Uploaded: ${audioUrl}`);
    }

    // Handle text content — set bodyMarkdown from writer output
    if (item.format === "text" || item.contentType === "article") {
      const scriptOutput = loadScript(slug);
      if (scriptOutput) {
        updates.bodyMarkdown = scriptOutput.script;
      }
    }

    // Handle PDF guides — upload to R2 and set bodyMarkdown
    if (item.format === "pdf" || item.contentType === "guide") {
      const scriptOutput = loadScript(slug);
      if (scriptOutput) {
        updates.bodyMarkdown = scriptOutput.script;

        // If a PDF file was generated, upload it too
        const pdfPath = path.join(paths.scriptsOutput, `${slug}.pdf`);
        if (fs.existsSync(pdfPath)) {
          const pdfUrl = await uploadPdf(pdfPath, slug);
          // Store PDF URL in audioUrl field (repurposed for guides)
          updates.audioUrl = pdfUrl;
        }
      }
    }

    // Update CMS
    await updateContent(contentId, updates);

    await upsertPipelineStage(contentId, "publishing", {
      status: "completed",
      tool: "r2+cms",
      metadata: {
        audioUrl: updates.audioUrl,
        hasMarkdown: !!updates.bodyMarkdown,
        finalStatus: targetStatus,
      },
    });

    const result: PublishResult = {
      contentId,
      audioUrl: updates.audioUrl,
      bodyMarkdown: updates.bodyMarkdown ? "(set)" : undefined,
      status: targetStatus as "ready" | "published",
      publishedAt: new Date().toISOString(),
    };

    console.log(`  [publisher] Done — status: ${targetStatus}`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await upsertPipelineStage(contentId, "publishing", {
      status: "failed",
      tool: "r2+cms",
      errorMessage: message,
    });
    throw error;
  }
}

/**
 * Load the written script for a content item.
 */
function loadScript(slug: string): ScriptOutput | null {
  const scriptPath = path.join(paths.scriptsOutput, `${slug}.json`);
  if (fs.existsSync(scriptPath)) {
    return JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  }
  return null;
}
