import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { content } from "@/db/schema";
import { eq } from "drizzle-orm";

// ─── Guide body content (from add-all-guides.ts) ────────────────────────────

const guideContent: Record<string, string> = {
  "what-to-ask-your-doctor-script": `## Before Your Appointment

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

  "hrt-decision-making-worksheet": `## Your Current Symptoms

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

  "bedroom-cooling-checklist": `## Temperature

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

  "anti-inflammatory-meal-plan-7-days": `## How to Use This

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

  "supplement-stack-guide": `## The Core Four

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

  "work-accommodation-request-template": `## When to Have the Conversation

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

  "partner-conversation-starter": `## Pick Your Moment

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

  "exercise-starter-plan-beginner": `## The Goal

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

  "sleep-hygiene-audit-checklist": `## Your Evening Routine

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
};

// ─── Library article body content (from seed-library-extras) ─────────────────
// These are the text-format library items that need readable body content.

const libraryArticleContent: Record<string, string> = {
  // ── Podcasts (10) ──
  "the-34-symptoms-nobody-warned-you-about": `## The Full List You Wish Someone Had Given You

Most women know about hot flashes. But perimenopause can cause up to 34 different symptoms — and many of them are surprising.

---

## The Ones You'd Expect

- Hot flashes and night sweats
- Irregular periods
- Mood swings
- Low libido

---

## The Ones That Catch You Off Guard

- **Heart palpitations** — sudden racing heart, often at night
- **Electric shock sensations** — brief zaps under the skin
- **Burning mouth or tongue** — a metallic taste or burning feeling
- **Tinnitus** — ringing in the ears
- **Itchy skin** — especially arms and legs
- **Frozen shoulder** — sudden joint stiffness
- **Digestive changes** — bloating, nausea, or new food sensitivities
- **Body odour changes** — your scent can shift
- **Brittle nails** — hormones affect keratin production
- **Allergies worsening** — histamine and estrogen are linked

---

## Why So Many?

Estrogen receptors exist in almost every part of your body — brain, joints, gut, skin, heart. When estrogen fluctuates, all of those systems feel it.

---

## What to Do

Track what you're experiencing. Even if a symptom seems unrelated, log it. Patterns emerge over time, and your doctor needs the full picture.

You're not imagining it. You're not falling apart. Your hormones are just... loud right now.`,

  "hot-flashes-what-actually-triggers-them": `## Understanding Your Triggers

Hot flashes aren't random. Most women have specific triggers — the challenge is identifying yours.

---

## Common Triggers

**Food & drink:**
- Caffeine — especially coffee
- Alcohol — even one glass of wine
- Spicy food
- Hot drinks
- Sugar spikes

**Environment:**
- Warm rooms
- Heavy clothing or layers
- Hot baths (ironically)
- Humidity

**Emotional:**
- Stress and anxiety
- Rushing or time pressure
- Anger or frustration
- Embarrassment

---

## The Science

Your hypothalamus (the body's thermostat) becomes more sensitive as estrogen drops. Things that would normally cause a tiny temperature shift now trigger a full-blown hot flash — sweating, flushing, rapid heartbeat.

---

## How to Track Them

For one week, log every hot flash in Pause:
- What were you doing?
- What did you eat or drink in the last hour?
- How were you feeling emotionally?
- What was the temperature like?

After a week, patterns usually emerge.

---

## Quick Relief

When one hits:
1. **4-4-6 breathing** — in for 4, hold for 4, out for 6
2. Sip cold water
3. Apply something cool to your wrists or neck
4. Step outside if possible
5. Remind yourself: this will pass in 2–5 minutes`,

  "menopause-and-your-brain": `## The Estrogen-Brain Connection

Your brain is full of estrogen receptors. When estrogen levels fluctuate and decline, your brain chemistry changes — and you feel it.

---

## Brain Fog

- Forgetting words mid-sentence
- Walking into a room and forgetting why
- Struggling to concentrate
- Feeling mentally "slow"

**Why it happens:** Estrogen supports acetylcholine, a neurotransmitter crucial for memory and focus. Less estrogen = less acetylcholine.

**What helps:** Exercise (the single best intervention), sleep, omega-3s, reducing alcohol, and giving yourself grace.

---

## Anxiety

- Racing thoughts, especially at night
- Feeling on edge for no reason
- Heart palpitations
- A sense of dread

**Why it happens:** Estrogen modulates serotonin and GABA — your calming neurotransmitters. Fluctuations can mimic anxiety disorders.

**What helps:** Magnesium, breathing exercises, reducing caffeine, therapy (CBT is evidence-based for menopausal anxiety), and sometimes medication.

---

## Mood Swings

- Irritability that surprises even you
- Crying at things that wouldn't normally affect you
- Feeling emotionally raw

**Why it happens:** Progesterone (your calming hormone) drops faster than estrogen. The imbalance creates emotional instability.

**What helps:** Regular exercise, consistent sleep schedule, omega-3s, and talking about what you're feeling.

---

## The Good News

Brain fog is not dementia. Research shows cognitive function typically returns to baseline after the menopause transition. Your brain is adapting, not declining.`,

  "weight-metabolism-the-midlife-shift": `## Why Your Body Is Changing

Around perimenopause, many women notice weight gain — especially around the middle. It's not your fault, and it's not because you're eating more.

---

## What's Happening

**Hormonal shifts:**
- Declining estrogen promotes visceral fat storage (around organs)
- Lower progesterone can cause water retention and bloating
- Insulin resistance increases — your body handles carbs differently

**Metabolic slowdown:**
- Muscle mass naturally decreases with age (sarcopenia)
- Less muscle = lower resting metabolism
- You burn fewer calories doing the same activities

---

## What Doesn't Work

- **Crash diets** — they slow metabolism further and increase cortisol
- **Excessive cardio** — can raise cortisol and break down muscle
- **Cutting all carbs** — your brain needs glucose; extreme restriction backfires
- **Comparing to your 30s** — your body has different needs now

---

## What Actually Helps

**Strength training** — the most important thing you can do
- Builds muscle, which raises resting metabolism
- Protects bones
- 2–3 sessions per week makes a real difference

**Protein at every meal** — aim for 25–30g per meal
- Supports muscle maintenance
- Keeps you fuller longer
- Examples: eggs, Greek yogurt, chicken, fish, legumes, tofu

**Blood sugar balance**
- Eat protein or fat before carbs
- Don't skip meals
- Reduce refined sugar and white flour

**Sleep** — poor sleep increases hunger hormones (ghrelin) and decreases fullness hormones (leptin)

---

## A Mindset Shift

Your body is not broken. It's adapting to a new hormonal reality. The goal isn't to look like you did at 25 — it's to feel strong, energetic, and healthy in the body you have now.`,

  "eating-for-perimenopause": `## Food as Medicine

What you eat directly affects how you feel during perimenopause. The right foods can reduce inflammation, support hormone metabolism, and stabilise your mood and energy.

---

## Eat More Of

**Phytoestrogens** — plant compounds that gently mimic estrogen
- Flaxseed (ground) — 1–2 tablespoons daily
- Soy — tofu, tempeh, edamame
- Chickpeas and lentils

**Omega-3 rich foods** — anti-inflammatory powerhouses
- Salmon, mackerel, sardines (2x per week)
- Walnuts
- Chia seeds

**Fibre** — supports gut health and estrogen clearance
- Vegetables — aim for 5+ portions daily
- Whole grains — oats, brown rice, quinoa
- Beans and legumes

**Calcium & vitamin D foods** — for bone protection
- Dairy or fortified alternatives
- Leafy greens (kale, broccoli)
- Tinned fish with bones

---

## Eat Less Of

- **Refined sugar** — spikes blood sugar, worsens hot flashes and mood
- **Alcohol** — disrupts sleep, triggers hot flashes, depletes nutrients
- **Ultra-processed foods** — inflammatory, low in nutrients
- **Excess caffeine** — can worsen anxiety and sleep problems

---

## Meal Timing Matters

- Don't skip breakfast — it sets your blood sugar for the day
- Eat protein with every meal
- Stop eating 3 hours before bed
- Stay hydrated — dehydration worsens brain fog and fatigue

---

## The 80/20 Rule

Eat well 80% of the time. Enjoy life the other 20%. Perfection is not the goal — consistency is.`,

  "talking-to-your-partner-about-menopause": `## Why This Conversation Matters

Your partner sees the changes but may not understand them. Having an honest conversation can transform your relationship during this transition.

---

## When to Talk

- Choose a calm, relaxed moment
- Not during a conflict or when you're exhausted
- Maybe over a walk or a quiet evening
- Give them a heads-up: "I'd like to talk about something important"

---

## What to Share

Start with the basics:

*"I'm going through perimenopause. It's a hormonal transition that affects my whole body — sleep, mood, energy, temperature. I wanted you to understand what's happening so we can navigate it together."*

---

## Key Points for Them

- **It's not in your head** — it's a real physiological process
- **Mood changes aren't about them** — irritability and withdrawal are hormone-driven
- **Intimacy may shift** — lower libido, vaginal dryness, and body image changes are common
- **It's a phase** — it doesn't last forever, but it can last years
- **Support matters enormously** — feeling understood makes everything easier

---

## What You Need From Them

Be specific:
- "I need patience when I'm having a hard day"
- "Please don't take it personally if I'm irritable"
- "Asking 'how are you feeling?' means a lot"
- "Help with [specific tasks] when my energy is low"

---

## Resources to Share

Sometimes hearing it from an expert helps. Share a podcast episode, an article, or suggest they listen to a Pause episode together. It normalises the conversation and takes pressure off you to explain everything.`,

  "hrt-the-full-balanced-picture": `## What Is HRT?

Hormone Replacement Therapy (HRT) replaces the hormones your body produces less of during perimenopause — primarily estrogen and progesterone.

---

## Types of HRT

**Estrogen** — available as:
- Patches (most commonly recommended)
- Gel
- Spray
- Tablets

**Progesterone** — needed if you have a uterus:
- Micronised progesterone (Utrogestan) — body-identical
- Mirena coil — releases progesterone locally
- Synthetic progestogens (older type)

**Testosterone** — sometimes added for:
- Low libido
- Fatigue
- Brain fog

---

## Benefits

- Reduces hot flashes and night sweats (most effective treatment)
- Improves sleep quality
- Protects bone density (reduces osteoporosis risk)
- May reduce cardiovascular risk when started early
- Can improve mood, energy, and brain fog
- Helps with vaginal dryness and urinary symptoms

---

## Risks to Discuss

- Small increased risk of breast cancer with combined HRT (after 5+ years)
- Blood clot risk with oral estrogen (patches/gels are safer)
- Not suitable for everyone — discuss your personal risk factors

---

## Who Should Consider It

- Women with moderate to severe symptoms
- Women at risk of osteoporosis
- Women who've tried lifestyle changes without enough relief
- Women under 60 or within 10 years of menopause onset

---

## The Bottom Line

HRT is the most effective treatment for menopause symptoms. For most women, the benefits outweigh the risks. But it's a personal decision — talk to your doctor about your specific situation.`,

  "menopause-at-work-your-rights-and-strategies": `## You're Not Alone

8 out of 10 menopausal women are in work. Many struggle in silence. You don't have to.

---

## Common Workplace Challenges

- **Brain fog in meetings** — losing your train of thought
- **Hot flashes at your desk** — visible flushing and sweating
- **Fatigue** — struggling to get through the afternoon
- **Anxiety** — presentations and social situations feel harder
- **Concentration** — difficulty focusing for long periods

---

## Practical Strategies

**For brain fog:**
- Write everything down — use lists and reminders
- Do complex tasks in the morning when focus is best
- Break big tasks into smaller steps
- Keep a "brain dump" notepad on your desk

**For hot flashes:**
- Dress in layers you can remove
- Keep a desk fan and cold water bottle
- Sit near a window or air conditioning
- Step out briefly when needed

**For fatigue:**
- Take short breaks every 90 minutes
- Walk at lunch — daylight and movement help
- Stay hydrated
- Avoid heavy carb-loaded lunches

---

## Your Rights

In many countries, menopause symptoms can be considered under:
- Health and safety obligations
- Disability discrimination protections
- Flexible working requests

You don't have to use the word "menopause" if you don't want to. "A hormonal health condition" or "an ongoing medical condition" is perfectly valid.

---

## Having the Conversation

If you decide to speak to your manager or HR:
- Focus on solutions, not symptoms
- Be specific about what would help
- You can share as much or as little as you choose
- Put requests in writing for a record`,

  "the-gut-hormone-connection": `## Your Gut and Your Hormones

Your gut does far more than digest food. It plays a direct role in how your body processes and eliminates estrogen.

---

## The Estrobolome

Your gut contains a collection of bacteria called the estrobolome. These bacteria help regulate how much estrogen stays active in your body.

- **Healthy gut** = balanced estrogen metabolism
- **Unhealthy gut** = estrogen recirculation, worsening symptoms

---

## Why Bloating Gets Worse

During perimenopause:
- Progesterone drops, slowing gut motility (things move more slowly)
- Estrogen fluctuations affect water retention
- Stress hormones (cortisol) disrupt the microbiome
- Food sensitivities can develop or worsen

---

## Signs Your Gut Needs Attention

- Bloating after meals
- New food intolerances
- Constipation or irregular bowel movements
- Heartburn or acid reflux
- Fatigue after eating

---

## How to Support Your Gut

**Probiotics** — look for multi-strain, 10+ billion CFU
- Fermented foods count: yogurt, kefir, sauerkraut, kimchi

**Prebiotics** — feed your good bacteria
- Garlic, onions, leeks, asparagus, bananas, oats

**Fibre** — aim for 30g daily
- Vegetables, whole grains, beans, lentils, seeds

**Reduce gut irritants**
- Limit alcohol, artificial sweeteners, ultra-processed foods
- Eat mindfully — chew slowly, don't eat while stressed

---

## The Connection to Hot Flashes

Emerging research suggests that a healthy gut microbiome may help reduce hot flash frequency and severity. Supporting your gut health is one of the simplest things you can do for overall symptom management.`,

  "why-sleep-changes-in-perimenopause": `## The Hormonal Sleep Disruption Cycle

If you're waking at 3am and can't get back to sleep, you're not alone. Sleep disruption is one of the most common — and most frustrating — symptoms of perimenopause.

---

## Why It Happens

**Progesterone decline**
- Progesterone is your calming, sleep-promoting hormone
- As it drops, falling asleep and staying asleep gets harder
- It also has a natural anti-anxiety effect — less of it means more nighttime worry

**Estrogen fluctuations**
- Estrogen helps regulate body temperature
- Fluctuations trigger night sweats that wake you up
- It also affects serotonin and melatonin production

**Cortisol dysregulation**
- Cortisol (stress hormone) should be lowest at night
- In perimenopause, the cortisol rhythm can shift
- Result: you feel wired at bedtime, exhausted in the morning

---

## The 3am Wake-Up

This is classic perimenopause. You fall asleep fine but wake between 2–4am with:
- Racing thoughts
- Feeling hot or sweaty
- Heart pounding
- Unable to switch off

**Why 3am?** Your cortisol starts rising in the early morning hours. Combined with low progesterone, this creates a perfect storm of wakefulness.

---

## What Helps

- **Cool bedroom** (16–19°C / 60–67°F)
- **Magnesium glycinate** before bed (200–400mg)
- **Consistent wake time** — even on weekends
- **No screens 1 hour before bed**
- **4-7-8 breathing** if you wake up
- **Don't clock-watch** — turn your clock away
- **Get up after 20 minutes** if you can't sleep — do something boring, then return

---

## When to Get Help

If sleep disruption is affecting your daily life, talk to your doctor. Options include:
- Progesterone (part of HRT) — often dramatically improves sleep
- CBT-I (Cognitive Behavioural Therapy for Insomnia)
- Short-term sleep medication for crisis periods`,

  // ── Audio Lessons (12) ──
  "hormones-101": `## The Three Key Players

Your body runs on a delicate balance of hormones. During perimenopause, three key hormones shift — and the effects ripple through your entire body.

---

## Estrogen

**What it does:** Regulates temperature, supports brain function, protects bones and heart, keeps skin elastic, maintains vaginal and urinary health.

**What's happening:** Estrogen doesn't just decline steadily. It fluctuates wildly — some days higher than your 20s, some days very low. This rollercoaster is what causes most symptoms.

**When it's low:** Hot flashes, brain fog, joint pain, vaginal dryness, mood changes.

**When it spikes:** Breast tenderness, heavy periods, headaches, bloating.

---

## Progesterone

**What it does:** Calms the nervous system, promotes sleep, balances estrogen, supports mood.

**What's happening:** Progesterone is usually the first hormone to decline. It drops when you stop ovulating regularly.

**When it's low:** Anxiety, insomnia, irritability, irregular periods, PMS-like symptoms.

---

## Testosterone

**What it does:** Supports energy, libido, muscle mass, confidence, and mental clarity.

**What's happening:** Testosterone declines gradually from your 30s onward. By perimenopause, levels may be significantly lower.

**When it's low:** Low libido, fatigue, loss of motivation, reduced muscle mass, brain fog.

---

## The Big Picture

These hormones don't work in isolation — they influence each other. That's why symptoms can seem random and unpredictable. Understanding the basics helps you make sense of what your body is doing.`,

  "your-body-decoded": `## What's Actually Happening Inside

Perimenopause isn't a disease. It's a natural biological transition — like puberty in reverse. But that doesn't mean it's easy.

---

## The Timeline

- **Early perimenopause:** Periods still regular, but symptoms start appearing. Progesterone begins to drop.
- **Mid perimenopause:** Periods become irregular. Estrogen fluctuates wildly. Symptoms intensify.
- **Late perimenopause:** Periods become infrequent. Symptoms may peak before settling.
- **Menopause:** 12 consecutive months without a period. Average age: 51.

The whole transition can last 4–10 years. Most women start noticing changes in their early to mid 40s.

---

## Your Ovaries

Your ovaries are winding down their egg production. As they do, hormone production becomes erratic. Some months you ovulate, some months you don't. This unpredictability is the root cause of most symptoms.

---

## Your Brain

Your brain has estrogen receptors everywhere. When estrogen fluctuates, your brain chemistry shifts — affecting mood, memory, sleep, temperature regulation, and anxiety levels.

---

## Your Body

- **Metabolism slows** — muscle mass decreases, fat distribution changes
- **Bones thin** — estrogen protects bone density
- **Joints stiffen** — estrogen has anti-inflammatory properties
- **Skin changes** — collagen production drops
- **Gut changes** — digestion and microbiome shift

---

## The Good News

Your body is adapting, not breaking down. Many symptoms improve or resolve after the transition. And there's a lot you can do right now to feel better.`,

  "tracking-101": `## Why Tracking Matters

When you track your symptoms, patterns emerge. And patterns give you power — to predict bad days, identify triggers, and have better conversations with your doctor.

---

## What to Track

**Daily basics:**
- Mood (1–5 scale)
- Energy level (1–5 scale)
- Sleep quality (1–5 scale)
- Any symptoms you noticed

**Weekly check-ins:**
- Which symptoms were worst this week?
- What helped?
- What made things worse?
- How was your overall wellbeing?

---

## How to Use Pause

1. **Log daily** — it takes 30 seconds. Morning or evening, whatever works.
2. **Be honest** — there's no judgement. A bad day is just data.
3. **Note context** — did you exercise? Drink alcohol? Sleep badly? Have a stressful day?
4. **Review weekly** — look for patterns in your logs.

---

## What Patterns Tell You

After 2–4 weeks, you might notice:
- "My worst days are always after drinking wine"
- "I sleep better when I exercise in the morning"
- "My anxiety peaks the week before my period"
- "Brain fog is worse when I skip breakfast"

---

## At the Doctor

Bring your Pause logs. Doctors respond to data. Instead of saying "I feel terrible," you can say:

*"Over the last month, I've had 14 days of poor sleep, 8 hot flashes per week, and my anxiety has been 4/5 on average."*

That's a conversation your doctor can work with.`,

  "night-sweat-toolkit": `## Understanding Night Sweats

Night sweats are hot flashes that happen while you sleep. They can drench your sheets, wake you up multiple times, and leave you exhausted the next day.

---

## Why They Happen

Your body's thermostat (hypothalamus) becomes more sensitive as estrogen fluctuates. Small temperature changes that your body would normally handle trigger a full cooling response — sweating, flushing, and waking up.

---

## Your Bedroom Setup

**Temperature:** 16–19°C (60–67°F) is ideal
**Bedding:** Breathable fabrics — bamboo, linen, or cotton percale
**Layers:** Multiple thin layers instead of one thick duvet
**Pillow:** Try a cooling pillow or gel insert
**Fan:** Keep one within reach

---

## Your Night Sweat Kit

Keep these on your nightstand:
- Spray bottle with cool water
- Small towel or cooling cloth
- Glass of water
- Spare pillowcase
- Change of sleepwear

---

## Before Bed Prevention

- No heavy meals 3 hours before bed
- Skip caffeine after 2 PM
- Limit alcohol — it's a major trigger
- Cool shower before bed
- Keep bedroom well-ventilated

---

## When You Wake Up Sweating

1. Don't panic — it will pass in minutes
2. Mist your face and neck with cool water
3. Swap your pillowcase
4. Sip room-temperature water
5. Do slow breathing: in for 4, out for 6
6. Do NOT check your phone — the blue light will wake you up fully

---

## Tracking Night Sweats

Log them in Pause. Note what you ate and drank that evening, your stress level, and the room temperature. After a couple of weeks, you'll start to see what triggers yours.`,

  "building-a-wind-down-routine": `## Why a Routine Matters

Your body needs signals that it's time to sleep. In perimenopause, those signals get disrupted. A consistent wind-down routine helps retrain your body's sleep response.

---

## The 30-Minute Wind-Down

Start 30 minutes before your target bedtime. Do the same things in the same order every night. Consistency is more important than what you choose.

---

## Pick Your Ritual (Choose 3–4)

**Physical:**
- Warm bath or shower (your body cooling afterward triggers sleepiness)
- 5 minutes of gentle stretching
- Apply body lotion — the sensory experience is calming
- Change into sleep clothes as a "switching off" signal

**Mental:**
- Write tomorrow's to-do list (gets worries out of your head)
- 3 things you're grateful for today
- Read a physical book (not a screen)
- Listen to a Pause meditation or sleep story

**Breathing:**
- 4-7-8 breathing: inhale for 4, hold for 7, exhale for 8
- Box breathing: inhale 4, hold 4, exhale 4, hold 4
- Simple slow breathing: in for 4, out for 6

---

## What to Avoid

- Screens (phone, tablet, TV) — blue light suppresses melatonin
- News or social media — stimulates anxiety
- Work emails — activates your problem-solving brain
- Intense conversations or arguments
- Heavy snacks or caffeine

---

## Setting Up for Success

- Set a phone alarm 30 minutes before bedtime as your cue
- Keep your wind-down items together (book, lotion, journal)
- Dim the lights in your home after dinner
- Make your bedroom a sanctuary — cool, dark, quiet

---

## Give It Time

It takes about 2 weeks for a new routine to feel natural. Stick with it even if it feels forced at first. Your body will start associating the routine with sleep.`,

  "food-triggers-you-didn-t-expect": `## Beyond the Obvious

You probably know caffeine and alcohol can trigger symptoms. But there are some surprising food triggers that many women don't connect to their perimenopause symptoms.

---

## The Well-Known Triggers

**Caffeine** — worsens anxiety, hot flashes, and sleep
- Coffee, tea, energy drinks, chocolate
- Switch to decaf after noon, or try limiting to 1 cup daily

**Alcohol** — disrupts sleep, triggers night sweats, depletes nutrients
- Even one glass of wine can fragment your sleep
- Try alcohol-free weeks and notice the difference

**Spicy food** — directly triggers hot flashes in many women

---

## The Surprising Ones

**Sugar and refined carbs**
- Blood sugar spikes can trigger hot flashes
- The crash afterward causes fatigue, brain fog, and irritability
- White bread, pasta, pastries, sugary drinks

**Histamine-rich foods**
- Aged cheese, wine, fermented foods, cured meats, tinned fish
- Estrogen and histamine interact — declining estrogen can make you more histamine-sensitive
- Symptoms: flushing, headaches, digestive issues, itchy skin

**MSG and food additives**
- Can trigger hot flashes and headaches in sensitive women
- Found in processed foods, takeaways, some sauces

**Meal timing**
- Skipping meals causes blood sugar drops — worsening brain fog and mood
- Eating too close to bedtime disrupts sleep
- Aim for regular meals every 3–4 hours

---

## How to Identify Your Triggers

1. Keep a simple food diary for 2 weeks
2. Note any symptoms within 2 hours of eating
3. Look for patterns
4. Try eliminating suspects one at a time for a week
5. Reintroduce and observe

---

## What to Eat Instead

- Whole foods over processed
- Protein with every meal (stabilises blood sugar)
- Anti-inflammatory foods: berries, leafy greens, fatty fish, nuts
- Plenty of water — dehydration worsens almost every symptom`,

  "brain-fog-strategies-that-work": `## You're Not Losing Your Mind

Brain fog is one of the most distressing symptoms of perimenopause. Forgetting words, losing your train of thought, struggling to concentrate — it can make you feel like you're declining. You're not. It's hormonal, and it's temporary.

---

## Why It Happens

Estrogen supports acetylcholine — a key neurotransmitter for memory and focus. When estrogen fluctuates, your cognitive function fluctuates with it. Add poor sleep and stress, and brain fog intensifies.

---

## Practical Strategies

**Externalise your memory:**
- Write everything down immediately
- Use phone reminders for everything
- Keep a running to-do list (pen and paper works well)
- Put things in the same place every time (keys, phone, wallet)

**Reduce cognitive load:**
- Do one thing at a time — multitasking makes fog worse
- Tackle difficult tasks in the morning when focus peaks
- Break big projects into small, concrete steps
- Batch similar tasks together

**Support your brain:**
- Say things out loud: "I'm putting my keys on the hook"
- Use mnemonics and associations
- If you forget a word, describe it — it'll come back
- Don't panic — stress makes brain fog worse

---

## The #1 Brain Fog Fix: Exercise

Research consistently shows that exercise is the most effective intervention for cognitive function during menopause. Even a 20-minute walk improves blood flow to the brain and releases BDNF (brain-derived neurotrophic factor) — essentially fertiliser for your brain cells.

---

## Other Things That Help

- **Sleep** — even one good night makes a noticeable difference
- **Omega-3 fatty acids** — support brain cell membrane health
- **Hydration** — dehydration impairs concentration
- **Reduce alcohol** — it directly impacts cognitive function
- **Social connection** — conversation exercises your brain

---

## When to See Your Doctor

If brain fog is significantly affecting your work or daily life, talk to your doctor. HRT can help, and it's important to rule out other causes like thyroid issues or vitamin deficiencies.`,

  "joint-pain-bone-health-basics": `## The Estrogen Connection

Many women are surprised when joint pain appears during perimenopause. But estrogen has powerful anti-inflammatory properties — and as it declines, inflammation increases.

---

## Joint Pain in Perimenopause

**Common symptoms:**
- Morning stiffness that takes a while to ease
- Aching knees, hips, shoulders, or fingers
- Frozen shoulder (sudden onset)
- Pain that moves around the body
- Swelling in hands or feet

**Why it happens:**
- Estrogen protects joint cartilage and reduces inflammation
- Lower estrogen = increased inflammatory markers
- Synovial fluid (joint lubrication) decreases
- Tendons and ligaments lose elasticity

---

## Bone Health Matters Now

Bone density declines rapidly in the years around menopause. You can lose up to 20% of bone density in the 5–7 years after menopause.

**Risk factors for osteoporosis:**
- Family history
- Small frame
- Low body weight
- Smoking
- Excessive alcohol
- Low calcium/vitamin D intake
- Sedentary lifestyle

---

## What You Can Do

**For joints:**
- **Move daily** — gentle movement lubricates joints
- **Anti-inflammatory diet** — omega-3s, turmeric, ginger, berries
- **Strength training** — supports joint stability
- **Stretching and yoga** — maintains flexibility
- **Epsom salt baths** — magnesium absorbed through skin
- **Glucosamine** — some evidence for joint support

**For bones:**
- **Weight-bearing exercise** — walking, dancing, strength training
- **Calcium** — 1000–1200mg daily (food first, supplement if needed)
- **Vitamin D3** — 1000–2000 IU daily (get levels tested)
- **Vitamin K2** — helps calcium go to bones, not arteries
- **Reduce alcohol and caffeine** — both deplete calcium

---

## When to Get Tested

Ask your doctor about a DEXA scan (bone density test) if you're over 50 or have risk factors. Early detection means early prevention.`,

  "exercise-that-actually-helps": `## Moving in Midlife

The exercise advice you followed in your 20s and 30s may not serve you now. Your body has different needs — and the research is clear about what works.

---

## Strength Training — The Non-Negotiable

This is the single most important type of exercise for midlife women.

**Why:**
- Builds and maintains muscle mass (you lose 3–8% per decade after 30)
- Increases resting metabolism
- Protects bone density
- Reduces joint pain
- Improves insulin sensitivity
- Boosts mood and confidence

**How to start:**
- 2–3 sessions per week, 20–30 minutes each
- Focus on major muscle groups: legs, back, chest, shoulders
- Bodyweight exercises count: squats, push-ups, lunges, planks
- Progress gradually — add resistance bands, then weights

---

## Walking — The Underrated Powerhouse

- 30 minutes most days
- Improves cardiovascular health, mood, sleep, and brain fog
- Morning walks in daylight help regulate your circadian rhythm
- Low impact, accessible, free

---

## Yoga & Stretching

- Improves flexibility and joint health
- Reduces stress and anxiety
- Supports balance (important as we age)
- Gentle styles like Hatha or Yin are ideal

---

## What to Approach With Caution

- **High-intensity interval training (HIIT)** — can spike cortisol; limit to 1–2 sessions per week
- **Long-distance running** — can increase cortisol and joint stress; mix with strength work
- **Hot yoga** — may trigger hot flashes

---

## The Best Exercise Plan

A balanced week might look like:
- 2–3 strength sessions (20–30 min)
- 4–5 walks (20–30 min)
- 1–2 yoga/stretching sessions
- 1 fun activity (swimming, dancing, cycling)

---

## Remember

The best exercise is the one you'll actually do. Start where you are. Consistency beats intensity every time.`,

  "meal-timing-blood-sugar": `## Why When You Eat Matters

In perimenopause, your body becomes more sensitive to blood sugar swings. Insulin resistance increases, meaning your cells don't respond to insulin as efficiently. The result: more fat storage, more fatigue, and more hot flashes.

---

## The Blood Sugar Rollercoaster

**What happens:**
1. You eat refined carbs or sugar
2. Blood sugar spikes rapidly
3. Your body releases a surge of insulin
4. Blood sugar crashes
5. You feel exhausted, foggy, irritable, and hungry again
6. The crash can trigger a hot flash

**The fix:** Keep blood sugar stable throughout the day.

---

## Meal Timing Tips

**Don't skip breakfast**
- Eating within 1–2 hours of waking stabilises your metabolism
- Include protein: eggs, Greek yogurt, nuts, or a protein smoothie

**Eat every 3–4 hours**
- Prevents blood sugar dips
- Reduces cortisol spikes from hunger stress
- Keeps energy and focus steady

**Stop eating 3 hours before bed**
- Late eating disrupts sleep quality
- Your digestive system needs rest too
- If you must snack, choose protein: handful of nuts, small piece of cheese

---

## The Protein-First Rule

Eating protein (or healthy fat) before carbohydrates slows glucose absorption. This simple trick can dramatically reduce blood sugar spikes.

**Before:** Toast with jam, then eggs
**After:** Eggs first, then toast with jam

Same meal, very different blood sugar response.

---

## Signs of Blood Sugar Instability

- Energy crashes mid-morning or mid-afternoon
- Craving sugar or carbs
- Feeling "hangry" — irritable when hungry
- Brain fog that lifts after eating
- Waking at 3am (can be a blood sugar drop)
- Hot flashes after meals

---

## Simple Swaps

- White bread to wholegrain or sourdough
- Sugary cereal to oats with nuts and seeds
- Fruit juice to whole fruit
- Pasta to legume-based pasta or smaller portion with extra veg
- Snack bars to apple with nut butter`,

  "the-supplement-evidence-guide": `## Cutting Through the Noise

The supplement industry is full of promises. Here's what the evidence actually says about supplements for perimenopause.

---

## Strong Evidence

**Magnesium glycinate** (200–400mg, bedtime)
- Improves sleep quality
- Reduces muscle cramps and restless legs
- Helps with anxiety and stress
- Glycinate form is best absorbed and gentlest on stomach
- One of the most commonly deficient minerals

**Vitamin D3 + K2** (1000–2000 IU daily)
- Essential for bone health — especially important as estrogen declines
- Supports immune function and mood
- K2 ensures calcium goes to bones, not arteries
- Get your levels tested — many women are deficient

**Omega-3 fish oil** (1000–2000mg EPA+DHA daily)
- Reduces inflammation throughout the body
- Supports brain health and cognitive function
- Benefits heart health
- Look for high EPA+DHA content on the label
- Quality matters — choose purified, tested brands

---

## Good Evidence

**Probiotics** (multi-strain, 10+ billion CFU)
- Supports the estrobolome (gut bacteria that metabolise estrogen)
- Can improve bloating and digestive issues
- May help with mood via the gut-brain axis

**B-complex vitamins**
- Support energy production
- Help with mood regulation
- B6 specifically may help with irritability and bloating
- B12 deficiency is common in midlife

**Calcium** (if dietary intake is low)
- 1000–1200mg daily total (food + supplements)
- Don't take more than 500mg at once — it won't absorb
- Best taken with vitamin D

---

## Some Evidence

**Black cohosh** — may reduce hot flashes; research is mixed
**Ashwagandha** — may help with stress, sleep, and anxiety
**Evening primrose oil** — some women find it helps with breast tenderness
**Maca root** — some evidence for energy and libido

---

## Tips for Taking Supplements

- Start one new supplement at a time
- Give each 4–6 weeks before judging effectiveness
- Choose reputable brands with third-party testing
- Always tell your doctor what you're taking
- More is not better — stick to recommended doses

---

## Red Flags

Be skeptical of anything that claims to:
- "Balance your hormones naturally"
- "Reverse menopause"
- "Work overnight"
- Cost significantly more than comparable products

If it sounds too good to be true, it is.`,

  "menopause-at-work-managing-symptoms": `## Real Strategies for Real Workdays

Managing perimenopause symptoms at work requires practical strategies. Here's what actually helps, from women who've been there.

---

## Managing Hot Flashes at Work

- Dress in layers — remove or add as needed
- Keep a small USB fan at your desk
- Sit near a window or air vent if possible
- Keep cold water and a facial mist spray in your bag
- Wear breathable natural fabrics
- Have a "hot flash outfit" — clothes you feel confident in even when flushed

---

## Managing Brain Fog at Work

- Start your day by writing your top 3 priorities
- Do complex work in the morning when focus peaks
- Use the Pomodoro technique: 25 minutes focused, 5 minutes break
- Keep a notepad for capturing thoughts before they disappear
- Record meetings (with permission) so you can review later
- Use templates and checklists for routine tasks

---

## Managing Fatigue

- Take a genuine lunch break — leave your desk
- Walk for 10 minutes after lunch
- Stay hydrated — dehydration amplifies fatigue
- Avoid heavy, carb-heavy lunches
- If possible, take a 10-minute break mid-afternoon
- Keep healthy snacks at your desk: nuts, fruit, protein bars

---

## Managing Anxiety

- Practice box breathing before stressful meetings (4-4-4-4)
- Arrive early to presentations to settle your nerves
- Have a grounding object: a smooth stone, a ring to fidget with
- Prepare more than you think you need — over-preparation reduces anxiety
- Give yourself permission to step out briefly if needed

---

## Building Your Support System

- Find one trusted colleague who knows what you're going through
- Connect with other women in similar situations
- Use Pause to track which work days are hardest and why
- Know that asking for accommodations is your right, not a weakness

---

## Remember

You are experienced, capable, and valuable. Perimenopause doesn't diminish your professional worth. It just means you need some adjustments — and that's completely reasonable.`,
};

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { slug: string; status: string; error?: string }[] = [];

  // 1. Update guide content (9 guides from add-all-guides.ts)
  for (const [slug, bodyMarkdown] of Object.entries(guideContent)) {
    try {
      const existing = await db
        .select({ id: content.id })
        .from(content)
        .where(eq(content.slug, slug));

      if (existing.length === 0) {
        results.push({ slug, status: "not_found" });
        continue;
      }

      await db
        .update(content)
        .set({ bodyMarkdown, format: "text" })
        .where(eq(content.slug, slug));

      results.push({ slug, status: "updated" });
    } catch (err) {
      results.push({
        slug,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // 2. Update library article content (from seed-library-extras)
  for (const [slug, bodyMarkdown] of Object.entries(libraryArticleContent)) {
    try {
      const existing = await db
        .select({ id: content.id })
        .from(content)
        .where(eq(content.slug, slug));

      if (existing.length === 0) {
        results.push({ slug, status: "not_found" });
        continue;
      }

      await db
        .update(content)
        .set({ bodyMarkdown, format: "text" })
        .where(eq(content.slug, slug));

      results.push({ slug, status: "updated" });
    } catch (err) {
      results.push({
        slug,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const updated = results.filter((r) => r.status === "updated").length;
  const notFound = results.filter((r) => r.status === "not_found").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    summary: { updated, notFound, errors, total: results.length },
    results,
  });
}
