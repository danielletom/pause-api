import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL as string);
const BASE = "https://pause-api-seven.vercel.app/audio/meditations";

const meditations = [
  { slug: "sleep-body-scan", programDay: 6, programWeek: 2, audioUrl: `${BASE}/body-scan-for-sleep.mp3` },
  { slug: "self-compassion-practice", programDay: 9, programWeek: 3, audioUrl: `${BASE}/self-compassion-practice.mp3` },
  { slug: "morning-energy-activation", programDay: 10, programWeek: 4, audioUrl: `${BASE}/morning-energy-activation.mp3` },
  { slug: "manifestation-future-self", programDay: 14, programWeek: 5, audioUrl: `${BASE}/manifestation-future-self.mp3` },
];

async function main() {
  console.log("Assigning meditations to program days...\n");

  for (const med of meditations) {
    const result = await sql`
      UPDATE content
      SET program_day = ${med.programDay},
          program_week = ${med.programWeek},
          audio_url = ${med.audioUrl},
          program_id = 'perimenopause-foundations'
      WHERE slug = ${med.slug}
      RETURNING id, title
    `;
    if (result.length > 0) {
      console.log(`  ✅ Day ${med.programDay} | ${result[0].title}`);
    } else {
      console.log(`  ❌ Not found: ${med.slug}`);
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
