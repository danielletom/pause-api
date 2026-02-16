#!/usr/bin/env npx tsx --env-file=.env.local
/**
 * Create and process a new podcast episode.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/pipeline/new-episode.ts \
 *     --title "Episode Title" \
 *     --category "Sleep" \
 *     [--description "Episode description"] \
 *     [--duration 20] \
 *     [--through writing]  # Stop after a specific stage
 *
 * This creates a content row in the DB and runs the pipeline through
 * all stages (or up to --through).
 */

import { db } from "../../src/db";
import { content } from "../../src/db/schema";
import { research } from "./stages/01-researcher";
import { write } from "./stages/02-writer";
import { generateAudio } from "./stages/03-audio-gen";
import { produce } from "./stages/04-producer";
import { publish } from "./stages/05-publisher";

function parseArgs() {
  const args = process.argv.slice(2);
  let title = "";
  let category = "Wellness";
  let description = "";
  let duration = 20;
  let through = "publishing";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--title":
        title = args[++i];
        break;
      case "--category":
        category = args[++i];
        break;
      case "--description":
        description = args[++i];
        break;
      case "--duration":
        duration = parseInt(args[++i]);
        break;
      case "--through":
        through = args[++i];
        break;
    }
  }

  if (!title) {
    console.error("Error: --title is required");
    console.error(
      'Usage: npx tsx --env-file=.env.local scripts/pipeline/new-episode.ts --title "Episode Title" --category "Sleep"'
    );
    process.exit(1);
  }

  return { title, category, description, duration, through };
}

async function main() {
  const args = parseArgs();
  const slug = args.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  console.log(`\n=== New Episode: "${args.title}" ===\n`);
  console.log(`  Category: ${args.category}`);
  console.log(`  Duration: ${args.duration} min`);
  console.log(`  Through stage: ${args.through}\n`);

  // Step 1: Create content row
  console.log("Creating content item...");
  const [inserted] = await db
    .insert(content)
    .values({
      title: args.title,
      slug,
      contentType: "podcast",
      format: "audio",
      description: args.description || `Podcast episode: ${args.title}`,
      durationMinutes: args.duration,
      category: args.category,
      tags: ["anytime"],
      productionTool: "ElevenLabs",
      status: "draft",
    })
    .returning({ id: content.id });

  const contentId = inserted.id;
  console.log(`  Created content #${contentId}\n`);

  // Step 2: Run pipeline stages
  const stages = ["research", "writing", "audio", "production", "publishing"];

  for (const stage of stages) {
    console.log(`--- Stage: ${stage} ---`);
    switch (stage) {
      case "research":
        await research(contentId);
        break;
      case "writing":
        await write(contentId);
        break;
      case "audio":
        await generateAudio(contentId);
        break;
      case "production":
        await produce(contentId);
        break;
      case "publishing":
        await publish(contentId);
        break;
    }

    if (stage === args.through) {
      console.log(`\nStopped after "${args.through}" stage.`);
      break;
    }
  }

  console.log(`\n=== Episode "${args.title}" (ID: ${contentId}) complete ===\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
