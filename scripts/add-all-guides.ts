/**
 * Add all 9 remaining guides as in-app readable content.
 * Run: npx tsx scripts/add-all-guides.ts
 */

import { db } from "../src/db";
import { content } from "../src/db/schema";
import { eq } from "drizzle-orm";

interface Guide {
  title: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  bodyMarkdown: string;
}

const guides: Guide[] = [
  {
    title: "What to Ask Your Doctor",
    slug: "what-to-ask-your-doctor-script",
    description: "Scripts and questions for your next doctor appointment.",
    category: "Treatment",
    tags: ["anytime", "basics"],
    bodyMarkdown: `## Before Your Appointment

Write down your top 3 symptoms and when they started. Bring a recent log from Pause if you can.

---

## Questions to Ask

**About your symptoms:**
- Could these symptoms be related to perimenopause?
- What tests would help us understand what's going on?
- Are my hormone levels worth checking right now?

**About treatment:**
- What are my options — lifestyle, supplements, or medication?
- Am I a good candidate for HRT?
- What are the risks and benefits for someone like me?

**About next steps:**
- How long before I'd notice improvement?
- When should I come back for a follow-up?
- Is there a menopause specialist you'd recommend?

---

## If You Feel Dismissed

It's okay to say:

*"These symptoms are affecting my daily life. I'd like to explore all my options."*

*"I've been tracking my symptoms and I can see a pattern. Can we look at this together?"*

You deserve to be heard.`,
  },
  {
    title: "HRT Decision Worksheet",
    slug: "hrt-decision-making-worksheet",
    description: "A simple framework to help you think through HRT.",
    category: "Treatment",
    tags: ["anytime", "basics"],
    bodyMarkdown: `## Your Current Symptoms

Which symptoms bother you most? Rate each 1–5.

- Hot flashes / night sweats
- Sleep disruption
- Mood changes / anxiety
- Brain fog
- Joint pain
- Low energy

---

## What Matters to You

Think about what's most important:

- **Quick relief** — HRT often works within weeks
- **Natural approach first** — lifestyle + supplements
- **Long-term bone & heart health** — HRT has protective benefits
- **Minimal medication** — prefer fewest interventions

---

## Questions for Your Doctor

- What type of HRT would suit me? (patch, gel, pill, combo)
- Do I have any risk factors to consider?
- How long would I stay on it?
- What side effects should I watch for?

---

## Your Personal Factors

Things that may influence the decision:

- Family history (breast cancer, heart disease, blood clots)
- Age and how far into perimenopause you are
- Severity of symptoms
- Other medications you take
- Your comfort level

---

## Remember

There's no wrong answer. This is about finding what works for *your* body and *your* life. You can always start and adjust.`,
  },
  {
    title: "Bedroom Cooling Checklist",
    slug: "bedroom-cooling-checklist",
    description: "Optimise your bedroom for better sleep and fewer night sweats.",
    category: "Sleep",
    tags: ["evening", "sleep", "hot flashes"],
    bodyMarkdown: `## Temperature

- Set thermostat to 16–19°C (60–67°F)
- Use a fan — ceiling or bedside
- Open a window if safe and quiet enough

---

## Bedding

- Switch to breathable sheets (bamboo or cotton percale)
- Use layers instead of one heavy duvet
- Try a cooling pillow or pillowcase
- Keep a spare pillowcase in your nightstand

---

## Sleepwear

- Lightweight, moisture-wicking fabric
- Loose fit — nothing tight
- Keep a change of PJs by the bed

---

## Night Sweat Kit

Keep these within arm's reach:

- Spray bottle with cool water
- Small towel or cooling cloth
- Glass of water
- Spare pillowcase

---

## Before Bed

- No heavy meals 3 hours before sleep
- Skip caffeine after 2 PM
- Limit alcohol — it triggers night sweats
- Cool shower before bed can help

---

## Quick Recovery

If you wake up drenched:
1. Mist your face and neck
2. Swap the pillowcase
3. Sip water
4. Don't check your phone — the light wakes you up more`,
  },
  {
    title: "Anti-Inflammatory Meal Plan",
    slug: "anti-inflammatory-meal-plan-7-days",
    description: "A simple week of meals to reduce inflammation and support hormones.",
    category: "Nutrition",
    tags: ["anytime", "nutrition"],
    bodyMarkdown: `## How to Use This

Pick what appeals to you. Mix and match. This isn't a strict diet — it's inspiration for meals that help reduce inflammation.

---

## Breakfasts

- **Overnight oats** with ground flaxseed, blueberries, walnuts
- **Scrambled eggs** with spinach and avocado on toast
- **Smoothie** — banana, berries, handful of spinach, flaxseed, oat milk
- **Greek yogurt** with cherries and a drizzle of honey

---

## Lunches

- **Salmon salad** with mixed greens, olive oil, lemon
- **Chickpea bowl** with roasted veg, tahini dressing
- **Lentil soup** with crusty bread
- **Tofu stir-fry** with broccoli, brown rice

---

## Dinners

- **Baked salmon** with sweet potato and steamed greens
- **Chicken** with roasted Mediterranean vegetables
- **Bean chilli** with avocado and brown rice
- **Stir-fried tempeh** with ginger, garlic, mixed veg

---

## Snacks

- Handful of almonds or walnuts
- Apple with almond butter
- Edamame
- Dark chocolate (70%+) — a square or two
- Hummus with carrot sticks

---

## Daily Habits

- Start the day with warm water and lemon
- Add turmeric to one meal
- Aim for 2 portions of oily fish per week
- Swap refined carbs for whole grains where you can`,
  },
  {
    title: "Supplement Guide",
    slug: "supplement-stack-guide",
    description: "Evidence-based supplements worth considering.",
    category: "Nutrition",
    tags: ["anytime", "nutrition"],
    bodyMarkdown: `## The Core Four

These have the most evidence for perimenopause.

**Magnesium glycinate** — 200–400mg at bedtime
- Helps with sleep, muscle cramps, anxiety
- Glycinate form is gentle on the stomach

**Vitamin D3 + K2** — 1000–2000 IU daily
- Bone health, mood, immunity
- Get levels tested if you can

**Omega-3 fish oil** — 1000–2000mg daily
- Brain health, inflammation, heart
- Look for EPA + DHA on the label

**Probiotics** — daily
- Gut health supports estrogen metabolism
- Look for multi-strain, 10+ billion CFU

---

## Worth Considering

**B-complex** — energy and mood support
**Black cohosh** — some evidence for hot flashes
**Ashwagandha** — stress and sleep support

---

## Tips

- Start one at a time so you know what's helping
- Give each 4–6 weeks before judging
- Quality matters — choose reputable brands
- Always tell your doctor what you're taking

---

## Not Worth the Money

Be skeptical of anything that promises to "balance hormones overnight" or "reverse menopause." If it sounds too good to be true, it probably is.`,
  },
  {
    title: "Work Accommodation Template",
    slug: "work-accommodation-request-template",
    description: "How to request workplace support for menopause symptoms.",
    category: "Relationships",
    tags: ["anytime", "basics"],
    bodyMarkdown: `## When to Have the Conversation

You don't have to share everything. Share what's relevant to getting the support you need.

---

## What You Might Ask For

- **Flexible start times** — mornings can be harder
- **Fan or desk near a window** — for temperature regulation
- **Breaks when needed** — hot flashes pass in minutes
- **Quiet space** — for brain fog moments
- **Working from home** — on difficult days

---

## How to Frame It

Keep it professional and solution-focused:

*"I'm managing a health condition that sometimes affects my concentration and comfort. A few small adjustments would help me stay at my best."*

*"I'd like to discuss some minor accommodations that would help me maintain my productivity."*

---

## Know Your Rights

In many places, menopause symptoms can fall under disability or health accommodation laws. You don't need to say "menopause" — you can say "a hormonal health condition."

---

## If Your Manager Is Supportive

Be honest about what helps:
- "Mornings before 10 are my toughest time"
- "I sometimes need a 5-minute break to cool down"
- "I work best when I can control my environment"

Most managers want to help — they just need to know how.`,
  },
  {
    title: "Partner Conversation Starter",
    slug: "partner-conversation-starter",
    description: "How to talk to your partner about what you're going through.",
    category: "Relationships",
    tags: ["anytime", "basics"],
    bodyMarkdown: `## Pick Your Moment

Not during an argument. Not when you're exhausted. Choose a calm, quiet time.

---

## What to Say

Start simple:

*"I want to talk to you about something I've been going through. It's called perimenopause, and it's affecting me more than I expected."*

---

## What They Should Know

- **It's real and physical** — hormones affect the brain, body temperature, sleep, mood
- **It's not about them** — irritability, low libido, and withdrawal aren't personal
- **It's temporary but long** — it can last years, not weeks
- **You need support, not solutions** — listening is the most helpful thing

---

## What You Might Need From Them

- Patience on hard days
- Not taking mood changes personally
- Help around the house when energy is low
- Understanding about changes in intimacy
- Just asking "how are you feeling today?"

---

## If They Don't Get It

That's okay. Most people don't understand until they see it.

Share an episode of the Pause Pod together, or point them to a short article. Sometimes hearing it from someone else helps.

---

## Remember

Asking for support isn't weakness. It's how relationships get stronger.`,
  },
  {
    title: "Exercise Starter Plan",
    slug: "exercise-starter-plan-beginner",
    description: "A gentle 4-week plan for getting moving in midlife.",
    category: "Movement",
    tags: ["morning", "energy"],
    bodyMarkdown: `## The Goal

Move your body most days. Start small. Build slowly. That's it.

---

## Week 1 — Just Walk

- 15-minute walk, 4 days this week
- Any pace. Any time of day.
- That's the whole plan.

---

## Week 2 — Add Strength

- 20-minute walk, 4 days
- 10 minutes of bodyweight exercises, 2 days:
  - 10 squats
  - 10 wall push-ups
  - 20-second plank
  - Repeat twice

---

## Week 3 — Build Up

- 25-minute walk, 4 days
- 15 minutes of strength, 2 days:
  - 12 squats
  - 10 push-ups (wall or floor)
  - 30-second plank
  - 10 lunges each leg
  - Repeat twice

---

## Week 4 — Find Your Rhythm

- 30-minute walk, 4 days
- 15 minutes of strength, 3 days
- Try one new thing: yoga class, swim, dance, bike ride

---

## Tips

- **Morning is best** — energy tends to dip later
- **Strength training matters** — it protects bones and muscle mass
- **Rest days are important** — recovery is part of fitness
- **Don't compare** — your body is different now, and that's okay
- **Track how you feel after** — exercise almost always improves mood`,
  },
  {
    title: "Sleep Hygiene Checklist",
    slug: "sleep-hygiene-audit-checklist",
    description: "Audit your sleep habits with this simple checklist.",
    category: "Sleep",
    tags: ["evening", "sleep"],
    bodyMarkdown: `## Your Evening Routine

- Stop eating 3 hours before bed
- No caffeine after 2 PM
- Limit alcohol (it fragments sleep)
- Dim the lights 1 hour before bed
- Put your phone in another room (or at least face down)

---

## Your Bedroom

- Cool temperature (16–19°C / 60–67°F)
- Dark — blackout curtains or eye mask
- Quiet — earplugs or white noise if needed
- Bed is for sleep and intimacy only — no work, no scrolling

---

## Your Wind-Down

Pick 2–3 of these:

- Warm bath or shower
- 5 minutes of stretching
- Read a book (not a screen)
- Breathing exercise — 4 counts in, 6 counts out
- Write tomorrow's to-do list to clear your head
- Listen to a Pause meditation

---

## Your Morning

Good sleep starts in the morning:

- Wake at the same time every day (yes, weekends too)
- Get sunlight within 30 minutes of waking
- Move your body — even a short walk

---

## If You Can't Sleep

- Don't lie there frustrated — get up after 20 minutes
- Do something boring in dim light
- Go back when you feel sleepy
- Don't check the clock — it makes anxiety worse

---

## Track It

Use Pause to log your sleep. After a week, you'll start seeing what helps and what doesn't.`,
  },
];

async function addAllGuides() {
  console.log("Adding guides to database...\n");

  let created = 0;
  let updated = 0;

  for (const guide of guides) {
    const existing = await db
      .select({ id: content.id })
      .from(content)
      .where(eq(content.slug, guide.slug));

    if (existing.length > 0) {
      await db.update(content).set({
        bodyMarkdown: guide.bodyMarkdown,
        format: "text",
        status: "published",
        description: guide.description,
      }).where(eq(content.slug, guide.slug));
      console.log(`  UPD | ${guide.title}`);
      updated++;
    } else {
      await db.insert(content).values({
        title: guide.title,
        slug: guide.slug,
        contentType: "guide",
        format: "text",
        description: guide.description,
        bodyMarkdown: guide.bodyMarkdown,
        category: guide.category,
        tags: guide.tags,
        status: "published",
      });
      console.log(`  ADD | ${guide.title}`);
      created++;
    }
  }

  console.log(`\nDone! Created: ${created}, Updated: ${updated}`);
  process.exit(0);
}

addAllGuides().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
