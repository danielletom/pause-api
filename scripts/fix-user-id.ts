import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL!);

const OLD_ID = "user_39lEaUAcoEeWA0rhodvawSFsjJh";
const NEW_ID = "user_39lFm70NXFlpX5BL18SzGBA78FD";

async function migrate() {
  const tables = [
    "profiles", "daily_logs", "medications", "med_logs",
    "computed_scores", "user_correlations", "sos_events",
    "content_engagement", "program_progress", "narratives",
    "bleeding_events", "cycles", "cycle_analytics", "gratitude_entries",
  ];

  for (const table of tables) {
    try {
      await sql.query(`UPDATE ${table} SET user_id = $1 WHERE user_id = $2`, [NEW_ID, OLD_ID]);
      console.log("  ✅ " + table);
    } catch (e: any) {
      console.log("  ❌ " + table + ": " + e.message);
    }
  }

  // Verify
  const check = await sql`SELECT count(*) as cnt FROM profiles WHERE user_id = ${NEW_ID}`;
  console.log("\nVerification - profiles:", check[0]?.cnt);
  const logs = await sql`SELECT count(*) as cnt FROM daily_logs WHERE user_id = ${NEW_ID}`;
  console.log("Verification - daily_logs:", logs[0]?.cnt);
  const cycles = await sql`SELECT count(*) as cnt FROM cycles WHERE user_id = ${NEW_ID}`;
  console.log("Verification - cycles:", cycles[0]?.cnt);
  const grat = await sql`SELECT count(*) as cnt FROM gratitude_entries WHERE user_id = ${NEW_ID}`;
  console.log("Verification - gratitude:", grat[0]?.cnt);
}

migrate().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
