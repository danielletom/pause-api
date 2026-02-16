/**
 * Stage 4: Producer/Editor Agent
 *
 * Post-production: normalize audio, add intro/outro, mix background music.
 * Uses ffmpeg for all audio processing.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { getContentItem, upsertPipelineStage } from "../lib/db";
import { paths, production } from "../config";
import type { ContentItem } from "../types";

/**
 * Get the ffprobe duration of an audio file in seconds.
 */
function getAudioDuration(filePath: string): number {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding: "utf-8" }
    ).trim();
    return parseFloat(result) || 0;
  } catch {
    return 0;
  }
}

/**
 * Check if ffmpeg is available.
 */
function checkFfmpeg(): void {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
  } catch {
    throw new Error("ffmpeg is not installed. Install it with: brew install ffmpeg");
  }
}

/**
 * Run post-production for a single content item.
 */
export async function produce(contentId: number): Promise<string> {
  checkFfmpeg();

  const item = await getContentItem(contentId);
  if (!item) throw new Error(`Content item ${contentId} not found`);

  const slug = item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Skip non-audio content
  if (item.format !== "audio") {
    console.log(`  [producer] Skipping "${item.title}" — not audio`);
    await upsertPipelineStage(contentId, "production", {
      status: "completed",
      tool: "skip",
    });
    return "";
  }

  const inputPath = path.join(paths.audioStaging, `${slug}.mp3`);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`No audio file found for "${item.title}" at ${inputPath} — run audio stage first`);
  }

  // Output goes to a "produced" subdirectory
  const producedDir = path.join(paths.audioStaging, "produced");
  fs.mkdirSync(producedDir, { recursive: true });
  const outputPath = path.join(producedDir, `${slug}.mp3`);

  // Check if already produced
  if (fs.existsSync(outputPath)) {
    console.log(`  [producer] Using cached produced audio for "${item.title}"`);
    await upsertPipelineStage(contentId, "production", {
      status: "completed",
      tool: "cache",
      outputPath,
    });
    return outputPath;
  }

  console.log(`  [producer] Post-processing "${item.title}"...`);

  await upsertPipelineStage(contentId, "production", {
    status: "in_progress",
    tool: "ffmpeg",
  });

  try {
    let currentFile = inputPath;
    const tempFiles: string[] = [];

    // Step 1: Normalize loudness
    const loudnessTarget = getLoudnessTarget(item.contentType);
    const normalizedPath = path.join(producedDir, `${slug}-normalized.mp3`);
    execSync(
      `ffmpeg -y -i "${currentFile}" -af loudnorm=I=${loudnessTarget}:TP=-1.5:LRA=11 "${normalizedPath}"`,
      { stdio: "pipe" }
    );
    currentFile = normalizedPath;
    tempFiles.push(normalizedPath);

    // Step 2: Add intro (if exists)
    const introPath = getIntroPath(item.contentType);
    if (introPath && fs.existsSync(introPath)) {
      const withIntroPath = path.join(producedDir, `${slug}-with-intro.mp3`);
      const concatList = path.join(producedDir, `${slug}-intro-list.txt`);
      fs.writeFileSync(concatList, `file '${introPath}'\nfile '${currentFile}'`);
      execSync(
        `ffmpeg -y -f concat -safe 0 -i "${concatList}" -acodec libmp3lame -ab 128k "${withIntroPath}"`,
        { stdio: "pipe" }
      );
      fs.unlinkSync(concatList);
      currentFile = withIntroPath;
      tempFiles.push(withIntroPath);
    }

    // Step 3: Add outro (if exists)
    const outroPath = getOutroPath(item.contentType);
    if (outroPath && fs.existsSync(outroPath)) {
      const withOutroPath = path.join(producedDir, `${slug}-with-outro.mp3`);
      const concatList = path.join(producedDir, `${slug}-outro-list.txt`);
      fs.writeFileSync(concatList, `file '${currentFile}'\nfile '${outroPath}'`);
      execSync(
        `ffmpeg -y -f concat -safe 0 -i "${concatList}" -acodec libmp3lame -ab 128k "${withOutroPath}"`,
        { stdio: "pipe" }
      );
      fs.unlinkSync(concatList);
      currentFile = withOutroPath;
      tempFiles.push(withOutroPath);
    }

    // Step 4: Mix ambient music for meditations/affirmations (if music file exists)
    if (
      ["meditation", "affirmation"].includes(item.contentType) &&
      getAmbientMusicPath()
    ) {
      const musicPath = getAmbientMusicPath()!;
      if (fs.existsSync(musicPath)) {
        const mixedPath = path.join(producedDir, `${slug}-mixed.mp3`);
        const volume = production.ambientMusicVolume;
        execSync(
          `ffmpeg -y -i "${currentFile}" -i "${musicPath}" -filter_complex "[1:a]volume=${volume}[bg];[0:a][bg]amix=inputs=2:duration=first" -acodec libmp3lame -ab 128k "${mixedPath}"`,
          { stdio: "pipe" }
        );
        currentFile = mixedPath;
        tempFiles.push(mixedPath);
      }
    }

    // Step 5: Add fade in/out and finalize
    const duration = getAudioDuration(currentFile);
    const fadeOutStart = Math.max(0, duration - 3);
    execSync(
      `ffmpeg -y -i "${currentFile}" -af "afade=t=in:st=0:d=1,afade=t=out:st=${fadeOutStart}:d=3" -acodec libmp3lame -ab ${production.outputBitrate} "${outputPath}"`,
      { stdio: "pipe" }
    );

    // Clean up temp files
    for (const temp of tempFiles) {
      if (fs.existsSync(temp) && temp !== outputPath) {
        fs.unlinkSync(temp);
      }
    }

    const finalDuration = getAudioDuration(outputPath);
    const stats = fs.statSync(outputPath);

    await upsertPipelineStage(contentId, "production", {
      status: "completed",
      tool: "ffmpeg",
      outputPath,
      metadata: {
        durationSeconds: Math.round(finalDuration),
        fileSizeBytes: stats.size,
        fileSizeMB: (stats.size / 1024 / 1024).toFixed(1),
      },
    });

    console.log(
      `  [producer] Done — ${Math.round(finalDuration / 60)} min, ${(stats.size / 1024 / 1024).toFixed(1)} MB`
    );
    return outputPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await upsertPipelineStage(contentId, "production", {
      status: "failed",
      tool: "ffmpeg",
      errorMessage: message,
    });
    throw error;
  }
}

// ── Asset Paths ─────────────────────────────────────────────────────────────

function getIntroPath(contentType: string): string | null {
  const assetsDir = path.join(paths.dataRoot, "assets");
  const map: Record<string, string> = {
    podcast: path.join(assetsDir, "intro-podcast.mp3"),
    lesson: path.join(assetsDir, "intro-lesson.mp3"),
    meditation: path.join(assetsDir, "intro-meditation.mp3"),
    affirmation: path.join(assetsDir, "intro-meditation.mp3"), // share with meditation
  };
  return map[contentType] || null;
}

function getOutroPath(contentType: string): string | null {
  const assetsDir = path.join(paths.dataRoot, "assets");
  const map: Record<string, string> = {
    podcast: path.join(assetsDir, "outro-podcast.mp3"),
    lesson: path.join(assetsDir, "outro-lesson.mp3"),
    meditation: path.join(assetsDir, "outro-meditation.mp3"),
    affirmation: path.join(assetsDir, "outro-meditation.mp3"),
  };
  return map[contentType] || null;
}

function getAmbientMusicPath(): string | null {
  const musicPath = path.join(paths.dataRoot, "assets", "ambient-nature.mp3");
  return fs.existsSync(musicPath) ? musicPath : null;
}

function getLoudnessTarget(contentType: string): number {
  switch (contentType) {
    case "meditation":
    case "affirmation":
      return production.meditationLoudness;
    default:
      return production.podcastLoudness;
  }
}
