/**
 * Fix symptomsJson format in daily_logs table.
 * Converts from array format [{ name, severity }] to Record<string, number> { name: severity }
 * Run: NEON_DATABASE_URL="..." npx tsx scripts/fix-symptoms-format.ts
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL!);

async function fix() {
  // Get all daily_logs with symptomsJson that's an array
  const logs = await sql`SELECT id, symptoms_json FROM daily_logs WHERE symptoms_json IS NOT NULL`;

  let fixed = 0;
  let skipped = 0;

  for (const log of logs) {
    const data = log.symptoms_json;

    // Check if it's in array format (wrong)
    if (Array.isArray(data)) {
      // Convert [{ name: "hot_flashes", severity: 2 }] -> { "hot_flashes": 2 }
      const record: Record<string, number> = {};
      for (const item of data) {
        if (item.name && typeof item.severity === 'number') {
          record[item.name] = item.severity;
        }
      }

      await sql`UPDATE daily_logs SET symptoms_json = ${JSON.stringify(record)}::jsonb WHERE id = ${log.id}`;
      fixed++;
    } else {
      skipped++;
    }
  }

  console.log(`✅ Fixed ${fixed} rows, skipped ${skipped} (already correct format)`);

  // Verify
  const sample = await sql`SELECT id, symptoms_json FROM daily_logs WHERE symptoms_json IS NOT NULL LIMIT 3`;
  console.log("\nSample rows after fix:");
  for (const row of sample) {
    console.log(`  id=${row.id}:`, JSON.stringify(row.symptoms_json));
  }
}

fix().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
