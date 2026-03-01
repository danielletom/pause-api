/**
 * Publish all draft content in the database.
 * Run: npx tsx scripts/publish-all-content.ts
 */

import { db } from "../src/db";
import { content } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function publishAll() {
  console.log("Publishing all draft content...\n");

  // First, see what we have
  const allItems = await db
    .select({ id: content.id, title: content.title, status: content.status, contentType: content.contentType })
    .from(content);

  const drafts = allItems.filter((i) => i.status === "draft");
  const published = allItems.filter((i) => i.status === "published");

  console.log(`Total content: ${allItems.length}`);
  console.log(`Already published: ${published.length}`);
  console.log(`Draft (will publish): ${drafts.length}\n`);

  if (drafts.length === 0) {
    console.log("Nothing to publish!");
    process.exit(0);
  }

  // Update all drafts to published
  const result = await db
    .update(content)
    .set({ status: "published" })
    .where(eq(content.status, "draft"));

  console.log(`Published ${drafts.length} items:\n`);
  for (const item of drafts) {
    console.log(`  ${item.contentType?.padEnd(13)} | ${item.title}`);
  }

  console.log("\nDone!");
  process.exit(0);
}

publishAll().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
