/**
 * Set programId='main' for all existing 8-week program content items
 * (those that have programWeek set but no programId)
 *
 * Run: npx tsx scripts/set-program-ids.ts
 */
import { db } from "../src/db";
import { content } from "../src/db/schema";
import { sql } from "drizzle-orm";

async function main() {

  // Find items with programWeek set but no programId
  const itemsToUpdate = await db
    .select({ id: content.id, title: content.title, programWeek: content.programWeek })
    .from(content)
    .where(
      sql`${content.programWeek} IS NOT NULL AND (${content.programId} IS NULL OR ${content.programId} = '')`
    );

  console.log(`Found ${itemsToUpdate.length} items with programWeek but no programId`);

  if (itemsToUpdate.length === 0) {
    console.log("Nothing to update!");
    return;
  }

  // Batch update all at once
  const result = await db
    .update(content)
    .set({ programId: "main" })
    .where(
      sql`${content.programWeek} IS NOT NULL AND (${content.programId} IS NULL OR ${content.programId} = '')`
    );

  console.log(`Updated ${itemsToUpdate.length} items to programId='main'`);

  // Verify
  const mainItems = await db
    .select({ id: content.id, title: content.title, programId: content.programId, programWeek: content.programWeek })
    .from(content)
    .where(sql`${content.programId} = 'main'`);

  console.log(`\nVerification: ${mainItems.length} items now have programId='main'`);
  for (const item of mainItems.slice(0, 5)) {
    console.log(`  W${item.programWeek}: ${item.title}`);
  }
  if (mainItems.length > 5) {
    console.log(`  ... and ${mainItems.length - 5} more`);
  }
}

main().catch(console.error);
