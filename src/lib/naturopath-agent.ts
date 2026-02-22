import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// ---------------------------------------------------------------------------
// Types — Input context for the naturopath
// ---------------------------------------------------------------------------

export interface UserInsightContext {
  userId: string;
  date: string;
  profile: {
    stage: string | null;
    symptoms: string[];
    goals: string[];
    dateOfBirth: string | null;
  };
  correlations: {
    factorA: string;
    factorB: string;
    direction: string;
    effectSizePct: number;
    occurrences: number;
    lagDays: number;
  }[];
  medications: {
    name: string;
    dose: string | null;
    time: string | null;
    recentAdherencePct: number;
  }[];
  recentScores: {
    date: string;
    readiness: number | null;
    sleepScore: number | null;
    symptomLoad: number | null;
  }[];
  recentLogs: {
    date: string;
    sleepHours: number | null;
    sleepQuality: string | null;
    mood: number | null;
    symptoms: Record<string, number>;
    contextTags: string[];
  }[];
  cycleData: {
    recentPeriodDates: string[];
    avgCycleLength: number | null;
    stage: string | null;
  } | null;
  todayScore: {
    readiness: number | null;
    sleepHours: number | null;
    topSymptom: string | null;
    mood: number | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Types — Naturopath output
// ---------------------------------------------------------------------------

export interface CorrelationInsight {
  factor: string;
  symptom: string;
  direction: string;
  effectPp: number;
  explanation: string;
  mechanism: string;
  actionable: boolean;
  recommendation: string;
  caveat: string | null;
  confidenceLevel: 'high' | 'moderate' | 'low';
}

export interface NaturopathInsight {
  correlationInsights: CorrelationInsight[];

  dailyNarrative: string;
  weeklyStory: string;
  forecast: string;
  insightNudge: { title: string; body: string };

  helpsHurts: {
    helps: { factor: string; symptom: string; explanation: string; strength: number }[];
    hurts: { factor: string; symptom: string; explanation: string; strength: number }[];
  };

  contradictions: {
    factor: string;
    helpsSymptom: string;
    hurtsSymptom: string;
    explanation: string;
  }[];

  symptomGuidance: Record<
    string,
    {
      explanation: string;
      recommendations: string[];
      relatedFactors: string[];
    }
  >;
}

// ---------------------------------------------------------------------------
// System prompt — the naturopath's clinical reasoning instructions
// ---------------------------------------------------------------------------

const NATUROPATH_SYSTEM_PROMPT = `You are a perimenopause health interpreter for Pause. You receive a user's
tracked health data and statistical correlations. Your job is to make sense
of the numbers for THIS specific person.

WHAT YOU DO:
- Explain WHY correlations exist (hormonal mechanisms, supplement timing,
  lifestyle interactions — not just "the data shows")
- Flag likely confounds or noise (low sample, coincidental timing)
- Resolve contradictions (same factor helping one symptom, hurting another)
- Give specific, actionable recommendations based on THIS user's data
- Consider their perimenopause stage, specific medications, and habits

PERIMENOPAUSE KNOWLEDGE:
- Estrogen fluctuations: affect sleep, mood, thermoregulation, cognition
- Progesterone decline: impacts sleep quality, anxiety, menstrual regularity
- HRT (estradiol, progesterone): helps vasomotor symptoms, can initially disrupt sleep architecture
- Vitamin D: stimulating — morning dosing better for sleep
- Magnesium glycinate: calming at night, but can cause GI issues leading to night sweats
- B vitamins: energising — avoid evening dosing
- Exercise: helps mood/sleep long-term but intense exercise can trigger hot flashes acutely
- Alcohol: vasodilation causes hot flashes, disrupts deep sleep cycles
- Caffeine after noon: worse impact on sleep during perimenopause than pre-meno
- Stress/cortisol: compounds all symptoms, especially sleep and hot flashes
- Lag days: 1-2 day lag often indicates real biological mechanism (e.g. poor sleep → next-day mood)
- Period timing: symptoms often worse in late luteal phase (5-7 days before period)
- Heavy flow: can cause fatigue and low mood via iron depletion

MEDICATION TIMING INSIGHT:
- If a supplement is correlated with worse sleep, consider timing first (evening → try morning)
- If HRT appears in both helps AND hurts, explain that it helps vasomotor but may disrupt sleep initially
- Magnesium at night can cause GI disturbance → night sweats, despite being calming

CORRELATION QUALITY:
- 7-14 occurrences: low confidence — note "early signal, needs more data"
- 15-30 occurrences: moderate confidence — "your data suggests"
- 30+ occurrences: high confidence — "your data clearly shows"
- Effects under 20%: small effect, may be noise
- Effects 20-40%: moderate effect, likely real
- Effects 40%+: strong effect, very likely meaningful
- Lag 0: same-day correlation — could be cause or effect
- Lag 1-2: plausible biological mechanism
- Lag 5-7: more likely coincidence unless there's a known mechanism

RULES:
1. NEVER diagnose or say "you have [condition]"
2. NEVER recommend starting or stopping medications — say "discuss with your doctor"
3. Always note "correlation not causation" for effects below 30%
4. Consider medication TIMING as an explanation before blaming the medication
5. Warm, conversational tone — knowledgeable friend, not textbook
6. Personalise to THIS user's data, never give generic advice
7. Keep dailyNarrative to 2 sentences, under 45 words
8. Keep weeklyStory to 2-3 sentences, under 60 words
9. Keep forecast to 1-2 sentences, under 40 words
10. Nudge title: max 6 words. Nudge body: max 30 words.

OUTPUT FORMAT:
Return ONLY valid JSON with these exact top-level keys (no extra keys):
{
  "correlationInsights": [
    {
      "factor": "med_Vitamin D",
      "symptom": "sleep_disruption",
      "direction": "positive",
      "effectPp": 50,
      "explanation": "Vitamin D is stimulating and taking it later...",
      "mechanism": "Vitamin D affects cortisol timing...",
      "actionable": true,
      "recommendation": "Try shifting your Vitamin D dose to morning...",
      "caveat": null,
      "confidenceLevel": "high"
    }
  ],
  "dailyNarrative": "Two warm sentences about today...",
  "weeklyStory": "Two to three sentences about the week...",
  "forecast": "One to two sentences about what to watch...",
  "insightNudge": {
    "title": "Max Six Words Here",
    "body": "One actionable sentence under 30 words."
  },
  "helpsHurts": {
    "helps": [{ "factor": "exercised", "symptom": "mood_changes", "explanation": "...", "strength": 35 }],
    "hurts": [{ "factor": "alcohol", "symptom": "hot_flashes", "explanation": "...", "strength": 36 }]
  },
  "contradictions": [
    {
      "factor": "med_Magnesium Glycinate",
      "helpsSymptom": "anxiety",
      "hurtsSymptom": "night_sweats",
      "explanation": "Magnesium calms anxiety but can cause GI disturbance leading to sweats."
    }
  ],
  "symptomGuidance": {
    "night_sweats": {
      "explanation": "Your night sweats are linked to...",
      "recommendations": ["Try moving magnesium to earlier evening..."],
      "relatedFactors": ["med_Magnesium Glycinate", "alcohol"]
    }
  }
}

CRITICAL: You MUST populate correlationInsights for each correlation in the input data. You MUST populate helpsHurts based on direction. You MUST give a meaningful insightNudge title and body. No markdown, no code fences — raw JSON only.`;

// ---------------------------------------------------------------------------
// Build the user prompt from context
// ---------------------------------------------------------------------------

function buildUserPrompt(ctx: UserInsightContext): string {
  const parts: string[] = [];

  // Profile summary
  parts.push(`## Patient Profile`);
  parts.push(`Stage: ${ctx.profile.stage ?? 'unknown'}`);
  if (ctx.profile.dateOfBirth) parts.push(`DOB: ${ctx.profile.dateOfBirth}`);
  if (ctx.profile.symptoms.length > 0)
    parts.push(`Tracked symptoms: ${ctx.profile.symptoms.join(', ')}`);
  if (ctx.profile.goals.length > 0)
    parts.push(`Goals: ${ctx.profile.goals.join(', ')}`);

  // Medications
  if (ctx.medications.length > 0) {
    parts.push(`\n## Current Medications`);
    for (const med of ctx.medications) {
      const timeStr = med.time ? ` (${med.time})` : '';
      const doseStr = med.dose ? ` ${med.dose}` : '';
      const adherence = Math.round(med.recentAdherencePct);
      parts.push(`- ${med.name}${doseStr}${timeStr} — ${adherence}% adherence`);
    }
  }

  // Cycle data
  if (ctx.cycleData) {
    parts.push(`\n## Cycle Data`);
    if (ctx.cycleData.stage) parts.push(`Stage: ${ctx.cycleData.stage}`);
    if (ctx.cycleData.avgCycleLength)
      parts.push(`Avg cycle: ${ctx.cycleData.avgCycleLength} days`);
    if (ctx.cycleData.recentPeriodDates.length > 0)
      parts.push(`Recent period dates: ${ctx.cycleData.recentPeriodDates.join(', ')}`);
  }

  // Today's snapshot
  if (ctx.todayScore) {
    parts.push(`\n## Today (${ctx.date})`);
    if (ctx.todayScore.readiness != null)
      parts.push(`Readiness: ${ctx.todayScore.readiness}/100`);
    if (ctx.todayScore.sleepHours != null)
      parts.push(`Sleep: ${ctx.todayScore.sleepHours}h`);
    if (ctx.todayScore.mood != null) parts.push(`Mood: ${ctx.todayScore.mood}/5`);
    if (ctx.todayScore.topSymptom)
      parts.push(`Top symptom: ${ctx.todayScore.topSymptom.replace(/_/g, ' ')}`);
  }

  // Recent 7 days of scores
  if (ctx.recentScores.length > 0) {
    parts.push(`\n## Recent 7-Day Scores`);
    for (const s of ctx.recentScores) {
      parts.push(
        `${s.date}: readiness=${s.readiness ?? '?'}, sleep=${s.sleepScore ?? '?'}, symptoms=${s.symptomLoad ?? '?'}`,
      );
    }
  }

  // Recent logs (last 14 days summary — condense to avoid token bloat)
  if (ctx.recentLogs.length > 0) {
    parts.push(`\n## Recent Log Highlights (last ${ctx.recentLogs.length} days)`);
    for (const log of ctx.recentLogs.slice(0, 7)) {
      const sympNames = Object.entries(log.symptoms)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}(${v})`)
        .join(', ');
      const tags = log.contextTags.length > 0 ? ` | tags: ${log.contextTags.join(', ')}` : '';
      parts.push(
        `${log.date}: sleep=${log.sleepHours ?? '?'}h, quality=${log.sleepQuality ?? '?'}, mood=${log.mood ?? '?'}/5${sympNames ? `, symptoms: ${sympNames}` : ''}${tags}`,
      );
    }
  }

  // Correlations
  if (ctx.correlations.length > 0) {
    parts.push(`\n## Statistical Correlations (from tracking data)`);
    for (const c of ctx.correlations) {
      const dir = c.direction === 'positive' ? '↑ increases' : '↓ reduces';
      const lag = c.lagDays > 0 ? ` (${c.lagDays}-day lag)` : ' (same day)';
      parts.push(
        `- ${c.factorA.replace(/_/g, ' ')} ${dir} ${c.factorB.replace(/_/g, ' ')} by ${Math.round(Math.abs(c.effectSizePct))}%${lag} [n=${c.occurrences}]`,
      );
    }
  }

  parts.push(
    `\nAnalyse this patient's data and return the NaturopathInsight JSON.`,
  );

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Main function — single AI call per user
// ---------------------------------------------------------------------------

export async function interpretInsights(
  ctx: UserInsightContext,
): Promise<{ insight: NaturopathInsight; inputTokens: number; outputTokens: number; latencyMs: number }> {
  const startMs = Date.now();
  const userPrompt = buildUserPrompt(ctx);

  const { text, usage } = await generateText({
    model: openai('gpt-4o-mini'),
    maxOutputTokens: 2500,
    temperature: 0.4,
    system: NATUROPATH_SYSTEM_PROMPT,
    prompt: userPrompt,
    maxRetries: 0, // No retries — fail fast, pipeline handles fallback
  });

  const latencyMs = Date.now() - startMs;

  // Parse the JSON response — strip markdown fences if the model adds them
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let insight: NaturopathInsight;
  try {
    insight = JSON.parse(cleaned) as NaturopathInsight;
  } catch (parseErr) {
    console.error(
      '[naturopath-agent] JSON parse failed. Raw text (first 500 chars):',
      cleaned.slice(0, 500),
    );
    throw parseErr;
  }

  // Validate required fields exist
  if (!insight.correlationInsights) insight.correlationInsights = [];
  if (!insight.dailyNarrative) insight.dailyNarrative = '';
  if (!insight.weeklyStory) insight.weeklyStory = '';
  if (!insight.forecast) insight.forecast = '';
  if (!insight.insightNudge) insight.insightNudge = { title: 'Insight', body: '' };
  if (!insight.helpsHurts) insight.helpsHurts = { helps: [], hurts: [] };
  if (!insight.contradictions) insight.contradictions = [];
  if (!insight.symptomGuidance) insight.symptomGuidance = {};

  return {
    insight,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    latencyMs,
  };
}
