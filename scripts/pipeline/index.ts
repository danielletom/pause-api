#!/usr/bin/env npx tsx --env-file=.env.local
/**
 * Pause Content Pipeline CLI
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/pipeline/index.ts <command> [options]
 *
 * Commands:
 *   run      --id <id>              Run full pipeline for a single item
 *   research --id <id>              Run only the research stage
 *   write    --id <id>              Run only the writer stage
 *   audio    --id <id>              Run only the audio generation stage
 *   produce  --id <id>              Run only the post-production stage
 *   publish  --id <id>              Run only the publisher stage
 *   batch    --type <type>          Run pipeline for all items of a type
 *   batch    --week <n>             Run pipeline for all items in a program week
 *   status                          Show pipeline status dashboard
 *   status   --id <id>              Show pipeline status for a single item
 *   list     [--type <type>]        List content items
 */

import { research } from "./stages/01-researcher";
import { write } from "./stages/02-writer";
import { generateAudio } from "./stages/03-audio-gen";
import { produce } from "./stages/04-producer";
import { publish } from "./stages/05-publisher";
import {
  getContentItem,
  getContentItems,
  getPipelineStatus,
  getPipelineSummary,
} from "./lib/db";
import { pipeline as pipelineConfig } from "./config";
import type { ContentItem, ContentType, PipelineStage } from "./types";

// ── CLI Argument Parsing ────────────────────────────────────────────────────

function parseArgs(): {
  command: string;
  id?: number;
  type?: ContentType;
  week?: number;
  stage?: PipelineStage;
  dryRun: boolean;
  verbose: boolean;
  autoPublish: boolean;
} {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  let id: number | undefined;
  let type: ContentType | undefined;
  let week: number | undefined;
  let dryRun = false;
  let verbose = false;
  let autoPublish = false;

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case "--id":
        id = parseInt(args[++i]);
        break;
      case "--type":
        type = args[++i] as ContentType;
        break;
      case "--week":
        week = parseInt(args[++i]);
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--verbose":
      case "-v":
        verbose = true;
        break;
      case "--auto-publish":
        autoPublish = true;
        break;
    }
  }

  return { command, id, type, week, dryRun, verbose, autoPublish };
}

// ── Pipeline Runner ─────────────────────────────────────────────────────────

/**
 * Run the full pipeline for a single content item.
 * Stages are run sequentially: research → write → audio → produce → publish
 */
async function runFullPipeline(
  contentId: number,
  options: { autoPublish?: boolean; through?: PipelineStage } = {}
): Promise<void> {
  const item = await getContentItem(contentId);
  if (!item) {
    console.error(`Content item ${contentId} not found`);
    process.exit(1);
  }

  console.log(`\n=== Pipeline: "${item.title}" (${item.contentType}) ===\n`);

  const stages: { name: PipelineStage; fn: () => Promise<void> }[] = [
    {
      name: "research",
      fn: async () => {
        // Skip research for affirmations — they don't need it
        if (item.contentType === "affirmation") {
          console.log("  [research] Skipped — affirmations don't need research");
          return;
        }
        await research(contentId);
      },
    },
    { name: "writing", fn: async () => { await write(contentId); } },
    { name: "audio", fn: async () => { await generateAudio(contentId); } },
    { name: "production", fn: async () => { await produce(contentId); } },
    {
      name: "publishing",
      fn: async () => { await publish(contentId, { autoPublish: options.autoPublish }); },
    },
  ];

  for (const stage of stages) {
    console.log(`\n--- Stage: ${stage.name} ---`);
    try {
      await stage.fn();
    } catch (error) {
      console.error(`\n  FAILED at stage "${stage.name}":`, error instanceof Error ? error.message : error);
      console.error(`  Pipeline stopped. Fix the error and re-run from this stage.`);
      process.exit(1);
    }

    if (options.through && stage.name === options.through) {
      console.log(`\n  Stopped after "${options.through}" stage (--through flag)`);
      break;
    }
  }

  console.log(`\n=== Pipeline complete for "${item.title}" ===\n`);
}

/**
 * Run pipeline in batch for multiple items.
 */
async function runBatch(
  filters: { type?: ContentType; week?: number },
  options: { autoPublish?: boolean } = {}
): Promise<void> {
  const items = await getContentItems({ ...filters, status: "draft" });

  if (items.length === 0) {
    console.log("No items match the filter criteria (or all are already processed).");
    return;
  }

  console.log(`\n=== Batch Pipeline: ${items.length} items ===`);
  if (filters.type) console.log(`  Type: ${filters.type}`);
  if (filters.week) console.log(`  Week: ${filters.week}`);
  console.log();

  let completed = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await runFullPipeline(item.id, options);
      completed++;
    } catch {
      failed++;
      console.error(`  [batch] Failed: "${item.title}" — continuing to next item\n`);
    }
  }

  console.log(`\n=== Batch Complete ===`);
  console.log(`  Completed: ${completed}/${items.length}`);
  if (failed > 0) console.log(`  Failed: ${failed}`);
}

// ── Status Dashboard ────────────────────────────────────────────────────────

async function showStatus(contentId?: number): Promise<void> {
  if (contentId) {
    // Show status for a single item
    const item = await getContentItem(contentId);
    if (!item) {
      console.error(`Content item ${contentId} not found`);
      return;
    }

    const stages = await getPipelineStatus(contentId);

    console.log(`\n  "${item.title}" (${item.contentType}, ${item.format})`);
    console.log(`  Status: ${item.status}`);
    console.log(`  Audio URL: ${item.audioUrl || "(none)"}`);
    console.log(`  Body: ${item.bodyMarkdown ? `${item.bodyMarkdown.length} chars` : "(none)"}`);
    console.log();

    if (stages.length === 0) {
      console.log("  No pipeline stages run yet.\n");
      return;
    }

    console.log("  Stage         | Status        | Tool            | Completed");
    console.log("  --------------|---------------|-----------------|----------");
    for (const s of stages) {
      const completed = s.completedAt
        ? new Date(s.completedAt).toLocaleString()
        : "-";
      console.log(
        `  ${s.stage.padEnd(14)} | ${s.status.padEnd(13)} | ${(s.tool || "-").padEnd(15)} | ${completed}`
      );
    }
    console.log();
    return;
  }

  // Show summary dashboard
  const summary = await getPipelineSummary();
  const items = await getContentItems();

  console.log(`\n=== Pause Content Pipeline Status ===\n`);
  console.log(`  Total content items: ${items.length}`);

  // Count by content status
  const statusCounts = items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`    ${status}: ${count}`);
  }

  // Count by type
  console.log();
  const typeCounts = items.reduce(
    (acc, item) => {
      acc[item.contentType] = (acc[item.contentType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`    ${type}: ${count}`);
  }

  // Pipeline stage summary
  if (summary.length > 0) {
    console.log(`\n  Pipeline Stage Summary:`);
    console.log(`  Stage         | Pending | In Progress | Completed | Failed`);
    console.log(`  --------------|---------|-------------|-----------|-------`);

    const stageOrder: PipelineStage[] = ["research", "writing", "audio", "production", "publishing"];
    for (const stage of stageOrder) {
      const stageRows = summary.filter((r) => r.stage === stage);
      const pending = stageRows.find((r) => r.status === "pending")?.count || 0;
      const inProgress = stageRows.find((r) => r.status === "in_progress")?.count || 0;
      const completed = stageRows.find((r) => r.status === "completed")?.count || 0;
      const failed = stageRows.find((r) => r.status === "failed")?.count || 0;
      console.log(
        `  ${stage.padEnd(14)} | ${String(pending).padEnd(7)} | ${String(inProgress).padEnd(11)} | ${String(completed).padEnd(9)} | ${failed}`
      );
    }
  }

  console.log();
}

/**
 * List content items.
 */
async function listItems(type?: ContentType): Promise<void> {
  const items = await getContentItems(type ? { type } : undefined);

  console.log(`\n  ${items.length} content items${type ? ` (type: ${type})` : ""}:\n`);
  console.log("  ID  | Type        | Week | Day | Status    | Title");
  console.log("  ----|-------------|------|-----|-----------|------");

  for (const item of items) {
    const week = item.programWeek ? String(item.programWeek).padEnd(4) : "-   ";
    const day = item.programDay ? String(item.programDay).padEnd(3) : "-  ";
    console.log(
      `  ${String(item.id).padEnd(4)}| ${item.contentType.padEnd(12)}| ${week} | ${day} | ${item.status.padEnd(9)} | ${item.title}`
    );
  }
  console.log();
}

// ── Help ────────────────────────────────────────────────────────────────────

function showHelp(): void {
  console.log(`
  Pause Content Pipeline CLI

  Usage:
    npx tsx --env-file=.env.local scripts/pipeline/index.ts <command> [options]

  Commands:
    run        --id <id>           Run full pipeline for a single content item
    research   --id <id>           Run only the research stage
    write      --id <id>           Run only the writer stage
    audio      --id <id>           Run only the audio generation stage
    produce    --id <id>           Run only the post-production stage
    publish    --id <id>           Run only the publisher stage
    batch      --type <type>       Run pipeline for all items of a type
    batch      --week <n>          Run pipeline for all items in a program week
    status                         Show pipeline status dashboard
    status     --id <id>           Show status for a single item
    list       [--type <type>]     List content items
    help                           Show this help message

  Options:
    --auto-publish                 Set status to 'published' instead of 'ready'
    --dry-run                      Show what would happen without executing
    --verbose, -v                  Show detailed output

  Content Types: podcast, lesson, meditation, affirmation, article, guide

  Examples:
    npx tsx --env-file=.env.local scripts/pipeline/index.ts run --id 42
    npx tsx --env-file=.env.local scripts/pipeline/index.ts batch --type article
    npx tsx --env-file=.env.local scripts/pipeline/index.ts batch --week 1
    npx tsx --env-file=.env.local scripts/pipeline/index.ts status
  `);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  switch (args.command) {
    case "run":
      if (!args.id) {
        console.error("Error: --id is required for 'run' command");
        process.exit(1);
      }
      await runFullPipeline(args.id, { autoPublish: args.autoPublish });
      break;

    case "research":
      if (!args.id) { console.error("Error: --id required"); process.exit(1); }
      await research(args.id);
      break;

    case "write":
      if (!args.id) { console.error("Error: --id required"); process.exit(1); }
      await write(args.id);
      break;

    case "audio":
      if (!args.id) { console.error("Error: --id required"); process.exit(1); }
      await generateAudio(args.id);
      break;

    case "produce":
      if (!args.id) { console.error("Error: --id required"); process.exit(1); }
      await produce(args.id);
      break;

    case "publish":
      if (!args.id) { console.error("Error: --id required"); process.exit(1); }
      await publish(args.id, { autoPublish: args.autoPublish });
      break;

    case "batch":
      if (!args.type && !args.week) {
        console.error("Error: --type or --week required for 'batch' command");
        process.exit(1);
      }
      await runBatch({ type: args.type, week: args.week }, { autoPublish: args.autoPublish });
      break;

    case "status":
      await showStatus(args.id);
      break;

    case "list":
      await listItems(args.type);
      break;

    case "help":
    default:
      showHelp();
      break;
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("\nPipeline error:", err);
  process.exit(1);
});
