/**
 * Add the Menopause Shopping List as an in-app guide with bodyMarkdown.
 * Run: npx tsx scripts/add-shopping-list.ts
 */

import { db } from "../src/db";
import { content } from "../src/db/schema";
import { eq } from "drizzle-orm";

const markdown = `## The Basics

Stock these and you're 80% there.

- **Salmon** — omega-3s, vitamin D
- **Eggs** — choline, protein
- **Leafy greens** (spinach, kale) — magnesium, iron
- **Broccoli** — supports estrogen metabolism
- **Avocados** — healthy fats, potassium
- **Blueberries** — antioxidants
- **Sweet potatoes** — slow-release energy

---

## Hormone Helpers

Foods with natural plant estrogens.

- **Ground flaxseeds** — add to smoothies or oats
- **Tofu or tempeh** — isoflavones
- **Chickpeas** — versatile, high protein
- **Edamame** — easy snack

---

## Sleep Support

- **Tart cherries** — natural melatonin
- **Oats** — calming, B vitamins
- **Walnuts** — melatonin + omega-3
- **Chamomile tea**

---

## Pantry Staples

- **Olive oil** — anti-inflammatory
- **Almonds** — magnesium, snacking
- **Dark chocolate (70%+)** — magnesium treat
- **Green tea** — L-theanine, gentle energy
- **Turmeric** — anti-inflammatory
- **Cinnamon** — blood sugar balance

---

## Worth Reducing

- Sugar — worsens hot flashes
- Alcohol — disrupts sleep
- Caffeine after 2 PM — affects sleep quality
- Ultra-processed foods — inflammation`;

async function addShoppingList() {
  // Check if it already exists
  const existing = await db
    .select({ id: content.id })
    .from(content)
    .where(eq(content.slug, "menopause-shopping-list"));

  if (existing.length > 0) {
    await db.update(content).set({
      bodyMarkdown: markdown,
      format: "text",
      status: "published",
    }).where(eq(content.slug, "menopause-shopping-list"));
    console.log(`Updated existing item (id: ${existing[0].id})`);
  } else {
    const [item] = await db.insert(content).values({
      title: "Menopause Shopping List",
      slug: "menopause-shopping-list",
      contentType: "guide",
      format: "text",
      description: "Your go-to grocery list for anti-inflammatory, hormone-supporting foods.",
      bodyMarkdown: markdown,
      category: "Nutrition",
      tags: ["anytime", "nutrition"],
      status: "published",
    }).returning();
    console.log(`Created new item (id: ${item.id})`);
  }

  console.log("Done!");
  process.exit(0);
}

addShoppingList().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
